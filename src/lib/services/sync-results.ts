import { createClient } from '@supabase/supabase-js';
import * as xlsx from 'xlsx';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function syncPencaResults(pencaSlug: string, isForce: boolean = false) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        throw new Error('Faltan las variables NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const logs: string[] = [];

    const log = (msg: string) => {
        console.log(msg);
        logs.push(msg);
    };

    try {
        log(`Iniciando sincronización para la penca: ${pencaSlug}`);

        // 1. Obtener la Penca
        const { data: penca, error: pencaError } = await supabase
            .from('pencas')
            .select('id, external_results_url, racetrack_id')
            .eq('slug', pencaSlug)
            .single();

        if (pencaError || !penca) {
            throw new Error(`No se encontró la penca con slug: ${pencaSlug}`);
        }

        const fileUrl = penca.external_results_url;
        if (!fileUrl) {
            throw new Error(`La penca "${pencaSlug}" no tiene un "Link de Resultados Excel" configurado.`);
        }

        const racingTrackId: number | null = (penca as any).racetrack_id ?? null;
        if (racingTrackId) {
            log(`🏟 Usando hipódromo fijo: racetrackId=${racingTrackId}`);
        } else {
            log(`🔍 Sin hipódromo fijo configurado — buscando automáticamente...`);
        }

        // 2. Descargar y parsear el Excel
        const workbook = await fetchExcel(fileUrl, log, racingTrackId);
        const parsedData = parseResults(workbook, log);

        log(`Se encontraron ${Object.keys(parsedData).length} carreras en el Excel.`);

        // 3. Procesar cada carrera encontrada en el Excel
        for (const [raceSeq, positions] of Object.entries(parsedData)) {
            log(`\nProcesando Carrera #${raceSeq}...`);

            // Obtener la carrera de la base de datos
            const { data: race, error: raceError } = await supabase
                .from('races')
                .select('id, status')
                .eq('penca_id', penca.id)
                .eq('seq', parseInt(raceSeq))
                .single();

            if (raceError || !race) {
                log(`⚠️ No se encontró la Carrera #${raceSeq} en la base de datos. Saltando...`);
                continue;
            }

            if (race.status === 'result_published' && !isForce) {
                log(`⚠️ La Carrera #${raceSeq} ya tiene resultados publicados. Saltando...`);
                continue;
            }

            // Obtener los caballos (entries) de esa carrera
            // Usamos alias horse_name:label porque en la BD la columna se llama label
            const { data: entries, error: entriesError } = await supabase
                .from('race_entries')
                .select('id, program_number, horse_name:label')
                .eq('race_id', race.id);

            if (entriesError || !entries) {
                log(`❌ Error al obtener caballos para la Carrera #${raceSeq}`);
                continue;
            }

            const getEntryId = (programNum: number) => {
                const entry = entries.find(e => e.program_number == programNum);
                return entry ? entry.id : null;
            };

            const gettersNames = (programNumArr: number[]) => {
                return programNumArr.map(num => {
                    const entry = entries.find(e => e.program_number == num);
                    return entry ? `${entry.horse_name} (#${num})` : `Desconocido (#${num})`;
                });
            };

            // Construir el official_order
            let officialOrder: string[] = [];
            let isFirstPlaceTie = (positions as any)[1].length > 1;

            if (isFirstPlaceTie) {
                const firstTie1 = getEntryId((positions as any)[1][0]);
                const firstTie2 = getEntryId((positions as any)[1][1]);

                if (!firstTie1 || !firstTie2) {
                    log(`❌ Error de mapeo de caballos para empate en Carrera #${raceSeq}`);
                    continue;
                }

                // El tercer lugar puede venir como posición 2, 3 ó 4 según el hipódromo
                const thirdPlaceNum = (positions as any)[2]?.[0] ?? (positions as any)[3]?.[0] ?? null;
                const fourthPlaceNum = (positions as any)[3]?.[0] ?? (positions as any)[4]?.[0] ?? null;
                const thirdPlace  = thirdPlaceNum  ? getEntryId(thirdPlaceNum)  : null;
                const fourthPlace = fourthPlaceNum && fourthPlaceNum !== thirdPlaceNum ? getEntryId(fourthPlaceNum) : null;

                officialOrder = [firstTie1, firstTie2];
                if (thirdPlace)  officialOrder.push(thirdPlace);
                if (fourthPlace) officialOrder.push(fourthPlace);

                log(`🔁 Empate en 1er lugar detectado: #${(positions as any)[1][0]} y #${(positions as any)[1][1]}. 3ro: ${thirdPlaceNum ?? 'N/A'}`);
            } else {
                const firstPlace = getEntryId((positions as any)[1][0]);
                const secondPlace = getEntryId((positions as any)[2][0]);
                const thirdPlace = getEntryId((positions as any)[3][0]);
                const fourthPlace = getEntryId((positions as any)[4][0]);

                if (!firstPlace || !secondPlace) {
                    log(`❌ Error de mapeo de caballos en Carrera #${raceSeq}`);
                    continue;
                }

                officialOrder = [firstPlace, secondPlace];
                if (thirdPlace) officialOrder.push(thirdPlace);
                if (fourthPlace) officialOrder.push(fourthPlace);
            }

            const scratchedEntriesUUIDs = (positions as any).scratched.map((num: number) => getEntryId(num)).filter(Boolean);

            // Llamar a la Edge Function
            log(`Enviando resultados a la Edge Function...`);
            const response = await fetch(`${SUPABASE_URL}/functions/v1/publish-result`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
                },
                body: JSON.stringify({
                    race_id: race.id,
                    official_order: officialOrder,
                    first_place_tie: isFirstPlaceTie,
                    scratched_entries: scratchedEntriesUUIDs,
                    winner_dividend: (positions as any).dividend,
                    notes: 'Resultado publicado automáticamente vía Excel (Sync Service)'
                })
            });

            if (response.ok) {
                log(`✅ Resultados publicados para la Carrera #${raceSeq}`);
            } else {
                const errorText = await response.text();
                log(`❌ Error publicando Carrera #${raceSeq}: ${errorText}`);
            }
        }

        // 4. Actualizar fecha de última sincronización
        await supabase
            .from('pencas')
            .update({ last_sync_at: new Date().toISOString() })
            .eq('id', penca.id);

        log('✅ Registro de sincronización actualizado.');
        return { success: true, logs: logs.join('\n') };

    } catch (err: any) {
        log(`Error fatal: ${err.message}`);
        return { success: false, error: err.message, logs: logs.join('\n') };
    }
}

async function fetchExcel(url: string, log: (m: string) => void, preferredRacetrackId: number | null = null) {
    if (url.includes('hipica.maronas.com.uy/RacingInfo/RacingDate')) {
        log(`Detectada URL de la página de Maroñas. Intentando extraer link de Excel...`);
        const urlParams = new URL(url).searchParams;
        const racingDate = urlParams.get('RacingDate');

        if (!racingDate) throw new Error('No se encontró el parámetro RacingDate en la URL.');

        // Si hay un racetrackId configurado, usarlo directamente sin ciclar
        const idsToTry = preferredRacetrackId
            ? [preferredRacetrackId]
            : [1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 20];

        for (const id of idsToTry) {
            const tryUrl = `https://mobile-rest-services-v3.azurewebsites.net//XTurfResourcesService.svc/GetRacingDocument?docType=ResultadoCarreraWeb&racetrackId=${id}&date=${racingDate}&periodId=0&raceNum=0&language=es-UY&docOrd=0&exportFormat=ExcelRecord`;

            try {
                log(`Probando descarga con racetrackId=${id}...`);
                const response = await fetch(tryUrl);
                if (!response.ok) {
                    log(`  ID ${id} falló con status ${response.status}`);
                    continue;
                }

                const arrayBuffer = await response.arrayBuffer();
                if (arrayBuffer.byteLength < 1000) {
                    log(`  ID ${id} devolvió un archivo vacío o erróneo (bytes=${arrayBuffer.byteLength}).`);
                    continue;
                }

                log(`✅ Link de Excel descubierto y descargado con ID ${id} (tamaño=${arrayBuffer.byteLength} bytes)`);
                return xlsx.read(arrayBuffer, { type: 'buffer' });
            } catch (e) {
                continue;
            }
        }
        throw new Error('No se pudo encontrar un link de Excel válido.');
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    return xlsx.read(arrayBuffer, { type: 'buffer' });
}

function parseResults(workbook: any, log: (m: string) => void) {
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const data: any[][] = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    const parsedRaces: any = {};
    let currentRaceSeq: number | null = null;

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;

        const col0 = String(row[0] || '').trim();
        const raceMatch = col0.match(/^(\d+)ª Carrera/);
        if (raceMatch) {
            currentRaceSeq = parseInt(raceMatch[1], 10);
            parsedRaces[currentRaceSeq] = { 1: [], 2: [], 3: [], 4: [], scratched: [], dividend: 0 };
            continue;
        }

        if (!currentRaceSeq) continue;

        const dividendStr = String(row[13] || '').replace(',', '.').trim();

        // Detectar posiciones, ej: "1º", "2º", "3º", "4º", "5º", etc.
        // En algunos hipódromos la posición puede no estar en la primera columna,
        // por eso escaneamos las primeras columnas buscando el patrón Nº.
        let position: number | null = null;
        let hasAnyPosition = false;
        for (let colIdx = 0; colIdx <= 2; colIdx++) {
            const cell = String(row[colIdx] || '').trim();
            const posMatch = cell.match(/^(\d+)º$/);
            if (posMatch) {
                const posNum = parseInt(posMatch[1], 10);
                if (posNum > 0) {
                    hasAnyPosition = true;
                    if (posNum <= 4) position = posNum;
                }
                break;
            }
        }

        const col1 = String(row[1] || '').trim();
        const col2 = String(row[2] || '').trim();
        const horseMatch = col2.match(/^\((\d+)\)$/) || col1.match(/\((\d+)\)$/);

        if (horseMatch) {
            const horseNum = parseInt(horseMatch[1], 10);
            if (position) {
                parsedRaces[currentRaceSeq][position].push(horseNum);
                if (position === 1 && dividendStr && !isNaN(parseFloat(dividendStr))) {
                    parsedRaces[currentRaceSeq].dividend = parseFloat(dividendStr);
                }
            } else if (!hasAnyPosition) {
                // Para marcar retirados buscamos palabras clave en toda la fila
                const rowText = row.map((c) => String(c || '').toLowerCase()).join(' ');
                const hasRetiroFlag = /retiro|retirado|ret\.|fs\b|ff\b|no corre|no particip/.test(rowText);
                if (hasRetiroFlag) {
                    parsedRaces[currentRaceSeq].scratched.push(horseNum);
                }
            }
        }
    }

    return parsedRaces;
}
