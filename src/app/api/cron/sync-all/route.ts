import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import util from 'util';

export const dynamic = 'force-dynamic';

const execPromise = util.promisify(exec);

// Usar variables de entorno de servidor
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Iniciado el: 2026-02-25 18:30
export async function GET(request: Request) {
    // Opcional: Verificar un token de seguridad para evitar ejecuciones externas no deseadas
    // const authHeader = request.headers.get('authorization');
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    //   return new Response('No autorizado', { status: 401 });
    // }

    try {
        console.log('--- Iniciando Cron de Sincronización Global ---');

        // 1. Obtener todas las pencas con sincronización activada
        const { data: pencas, error: pencasError } = await supabase
            .from('pencas')
            .select('id, slug, sync_interval_minutes, last_sync_at, external_results_url')
            .gt('sync_interval_minutes', 0)
            .not('external_results_url', 'is', null);

        if (pencasError) throw pencasError;

        if (!pencas || pencas.length === 0) {
            return NextResponse.json({ message: 'No hay pencas configuradas para sincronización automática.' });
        }

        const results = [];
        const scriptPath = path.join(process.cwd(), 'scripts', 'sync-results-excel.js');

        for (const penca of pencas) {
            const now = new Date();
            const lastSync = penca.last_sync_at ? new Date(penca.last_sync_at) : new Date(0);
            const diffMinutes = Math.floor((now.getTime() - lastSync.getTime()) / 60000);

            if (diffMinutes >= penca.sync_interval_minutes) {
                console.log(`Ejecutando sincronización para: ${penca.slug} (Intervalo: ${penca.sync_interval_minutes}m, Pasaron: ${diffMinutes}m)`);

                try {
                    // Ejecutamos el script. Usamos --force para asegurar cálculo si hay resultados parciales.
                    const { stdout, stderr } = await execPromise(`node "${scriptPath}" --penca-slug "${penca.slug}" --force`);

                    results.push({
                        slug: penca.slug,
                        status: 'success',
                        log: stdout
                    });
                } catch (err: any) {
                    console.error(`Error sincronizando ${penca.slug}:`, err.message);
                    results.push({
                        slug: penca.slug,
                        status: 'error',
                        error: err.message
                    });
                }
            } else {
                results.push({
                    slug: penca.slug,
                    status: 'skipped',
                    reason: `Faltan ${penca.sync_interval_minutes - diffMinutes} minutos.`
                });
            }
        }

        return NextResponse.json({
            processed_at: new Date().toISOString(),
            results
        });

    } catch (error: any) {
        console.error('Error en Cron Global:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
