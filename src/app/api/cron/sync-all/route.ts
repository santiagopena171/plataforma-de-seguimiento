import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { syncPencaResults } from '@/lib/services/sync-results';

/** Envía una foto a Telegram con caption opcional — descarga primero y sube como multipart */
async function sendTelegramPhoto(photoUrl: string, caption?: string): Promise<{ sent: boolean; error?: string }> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return { sent: false, error: 'TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID no configurados' };

    try {
        // Descargar la imagen primero
        const imgRes = await fetch(photoUrl);
        if (!imgRes.ok) return { sent: false, error: `Image fetch failed: ${imgRes.status}` };
        const imgBlob = await imgRes.blob();

        // Subir como multipart/form-data (más confiable que URL)
        const form = new FormData();
        form.append('chat_id', chatId);
        form.append('photo', imgBlob, 'resumen.png');
        if (caption) form.append('caption', caption);
        form.append('parse_mode', 'Markdown');

        const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
            method: 'POST',
            body: form,
        });
        const json = await res.json();
        if (!json.ok) return { sent: false, error: json.description };
        return { sent: true };
    } catch (err: any) {
        return { sent: false, error: err.message };
    }
}

/** Envía un mensaje de texto a Telegram */
async function sendTelegramMessage(text: string): Promise<{ sent: boolean; error?: string }> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return { sent: false, error: 'Variables de Telegram no configuradas' };

    try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
        });
        const json = await res.json();
        if (!json.ok) return { sent: false, error: json.description };
        return { sent: true };
    } catch (err: any) {
        return { sent: false, error: err.message };
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

                // Marcar como sincronizado AHORA para que el intervalo se respete aunque falle
                await supabaseAdmin
                    .from('pencas')
                    .update({ last_sync_at: new Date().toISOString() })
                    .eq('id', penca.id);

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
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pencashipicas.vercel.app';

        // Notificar por Telegram cuando se ejecutó al menos una sincronización real
        const synced = results.filter(r => r.status === 'success' || r.status === 'error');
        const telegramResults: any[] = [];

        for (const r of synced) {
            if (r.status === 'success') {
                // Enviar imagen del resumen diario
                const imageUrl = `${appUrl}/api/daily-image/${r.slug}`;
                const now = new Date().toLocaleString('es-UY', { timeZone: 'America/Montevideo' });
                const result = await sendTelegramPhoto(imageUrl, `🏇 Sync automática — ${r.slug} (${now})`);
                telegramResults.push({ slug: r.slug, ...result });
            } else {
                // Enviar texto de error
                const now = new Date().toLocaleString('es-UY', { timeZone: 'America/Montevideo' });
                const result = await sendTelegramMessage(`❌ *Sync fallida* — ${r.slug} (${now})\n${(r as any).error?.substring(0, 200)}`);
                telegramResults.push({ slug: r.slug, ...result });
            }
        }

        return NextResponse.json({
            processed_at,
            results,
            telegram: telegramResults.length > 0 ? telegramResults : { skipped: true, reason: 'No hubo syncs reales' },
        });

    } catch (error: any) {
        console.error('Error en Cron Global:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
