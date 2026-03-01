import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { syncPencaResults } from '@/lib/services/sync-results';

/**
 * Envía un mensaje de WhatsApp gratis vía CallMeBot.
 */
async function sendWhatsApp(message: string): Promise<{ sent: boolean; status?: number; response?: string; error?: string; varsPresent?: boolean }> {
    const phone = process.env.CALLMEBOT_PHONE;
    const apikey = process.env.CALLMEBOT_APIKEY;
    if (!phone || !apikey) return { sent: false, varsPresent: false };

    const encoded = encodeURIComponent(message);
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encoded}&apikey=${apikey}`;
    try {
        const res = await fetch(url);
        const text = await res.text();
        return { sent: true, status: res.status, response: text.substring(0, 200), varsPresent: true };
    } catch (err: any) {
        console.error('CallMeBot error:', err);
        return { sent: false, error: err.message, varsPresent: true };
    }
}

/**
 * Construye el resumen diario de una penca como texto para WhatsApp,
 * replicando la lógica del botón "Extraer (Diaria)".
 */
async function getDailySummaryText(supabaseAdmin: SupabaseClient, pencaSlug: string): Promise<string | null> {
    try {
        const { data: penca } = await supabaseAdmin
            .from('pencas')
            .select('id, name')
            .eq('slug', pencaSlug)
            .single();
        if (!penca) return null;

        // Tomar el race_day más reciente con al menos una carrera publicada
        const { data: latestRaces } = await supabaseAdmin
            .from('races')
            .select('race_day_id')
            .eq('status', 'result_published')
            .order('updated_at', { ascending: false })
            .limit(50);

        // Obtener todos los race_days de esta penca
        const { data: raceDays } = await supabaseAdmin
            .from('race_days')
            .select('id, day_name, day_date')
            .eq('penca_id', penca.id)
            .order('day_date', { ascending: false });

        if (!raceDays || raceDays.length === 0) return null;

        // Encontrar el race_day más reciente que tenga carreras publicadas
        const publishedDayIds = new Set((latestRaces || []).map((r: any) => r.race_day_id));
        const raceDay = raceDays.find(d => publishedDayIds.has(d.id)) || raceDays[0];

        // Carreras del día, ordenadas por seq
        const { data: races } = await supabaseAdmin
            .from('races')
            .select('id, seq, status')
            .eq('race_day_id', raceDay.id)
            .order('seq', { ascending: true });

        if (!races || races.length === 0) return null;

        const raceIds = races.map((r: any) => r.id);

        // Memberships (jugadores)
        const { data: memberships } = await supabaseAdmin
            .from('memberships')
            .select('id, user_id, guest_name, profiles(display_name)')
            .eq('penca_id', penca.id)
            .eq('role', 'player');

        if (!memberships || memberships.length === 0) return null;

        // Predicciones
        const { data: predictions } = await supabaseAdmin
            .from('predictions')
            .select('race_id, membership_id, user_id, winner_entry:race_entries!predictions_winner_pick_fkey(program_number)')
            .in('race_id', raceIds);

        // Scores
        const { data: scores } = await supabaseAdmin
            .from('scores')
            .select('race_id, membership_id, user_id, points_total')
            .in('race_id', raceIds);

        // Mapa membershipId → nombre
        const membershipsByUserId = new Map(
            memberships.filter((m: any) => m.user_id).map((m: any) => [m.user_id, m])
        );

        // Calcular acumulados por participante (igual que extract-daily)
        const participants: Array<{ name: string; raceData: Array<{ pred: number | null; accum: number | null }> }> = [];

        for (const membership of memberships) {
            const membershipId = membership.id;
            let name = 'Jugador';
            if (membership.guest_name) {
                name = membership.guest_name;
            } else if (Array.isArray(membership.profiles) && membership.profiles[0]?.display_name) {
                name = membership.profiles[0].display_name;
            }

            let cumulative = 0;
            const raceData: Array<{ pred: number | null; accum: number | null }> = [];

            for (const race of races) {
                const hasResult = race.status === 'result_published';

                const pred = (predictions || []).find((p: any) =>
                    p.race_id === race.id && (
                        p.membership_id === membershipId ||
                        (p.user_id && membershipsByUserId.get(p.user_id)?.id === membershipId)
                    )
                );
                const score = hasResult ? (scores || []).find((s: any) =>
                    s.race_id === race.id && (
                        s.membership_id === membershipId ||
                        (s.user_id && membershipsByUserId.get(s.user_id)?.id === membershipId)
                    )
                ) : null;

                const predNum = pred?.winner_entry?.program_number ?? null;

                let accum: number | null = null;
                if (hasResult) {
                    cumulative += score?.points_total || 0;
                    accum = cumulative;
                }

                raceData.push({ pred: predNum, accum });
            }

            participants.push({ name, raceData });
        }

        // Ordenar por último acumulado descendente
        participants.sort((a, b) => {
            const aLast = [...a.raceData].reverse().find(r => r.accum !== null)?.accum ?? 0;
            const bLast = [...b.raceData].reverse().find(r => r.accum !== null)?.accum ?? 0;
            return bLast - aLast;
        });

        // -- Formatear como texto para WhatsApp --
        const dateStr = raceDay.day_date
            ? new Date(raceDay.day_date + 'T12:00:00').toLocaleDateString('es-UY', { weekday: 'short', day: '2-digit', month: '2-digit' })
            : '';
        const publishedCount = races.filter((r: any) => r.status === 'result_published').length;

        // Encabezado de carreras: C1 C2 C3...
        const raceHeaders = races.map((r: any) => `C${r.seq}`);

        // Calcular ancho de columna de nombre (máximo 12 chars)
        const nameColW = Math.min(12, Math.max(...participants.map(p => p.name.length), 6));

        // Cada carrera ocupa 2 columnas: pred (2 chars) + acum (3 chars) → "P  A"
        // Formato por carrera: "##·## " → ej "5·12 " o "--·-- "
        const colW = 6; // "##·##" = max 5 chars + space

        const pad = (s: string, w: number) => s.length >= w ? s.substring(0, w) : s + ' '.repeat(w - s.length);
        const padLeft = (s: string, w: number) => s.length >= w ? s.substring(0, w) : ' '.repeat(w - s.length) + s;

        // Línea de encabezado de columnas
        let header = pad('JUGADOR', nameColW) + ' ';
        for (const h of raceHeaders) {
            header += pad(h, colW);
        }

        // Separador
        const sep = '-'.repeat(header.length);

        // Filas
        const rows = participants.map((p, idx) => {
            const pos = `${idx + 1}.`;
            const name = pad(`${pos}${p.name}`, nameColW);
            const cols = p.raceData.map(rd => {
                const pred = rd.pred !== null ? String(rd.pred) : '--';
                const accum = rd.accum !== null ? String(rd.accum) : '·';
                return pad(`${pred}·${accum}`, colW);
            });
            return name + ' ' + cols.join('');
        });

        const msg = [
            `🏇 *${penca.name}* - ${raceDay.day_name}`,
            dateStr ? `📅 ${dateStr} | carreras con resultado: ${publishedCount}/${races.length}` : `carreras con resultado: ${publishedCount}/${races.length}`,
            '',
            '```',
            header,
            sep,
            ...rows,
            '```',
        ].join('\n');

        return msg;
    } catch (err: any) {
        console.error('getDailySummaryText error:', err.message);
        return null;
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
        let whatsappResult: any = { skipped: true, reason: 'No hubo syncs reales' };
        if (synced.length > 0) {
            const now = new Date().toLocaleString('es-UY', { timeZone: 'America/Montevideo' });
            const messages: string[] = [];

            for (const r of synced) {
                if (r.status === 'success') {
                    const summary = await getDailySummaryText(supabaseAdmin, r.slug);
                    if (summary) {
                        messages.push(summary);
                    } else {
                        messages.push(`✅ ${r.slug} sincronizado (${now})`);
                    }
                } else {
                    messages.push(`❌ ${r.slug} - Error: ${(r as any).error?.substring(0, 100)}`);
                }
            }

            const fullMsg = messages.join('\n\n---\n\n');
            whatsappResult = await sendWhatsApp(fullMsg);
        }

        return NextResponse.json({
            processed_at,
            results,
            whatsapp: whatsappResult
        });

    } catch (error: any) {
        console.error('Error en Cron Global:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
