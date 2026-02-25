const { createClient } = require('@supabase/supabase-js');
const xlsx = require('xlsx');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' }); // Cargar .env.local si existe

// Configuración de Supabase
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('ERROR: Faltan las variables NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ==========================================
// CONFIGURACIÓN DE EXCEL (¡A MODIFICAR!)
// ==========================================
// Especifica el nombre de las columnas en tu archivo Excel
const EXCEL_CONFIG = {
  RACE_NUMBER_COL: 'Carrera',     // Columna con el número de carrera (ej. 1, 2, 3)
  HORSE_NUMBER_COL: 'Caballo',    // Columna con el número de mandil/programa
  POSITION_COL: 'Puesto',         // Columna con la posición final (1, 2, 3)
  // Valores esperados en la columna POSITION_COL para los primeros 3 puestos
  WINNER_VALUE: 1,
  SECOND_VALUE: 2,
  THIRD_VALUE: 3
};

// ==========================================

async function fetchExcel(urlOrPath) {
  try {
    if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
      // Si el link es la página de resultados de Maroñas, intentar encontrar el link del Excel
      if (urlOrPath.includes('hipica.maronas.com.uy/RacingInfo/RacingDate')) {
        console.log(`Detectada URL de la página de Maroñas. Intentando extraer link de Excel...`);

        // Extraer parámetros de la URL: RacingDate
        const urlParams = new URL(urlOrPath).searchParams;
        const racingDate = urlParams.get('RacingDate');

        if (!racingDate) throw new Error('No se encontró el parámetro RacingDate en la URL.');

        // Lista de racetrackIds comunes para probar: 1=Maroñas, 16=Melo, 4=Las Piedras
        const commonRacetrackIds = [1, 16, 4];

        for (const id of commonRacetrackIds) {
          const tryUrl = `https://mobile-rest-services-v3.azurewebsites.net//XTurfResourcesService.svc/GetRacingDocument?docType=ResultadoCarreraWeb&racetrackId=${id}&date=${racingDate}&periodId=0&raceNum=0&language=es-UY&docOrd=0&exportFormat=ExcelRecord`;

          try {
            console.log(`Probando descarga con racetrackId=${id}...`);
            const response = await fetch(tryUrl);
            if (!response.ok) {
              console.warn(`  ID ${id} falló con status ${response.status}`);
              continue;
            }

            const arrayBuffer = await response.arrayBuffer();
            // Verificar tamaño mínimo (evita falsos positivos con errores de API)
            if (arrayBuffer.byteLength < 1000) {
              console.warn(`  ID ${id} devolvió un archivo vacío o erróneo.`);
              continue;
            }

            console.log(`  ✅ Link de Excel descubierto y descargado con ID ${id}`);
            return xlsx.read(arrayBuffer, { type: 'buffer' });
          } catch (e) {
            console.warn(`  Error probando ID ${id}: ${e.message}`);
          }
        }

        throw new Error('No se pudo encontrar un link de Excel válido para los hipódromos conocidos.');
      }

      console.log(`Descargando Excel desde ${urlOrPath}...`);
      const response = await fetch(urlOrPath);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      return xlsx.read(arrayBuffer, { type: 'buffer' });
    } else {
      console.log(`Leyendo Excel local desde ${urlOrPath}...`);
      return xlsx.readFile(urlOrPath);
    }
  } catch (error) {
    console.error('Error al obtener/leer el archivo Excel:', error.message);
    throw error;
  }
}

function parseResults(workbook) {
  console.log('Analizando datos del Excel de Maroñas...');
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Convertir a array de arrays
  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

  // Estructura: { '1': { 1: [], 2: [], 3: [], 4: [], scratched: [], dividend: 0 }, '2': ... }
  const parsedRaces = {};

  let currentRaceSeq = null;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const col0 = String(row[0] || '').trim();

    // Detectar nueva carrera, ej: "1ª Carrera, Nro. 31449, Premio: ..."
    const raceMatch = col0.match(/^(\d+)ª Carrera/);
    if (raceMatch) {
      currentRaceSeq = parseInt(raceMatch[1], 10);
      parsedRaces[currentRaceSeq] = { 1: [], 2: [], 3: [], 4: [], scratched: [], dividend: 0 };
      continue;
    }

    if (!currentRaceSeq) continue;

    // Columna N (index 13 en 0-indexed) tiene el dividendo / sport si es el ganador
    const dividendStr = String(row[13] || '').replace(',', '.').trim();

    // Detectar posiciones, ej: "1º", "2º", "3º", "4º", "5º", etc.
    const posMatch = col0.match(/^(\d+)º$/);
    let position = null;
    let hasAnyPosition = false;

    if (posMatch) {
      const posNum = parseInt(posMatch[1], 10);
      if (posNum > 0) {
        hasAnyPosition = true;
        if (posNum <= 4) {
          position = posNum;
        }
      }
    }

    // Detectar retirados por ausencia de posición si tiene número de programa válido, 
    // o por un string de retiro explícito, ej: "Retiro Voluntario", "FS", "FF" en otras columnas.
    // Revisemos la columna 2 para programa y columna 4 para status (FS, FF)
    const col1 = String(row[1] || '').trim();
    const col2 = String(row[2] || '').trim();

    // El número de programa puede estar en col2: "(12)" o al final de col1: "CABALLO (12)"
    const horseMatch = col2.match(/^\((\d+)\)$/) || col1.match(/\((\d+)\)$/);

    if (horseMatch) {
      const horseNum = parseInt(horseMatch[1], 10);

      if (position) {
        parsedRaces[currentRaceSeq][position].push(horseNum);
        // Si es el primero, intentamos parsear el dividendo
        if (position === 1 && dividendStr && !isNaN(parseFloat(dividendStr))) {
          parsedRaces[currentRaceSeq].dividend = parseFloat(dividendStr);
        }
      } else if (!hasAnyPosition) {
        // Asumir retirado SOLO si no tiene ninguna posición numérica > 0 (ej: 0º, o vacío)
        parsedRaces[currentRaceSeq].scratched.push(horseNum);
      }
    }
  }

  return parsedRaces;
}

async function main() {
  const args = process.argv.slice(2);
  let fileUrl = '';
  let pencaSlug = '';
  let isDryRun = false;
  let isForce = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' || args[i] === '--file') fileUrl = args[i + 1];
    if (args[i] === '--penca-slug') pencaSlug = args[i + 1];
    if (args[i] === '--dry-run') isDryRun = true;
    if (args[i] === '--force') isForce = true;
  }

  if (!pencaSlug) {
    console.error('Uso: node sync-results-excel.js --penca-slug <SLUG> [--url <URL_O_ARCHIVO>] [--dry-run] [--force]');
    process.exit(1);
  }

  try {
    // 1. Obtener la Penca (y su URL si es necesario)
    const { data: penca, error: pencaError } = await supabase
      .from('pencas')
      .select('id, external_results_url')
      .eq('slug', pencaSlug)
      .single();

    if (pencaError || !penca) {
      throw new Error(`No se encontró la penca con slug: ${pencaSlug}`);
    }

    // Usar la URL de la base de datos si no se pasó por argumento
    if (!fileUrl) {
      fileUrl = penca.external_results_url;
      if (!fileUrl) {
        throw new Error(`La penca "${pencaSlug}" no tiene un "Link de Resultados Excel" configurado. Úsalo con --url o configúralo en el panel admin.`);
      }
    }

    // 2. Descargar y parsear el Excel
    const workbook = await fetchExcel(fileUrl);
    const parsedData = parseResults(workbook);

    console.log(`Se encontraron ${Object.keys(parsedData).length} carreras en el Excel.`);

    // 3. Procesar cada carrera encontrada en el Excel
    for (const [raceSeq, positions] of Object.entries(parsedData)) {
      console.log(`\nProcesando Carrera #${raceSeq}...`);

      // Obtener la carrera de la base de datos
      const { data: race, error: raceError } = await supabase
        .from('races')
        .select('id, status')
        .eq('penca_id', penca.id)
        .eq('seq', parseInt(raceSeq))
        .single();

      if (raceError || !race) {
        console.warn(`⚠️  No se encontró la Carrera #${raceSeq} en la base de datos. Saltando...`);
        continue;
      }

      if (race.status === 'result_published' && !isDryRun && !isForce) {
        console.warn(`⚠️  La Carrera #${raceSeq} ya tiene resultados publicados. Saltando (usa --force para ignorar)...`);
        continue;
      }

      // Obtener los caballos (entries) de esa carrera para mapear programa -> uuid
      const { data: entries, error: entriesError } = await supabase
        .from('race_entries')
        .select('id, program_number, label')
        .eq('race_id', race.id);

      if (entriesError || !entries) {
        console.error(`❌ Error al obtener caballos para la Carrera #${raceSeq}`, entriesError);
        continue;
      }

      // Helper para mapear nro de programa a UUID
      const getEntryId = (programNum) => {
        const entry = entries.find(e => e.program_number == programNum);
        return entry ? entry.id : null;
      };

      const gettersNames = (programNumArr) => {
        return programNumArr.map(num => {
          const entry = entries.find(e => e.program_number == num);
          return entry ? `${entry.label} (#${num})` : `Desconocido (#${num})`;
        });
      };

      // Construir el official_order
      let officialOrder = [];
      let isFirstPlaceTie = positions[1].length > 1;

      console.log(`  Resultado detectado:`);
      console.log(`  1ro: ${gettersNames(positions[1]).join(', ')} (Paga: $${positions.dividend})`);
      console.log(`  2do: ${gettersNames(positions[2]).join(', ')}`);
      console.log(`  3ro: ${gettersNames(positions[3]).join(', ')}`);
      if (positions[4].length > 0) {
        console.log(`  4to: ${gettersNames(positions[4]).join(', ')}`);
      }
      if (positions.scratched.length > 0) {
        console.log(`  Retirados: ${gettersNames(positions.scratched).join(', ')}`);
      }

      if (isFirstPlaceTie) {
        // Empate en 1er puesto
        const firstTie1 = getEntryId(positions[1][0]);
        const firstTie2 = getEntryId(positions[1][1]);
        const thirdPlace = getEntryId(positions[3][0]); // El tercero de verdad
        const fourthPlace = getEntryId(positions[4][0]);

        if (!firstTie1 || !firstTie2 || (!thirdPlace && positions[3].length > 0)) {
          console.error(`❌ Error de mapeo de caballos para empate en Carrera #${raceSeq}`);
          continue;
        }

        officialOrder = [firstTie1, firstTie2];
        if (thirdPlace) officialOrder.push(thirdPlace);
        if (fourthPlace) officialOrder.push(fourthPlace);

      } else {
        // Normal
        const firstPlace = getEntryId(positions[1][0]);
        const secondPlace = getEntryId(positions[2][0]);
        const thirdPlace = getEntryId(positions[3][0]);
        const fourthPlace = getEntryId(positions[4][0]);

        if (!firstPlace || !secondPlace || (!thirdPlace && positions[3].length > 0)) {
          console.error(`❌ Error de mapeo de caballos en Carrera #${raceSeq}`);
          continue;
        }

        officialOrder = [firstPlace, secondPlace];
        if (thirdPlace) officialOrder.push(thirdPlace);
        if (fourthPlace) officialOrder.push(fourthPlace);
      }

      const scratchedEntriesUUIDs = positions.scratched.map(num => getEntryId(num)).filter(Boolean);

      if (isDryRun) {
        console.log(`  [DRY RUN] Se llamaría a publish-result con:`, {
          raceId: race.id,
          officialOrder,
          firstPlaceTie: isFirstPlaceTie,
          scratchedEntries: scratchedEntriesUUIDs,
          winnerDividend: positions.dividend
        });
      } else {
        // Llamar a la Edge Function
        console.log(`  Enviando resultados a la Edge Function...`);
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
            winner_dividend: positions.dividend,
            notes: 'Resultado publicado automáticamente vía Excel'
          })
        });

        if (response.ok) {
          console.log(`  ✅ Resultados publicados para la Carrera #${raceSeq}`);
        } else {
          const errorText = await response.text();
          console.error(`  ❌ Error publicando Carrera #${raceSeq}:`, errorText);
        }
      }
    }

    // 4. Actualizar fecha de última sincronización si no es dry-run
    if (!isDryRun) {
      const { error: syncUpdateError } = await supabase
        .from('pencas')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', penca.id);

      if (syncUpdateError) {
        console.error('⚠️ Error al actualizar last_sync_at:', syncUpdateError.message);
      } else {
        console.log('✅ Registro de sincronización actualizado.');
      }
    }

    console.log('\n¡Proceso finalizado!');

  } catch (err) {
    console.error('Error no controlado:', err);
    process.exit(1);
  }
}

main();
