import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import * as xlsx from 'xlsx';

export const dynamic = 'force-dynamic';

// Nombres conocidos de hipódromos en Uruguay según ID X-Turf
// Los que no están documentados se identifican por el contenido del Excel
const KNOWN_NAMES: Record<number, string> = {
    1: 'Hipódromo de Maroñas',
    4: 'Las Piedras',
    5: 'Melo',
    6: 'Florida',
    7: 'Salto',
    8: 'Paysandú',
    9: 'Rivera',
    10: 'Minas',
    11: 'Mercedes',
    12: 'Rocha',
    13: 'Tacuarembó',
    14: 'Trinidad',
    15: 'Nacional de Carreras',
    16: 'Colonia',
    20: 'Durazno',
};

const CANDIDATE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25];

/**
 * Extrae el nombre del hipódromo y la cantidad de carreras del Excel descargado.
 */
function parseTrackInfo(workbook: any): { name: string | null; raceCount: number } {
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data: any[][] = xlsx.utils.sheet_to_json(firstSheet, { header: 1 });

    let raceCount = 0;
    let name: string | null = null;

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;
        const col0 = String(row[0] || '').trim();

        // Las primeras filas suelen tener el nombre del hipódromo
        if (i < 8 && col0 && col0.length > 3 && !col0.match(/^(\d+)[°ª]?\s*(Carrera|CARRERA)/i)) {
            const lower = col0.toLowerCase();
            if (
                lower.includes('hip') ||
                lower.includes('maroñas') ||
                lower.includes('florida') ||
                lower.includes('piedras') ||
                lower.includes('turf') ||
                lower.includes('carrer') ||
                lower.includes('hipodromo')
            ) {
                name = col0;
            }
        }

        if (col0.match(/^(\d+)[°ª]\s*Carrera/i)) raceCount++;
    }

    return { name, raceCount };
}

export async function GET(
    _req: NextRequest,
    { params }: { params: { slug: string } }
) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: penca } = await supabase
        .from('pencas')
        .select('external_results_url')
        .eq('slug', params.slug)
        .single();

    if (!penca?.external_results_url) {
        return NextResponse.json(
            { error: 'No hay URL de resultados configurada en esta penca' },
            { status: 400 }
        );
    }

    const url = penca.external_results_url;

    if (!url.includes('hipica.maronas.com.uy/RacingInfo/RacingDate')) {
        return NextResponse.json(
            { error: 'La URL no corresponde a la API de Maroñas (hipica.maronas.com.uy)' },
            { status: 400 }
        );
    }

    let racingDate: string | null;
    try {
        racingDate = new URL(url).searchParams.get('RacingDate');
    } catch {
        return NextResponse.json({ error: 'URL inválida' }, { status: 400 });
    }

    if (!racingDate) {
        return NextResponse.json(
            { error: 'No se encontró el parámetro RacingDate en la URL' },
            { status: 400 }
        );
    }

    const results = await Promise.allSettled(
        CANDIDATE_IDS.map(async (id) => {
            const tryUrl = `https://mobile-rest-services-v3.azurewebsites.net//XTurfResourcesService.svc/GetRacingDocument?docType=ResultadoCarreraWeb&racetrackId=${id}&date=${racingDate}&periodId=0&raceNum=0&language=es-UY&docOrd=0&exportFormat=ExcelRecord`;

            try {
                const response = await fetch(tryUrl, { signal: AbortSignal.timeout(10000) });
                const arrayBuffer = await response.arrayBuffer();
                console.log(`[find-hipodromos] ID ${id}: status=${response.status} bytes=${arrayBuffer.byteLength}`);
                if (!response.ok || arrayBuffer.byteLength < 500) return null;

                const workbook = xlsx.read(arrayBuffer, { type: 'buffer' });
                const { name: excelName, raceCount } = parseTrackInfo(workbook);
                console.log(`[find-hipodromos] ID ${id}: name="${excelName}" raceCount=${raceCount}`);

                const name = excelName || KNOWN_NAMES[id] || `Hipódromo ID ${id}`;
                return { racetrack_id: id, name, race_count: raceCount };
            } catch (err) {
                console.log(`[find-hipodromos] ID ${id}: error=${err}`);
                return null;
            }
        })
    );

    const found = results
        .filter((r): r is PromiseFulfilledResult<{ racetrack_id: number; name: string; race_count: number }> =>
            r.status === 'fulfilled' && r.value !== null
        )
        .map((r) => r.value)
        .sort((a, b) => b.race_count - a.race_count);

    return NextResponse.json({ racingDate, tracks: found });
}
