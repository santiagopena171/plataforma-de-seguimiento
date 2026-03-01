import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { syncPencaResults } from '@/lib/services/sync-results';

/**
 * Envía un mensaje de WhatsApp gratis vía CallMeBot.
 * Requiere CALLMEBOT_PHONE y CALLMEBOT_APIKEY en las variables de entorno.
 * Activación (una sola vez): https://www.callmebot.com/blog/free-api-whatsapp-messages/
 */
async function sendWhatsApp(message: string): Promise<void> {
    const phone = process.env.CALLMEBOT_PHONE;
    const apikey = process.env.CALLMEBOT_APIKEY;
    if (!phone || !apikey) return; // Si no está configurado, silencioso

    const encoded = encodeURIComponent(message);
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encoded}&apikey=${apikey}`;
    try {
        await fetch(url);
    } catch (err) {
        console.error('CallMeBot error:', err);
    }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

        for (const penca of pencas) {
            const now = new Date();
            const lastSync = penca.last_sync_at ? new Date(penca.last_sync_at) : new Date(0);
            const diffMinutes = Math.floor((now.getTime() - lastSync.getTime()) / 60000);

            if (diffMinutes >= penca.sync_interval_minutes) {
                console.log(`Ejecutando sincronización para: ${penca.slug} (Intervalo: ${penca.sync_interval_minutes}m, Pasaron: ${diffMinutes}m)`);

                try {
                    const result = await syncPencaResults(penca.slug, true);

                    if (result.success) {
                        results.push({
                            slug: penca.slug,
                            status: 'success',
                            log: result.logs?.substring(0, 500)
                        });
                    } else {
                        results.push({
                            slug: penca.slug,
                            status: 'error',
                            error: result.error,
                            log: result.logs?.substring(0, 500)
                        });
                    }
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

        const processed_at = new Date().toISOString();

        // Notificar por WhatsApp solo cuando se ejecutó al menos una sincronización real
        const synced = results.filter(r => r.status === 'success' || r.status === 'error');
        if (synced.length > 0) {
            const now = new Date().toLocaleString('es-UY', { timeZone: 'America/Montevideo' });
            const lines = synced.map(r => {
                const icon = r.status === 'success' ? '✅' : '❌';
                const detail = r.status === 'error' ? ` - ${(r as any).error?.substring(0, 80)}` : '';
                return `${icon} ${r.slug}${detail}`;
            });
            const msg = `🏇 *Sync automática* (${now})\n${lines.join('\n')}`;
            await sendWhatsApp(msg);
        }

        return NextResponse.json({
            processed_at,
            results
        });

    } catch (error: any) {
        console.error('Error en Cron Global:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
