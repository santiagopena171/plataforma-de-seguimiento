import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const PRED_W = 44;   // ancho celda predicción
const PTS_W  = 52;   // ancho celda puntos acumulados (ligeramente más ancho)
const COL_W  = PRED_W + PTS_W;
const NAME_W = 160;
const ROW_H  = 40;
const HEADER_H = 46;
const PAD = 32;

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

    const raceIds = races.map((r: any) => r.id);

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

function renderImage(
    penca: { name: string },
    raceDay: { day_name: string },
    races: any[],
    participants: Array<{ name: string; raceData: Array<{ pred: number | null; accum: number | null }> }>
) {
    const numRaces = races.length;
    const tableW = NAME_W + numRaces * COL_W;
    const imgW = tableW + PAD * 2;
    const titleH = 100;
    const imgH = PAD * 2 + titleH + HEADER_H + participants.length * ROW_H + 36;
    const dayLabel = raceDay.day_name || '';

    return new ImageResponse(
        (
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: imgW,
                    height: imgH,
                    backgroundColor: '#ffffff',
                    paddingTop: PAD,
                    paddingBottom: PAD,
                    paddingLeft: PAD,
                    paddingRight: PAD,
                    fontFamily: 'sans-serif',
                }}
            >
                {/* ── TÍTULO ── */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ display: 'flex', fontSize: 30, fontWeight: 'bold', color: '#1e1b4b', letterSpacing: -0.5 }}>
                        {penca.name}
                    </div>
                    <div style={{ display: 'flex', fontSize: 15, color: '#6b7280', marginTop: 4 }}>
                        {dayLabel} - Resumen Diario
                    </div>
                    <div style={{ display: 'flex', width: tableW, height: 3, backgroundColor: '#4f46e5', marginTop: 10, borderRadius: 2 }}></div>
                </div>

                {/* ── TABLA ── */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>

                    {/* Header */}
                    <div style={{ display: 'flex', backgroundColor: '#312e81', height: HEADER_H, alignItems: 'center', borderRadius: '6px 6px 0 0' }}>
                        <div style={{ display: 'flex', width: NAME_W, paddingLeft: 12, color: '#e0e7ff', fontWeight: 'bold', fontSize: 13, letterSpacing: 1 }}>
                            NOMBRE
                        </div>
                        {races.map((race: any) => (
                            <div key={race.id} style={{ display: 'flex', width: COL_W, justifyContent: 'center', alignItems: 'center', color: '#e0e7ff', fontWeight: 'bold', fontSize: 15, borderLeftWidth: 1, borderLeftStyle: 'solid', borderLeftColor: '#4338ca' }}>
                                {race.seq}
                            </div>
                        ))}
                    </div>

                    {/* Filas */}
                    {participants.map((p, idx) => (
                        <div
                            key={idx}
                            style={{
                                display: 'flex',
                                height: ROW_H,
                                backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f5f5f5',
                                borderTopWidth: 1,
                                borderTopStyle: 'solid',
                                borderTopColor: '#e5e7eb',
                                alignItems: 'center',
                            }}
                        >
                            <div style={{ display: 'flex', width: NAME_W, paddingLeft: 10, paddingRight: 6, alignItems: 'center', gap: 6 }}>
                                <div style={{ display: 'flex', fontSize: 12, color: '#9ca3af', width: 20 }}>{idx + 1}.</div>
                                <div style={{ display: 'flex', fontSize: 14, color: '#1f2937', fontWeight: idx < 3 ? 'bold' : 'normal' }}>
                                    {p.name.length > 15 ? p.name.substring(0, 14) + '…' : p.name}
                                </div>
                            </div>
                            {p.raceData.map((rd, ri) => (
                                <div key={ri} style={{ display: 'flex', width: COL_W, height: ROW_H, borderLeftWidth: 1, borderLeftStyle: 'solid', borderLeftColor: '#e5e7eb', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', width: PRED_W, height: ROW_H, backgroundColor: rd.pred !== null ? '#4f6fce' : '#e9ecf5', justifyContent: 'center', alignItems: 'center', color: rd.pred !== null ? '#ffffff' : '#c0c8e0', fontWeight: 'bold', fontSize: 15 }}>
                                        {rd.pred !== null ? String(rd.pred) : ''}
                                    </div>
                                    <div style={{ display: 'flex', width: PTS_W, height: ROW_H, backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f5f5f5', justifyContent: 'center', alignItems: 'center', color: rd.accum !== null ? '#dc2626' : '#d1d5db', fontWeight: 'bold', fontSize: 15 }}>
                                        {rd.accum !== null ? String(rd.accum) : ''}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>

                {/* ── LEYENDA ── */}
                <div style={{ display: 'flex', marginTop: 10, fontSize: 12, color: '#6b7280', gap: 20, justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 14, height: 14, backgroundColor: '#4f6fce', borderRadius: 3 }}></div>
                        <div style={{ display: 'flex' }}>Predicción</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 14, height: 14, backgroundColor: '#fee2e2', borderRadius: 3, borderWidth: 1, borderStyle: 'solid', borderColor: '#fca5a5' }}></div>
                        <div style={{ display: 'flex', color: '#dc2626' }}>Puntos Acumulados</div>
                    </div>
                </div>
            </div>
        ),
        { width: imgW, height: imgH }
    );
}

export async function GET(
    req: NextRequest,
    { params }: { params: { slug: string } }
) {
    // Modo preview: genera imagen con datos de muestra para verificar el diseño
    const isPreview = req.nextUrl.searchParams.get('preview') === '1';
    if (isPreview) {
        const mockParticipants = [
            { name: 'oveja negra 2',  raceData: [1,2,3,4,5,6,7,8].map((_, i) => ({ pred: i+1,       accum: (i+1)*11 })) },
            { name: 'capi',           raceData: [1,2,3,4,5,6,7,8].map((_, i) => ({ pred: 8-i,        accum: i < 2 ? 13 : (i*10)+3 })) },
            { name: 'oveja negra 1',  raceData: [1,2,3,4,5,6,7,8].map((_, i) => ({ pred: i%8+1,      accum: i < 1 ? 13 : i*8 })) },
            { name: 'negroni',        raceData: [1,2,3,4,5,6,7,8].map((_, i) => ({ pred: (i*3)%8+1,  accum: i*7 })) },
            { name: 'mega quick',     raceData: [1,2,3,4,5,6,7,8].map((_, i) => ({ pred: i+1,        accum: i*5+4 })) },
            { name: 'michelotto',     raceData: [1,2,3,4,5,6,7,8].map((_, i) => ({ pred: (i+4)%8+1,  accum: i*5+5 })) },
            { name: 'chito',          raceData: [1,2,3,4,5,6,7,8].map((_, i) => ({ pred: i+1,        accum: i*4+4 })) },
            { name: 'mestre caveira', raceData: [1,2,3,4,5,6,7,8].map((_, i) => ({ pred: (i+2)%8+1,  accum: i*4+7 })) },
            { name: 'palomo',         raceData: [1,2,3,4,5,6,7,8].map((_, i) => ({ pred: (i+5)%8+1,  accum: i*2+2 })) },
            { name: 'loba',           raceData: [1,2,3,4,5,6,7,8].map((_, i) => ({ pred: (i+6)%8+1,  accum: i*2+7 })) },
        ];
        const mockRaces = [1,2,3,4,5,6,7,8].map(n => ({ id: n, seq: n, status: 'result_published' }));
        return renderImage({ name: 'paysandu 28' }, { day_name: 'sabado 28' }, mockRaces, mockParticipants);
    }

    try {
        const data = await fetchDailySummary(params.slug);
        if (!data) {
            return NextResponse.json({
                error: 'No data found',
                slug: params.slug,
                hint: 'Check that the penca slug exists, has race days, published races, and player memberships',
            }, { status: 404 });
        }

        const { penca, raceDay, races, participants } = data;

        try {
            return renderImage(penca, raceDay, races, participants);
        } catch (imgErr: any) {
            console.error('ImageResponse error:', imgErr);
            return NextResponse.json({
                error: 'ImageResponse failed: ' + imgErr.message,
                stack: imgErr.stack?.substring(0, 800),
            }, { status: 500 });
        }
    } catch (err: any) {
        console.error('daily-image error:', err);
        return NextResponse.json({ error: err.message, stack: err.stack?.substring(0, 500) }, { status: 500 });
    }
}
