import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import util from 'util';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const execPromise = util.promisify(exec);

export async function GET(request: Request) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error('Cron: Faltan variables de entorno para inicializar Supabase.');
        return NextResponse.json({ error: 'Configuración incompleta' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    try {
        console.log('--- Iniciando Cron de Sincronización Global ---');

        // 1. Obtener todas las pencas con sincronización activada
        const { data: pencas, error: pencasError } = await supabaseAdmin
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
                    const { stdout } = await execPromise(`node "${scriptPath}" --penca-slug "${penca.slug}" --force`);

                    results.push({
                        slug: penca.slug,
                        status: 'success',
                        log: stdout.substring(0, 500) // Limitar log en respuesta
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
