import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

const CELL_W = 38;   // px por celda (pred o acum)
const NAME_W = 130;  // px para columna de nombre
const ROW_H = 28;    // px por fila
const HEADER_H = 56; // px para encabezado de carrera (2 líneas)
const FONT_SIZE = 13;
const PAD = 20;

async function fetchDailySummary(slug: string) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: penca } = await supabase
        .from('pencas').select('id, name').eq('slug', slug).single();
    if (!penca) return null;

    const { data: raceDays } = await supabase
        .from('race_days').select('id, day_name, day_date')
        .eq('penca_id', penca.id).order('day_date', { ascending: false });
    if (!raceDays || raceDays.length === 0) return null;

    // Elegir el race_day más reciente con al menos una carrera con resultado
    let raceDay = raceDays[0];
    for (const rd of raceDays) {
        const { data: published } = await supabase
            .from('races').select('id').eq('race_day_id', rd.id)
            .eq('status', 'result_published').limit(1);
        if (published && published.length > 0) { raceDay = rd; break; }
    }

    const { data: races } = await supabase
        .from('races').select('id, seq, status')
        .eq('race_day_id', raceDay.id).order('seq', { ascending: true });
    if (!races || races.length === 0) return null;

    const raceIds = races.map(r => r.id);

    const { data: memberships } = await supabase
        .from('memberships')
        .select('id, user_id, guest_name, profiles(display_name)')
        .eq('penca_id', penca.id).eq('role', 'player');
    if (!memberships || memberships.length === 0) return null;

    const { data: predictions } = await supabase
        .from('predictions')
        .select('race_id, membership_id, user_id, winner_entry:race_entries!predictions_winner_pick_fkey(program_number)')
        .in('race_id', raceIds);

    const { data: scores } = await supabase
        .from('scores').select('race_id, membership_id, user_id, points_total')
        .in('race_id', raceIds);

    const membershipsByUserId = new Map(
        memberships.filter((m: any) => m.user_id).map((m: any) => [m.user_id, m])
    );

    const participants: Array<{ name: string; raceData: Array<{ pred: number | null; accum: number | null }> }> = [];

    for (const membership of memberships) {
        const mId = membership.id;
        let name = 'Jugador';
        if (membership.guest_name) name = membership.guest_name;
        else if (Array.isArray(membership.profiles) && membership.profiles[0]?.display_name)
            name = membership.profiles[0].display_name;

        let cumulative = 0;
        const raceData: Array<{ pred: number | null; accum: number | null }> = [];

        for (const race of races) {
            const hasResult = race.status === 'result_published';
            const pred = (predictions || []).find((p: any) =>
                p.race_id === race.id && (p.membership_id === mId || (p.user_id && membershipsByUserId.get(p.user_id)?.id === mId))
            );
            const score = hasResult ? (scores || []).find((s: any) =>
                s.race_id === race.id && (s.membership_id === mId || (s.user_id && membershipsByUserId.get(s.user_id)?.id === mId))
            ) : null;
            const predNum = (pred?.winner_entry as any)?.program_number ?? null;
            let accum: number | null = null;
            if (hasResult) { cumulative += score?.points_total || 0; accum = cumulative; }
            raceData.push({ pred: predNum, accum });
        }
        participants.push({ name, raceData });
    }

    participants.sort((a, b) => {
        const aLast = [...a.raceData].reverse().find(r => r.accum !== null)?.accum ?? 0;
        const bLast = [...b.raceData].reverse().find(r => r.accum !== null)?.accum ?? 0;
        return bLast - aLast;
    });

    return { penca, raceDay, races, participants };
}

export async function GET(
    req: NextRequest,
    { params }: { params: { slug: string } }
) {
    try {
        const data = await fetchDailySummary(params.slug);
        if (!data) {
            return new Response('No data', { status: 404 });
        }

        const { penca, raceDay, races, participants } = data;

        const numRaces = races.length;
        const tableW = NAME_W + numRaces * CELL_W * 2;
        const imgW = tableW + PAD * 2;
        const imgH = PAD * 2 + 60 + 20 + HEADER_H + ROW_H + participants.length * ROW_H + 10;

        const dateStr = raceDay.day_date
            ? new Date(raceDay.day_date + 'T12:00:00').toLocaleDateString('es-UY', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
            : '';
        const publishedCount = races.filter((r: any) => r.status === 'result_published').length;

        const image = new ImageResponse(
            (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        width: imgW,
                        minHeight: imgH,
                        backgroundColor: '#f9fafb',
                        padding: PAD,
                        fontFamily: 'monospace',
                    }}
                >
                    {/* Encabezado */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 12 }}>
                        <div style={{ fontSize: 20, fontWeight: 'bold', color: '#1f2937' }}>🏇 {penca.name}</div>
                        <div style={{ fontSize: 14, color: '#4b5563' }}>{raceDay.day_name}{dateStr ? ` — ${dateStr}` : ''}</div>
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>Carreras con resultado: {publishedCount}/{races.length}</div>
                    </div>

                    {/* Tabla */}
                    <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid #d1d5db', borderRadius: 6, overflow: 'hidden' }}>

                        {/* Header fila 1: columna JUGADOR + headers de carrera (colspan 2) */}
                        <div style={{ display: 'flex', backgroundColor: '#4f46e5' }}>
                            <div style={{ width: NAME_W, padding: '4px 8px', color: 'white', fontWeight: 'bold', fontSize: 12 }}>JUGADOR</div>
                            {races.map((race: any) => (
                                <div key={race.id} style={{ display: 'flex', width: CELL_W * 2, justifyContent: 'center', alignItems: 'center', color: 'white', fontWeight: 'bold', fontSize: 12, borderLeft: '1px solid #6366f1' }}>
                                    C{race.seq}
                                </div>
                            ))}
                        </div>

                        {/* Header fila 2: pred / pts por carrera */}
                        <div style={{ display: 'flex', backgroundColor: '#6366f1' }}>
                            <div style={{ width: NAME_W, padding: '2px 8px', fontSize: 10, color: '#c7d2fe' }}></div>
                            {races.map((race: any) => (
                                <div key={race.id} style={{ display: 'flex', width: CELL_W * 2, borderLeft: '1px solid #818cf8' }}>
                                    <div style={{ display: 'flex', width: CELL_W, justifyContent: 'center', fontSize: 10, color: '#bfdbfe' }}>pred</div>
                                    <div style={{ display: 'flex', width: CELL_W, justifyContent: 'center', fontSize: 10, color: '#fecaca' }}>pts</div>
                                </div>
                            ))}
                        </div>

                        {/* Filas de participantes */}
                        {participants.map((p, idx) => (
                            <div
                                key={idx}
                                style={{
                                    display: 'flex',
                                    height: ROW_H,
                                    backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f3f4f6',
                                    borderTop: '1px solid #e5e7eb',
                                    alignItems: 'center',
                                }}
                            >
                                {/* Nombre con posición */}
                                <div style={{ display: 'flex', width: NAME_W, padding: '0 8px', fontSize: FONT_SIZE, color: '#1f2937', fontWeight: idx < 3 ? 'bold' : 'normal', overflow: 'hidden' }}>
                                    <span style={{ color: '#6b7280', marginRight: 4, minWidth: 18 }}>{idx + 1}.</span>
                                    <span style={{ overflow: 'hidden' }}>{p.name.length > 14 ? p.name.substring(0, 13) + '…' : p.name}</span>
                                </div>

                                {/* Celdas por carrera */}
                                {p.raceData.map((rd, ri) => (
                                    <div key={ri} style={{ display: 'flex', width: CELL_W * 2, borderLeft: '1px solid #e5e7eb', height: '100%', alignItems: 'center' }}>
                                        {/* Predicción (azul) */}
                                        <div style={{ display: 'flex', width: CELL_W, height: '100%', backgroundColor: rd.pred !== null ? '#3b82f6' : '#e5e7eb', justifyContent: 'center', alignItems: 'center', color: rd.pred !== null ? 'white' : '#9ca3af', fontWeight: 'bold', fontSize: FONT_SIZE }}>
                                            {rd.pred !== null ? String(rd.pred) : '—'}
                                        </div>
                                        {/* Puntos acumulados (blanco con texto rojo) */}
                                        <div style={{ display: 'flex', width: CELL_W, height: '100%', backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center', color: rd.accum !== null ? '#dc2626' : '#d1d5db', fontWeight: 'bold', fontSize: FONT_SIZE, borderLeft: '1px solid #f3f4f6' }}>
                                            {rd.accum !== null ? String(rd.accum) : ''}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>

                    {/* Leyenda */}
                    <div style={{ display: 'flex', marginTop: 8, fontSize: 11, color: '#9ca3af', gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <div style={{ width: 12, height: 12, backgroundColor: '#3b82f6', borderRadius: 2 }}></div>
                            <span>Predicción</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <div style={{ width: 12, height: 12, backgroundColor: '#fee2e2', borderRadius: 2, border: '1px solid #fca5a5' }}></div>
                            <span style={{ color: '#dc2626' }}>Pts acumulados</span>
                        </div>
                    </div>
                </div>
            ),
            {
                width: imgW,
                height: imgH,
            }
        );

        return image;
    } catch (err: any) {
        console.error('daily-image error:', err);
        return new Response('Error generating image: ' + err.message, { status: 500 });
    }
}
