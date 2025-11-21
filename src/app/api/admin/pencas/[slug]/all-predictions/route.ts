import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

export async function GET(
    req: NextRequest,
    { params }: { params: { slug: string } }
) {
    const supabase = createServerComponentClient({ cookies });

    // Verificar autenticación
    const {
        data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar que sea admin
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

    if (profile?.role !== 'admin') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Crear cliente admin para bypass RLS
    const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        }
    );

    try {
        // Obtener la penca
        const { data: penca, error: pencaError } = await adminClient
            .from('pencas')
            .select('id, name')
            .eq('slug', params.slug)
            .single();

        if (pencaError || !penca) {
            return NextResponse.json({ error: 'Penca no encontrada' }, { status: 404 });
        }

        // Obtener carreras
        const { data: races } = await adminClient
            .from('races')
            .select('id, seq, venue, distance_m')
            .eq('penca_id', penca.id)
            .order('seq', { ascending: true });

        if (!races) {
            return NextResponse.json({ races: [], participants: [] });
        }

        // Obtener memberships (participantes)
        const { data: memberships } = await adminClient
            .from('memberships')
            .select(`
        id,
        user_id,
        guest_name
      `)
            .eq('penca_id', penca.id);

        // Obtener perfiles de usuarios para los nombres
        const userIds = memberships?.filter((m: any) => m.user_id)?.map((m: any) => m.user_id) || [];
        let userProfiles: Record<string, any> = {};

        if (userIds.length > 0) {
            const { data: profiles } = await adminClient
                .from('profiles')
                .select('id, email, full_name')
                .in('id', userIds);

            profiles?.forEach((p: any) => {
                userProfiles[p.id] = p;
            });
        }

        // Obtener todas las predicciones
        const { data: predictions } = await adminClient
            .from('predictions')
            .select('*')
            .in('race_id', races.map(r => r.id));

        // Obtener todos los caballos (entries) para resolver nombres
        const { data: entries } = await adminClient
            .from('race_entries')
            .select('id, race_id, program_number, label')
            .in('race_id', races.map(r => r.id));

        // Procesar participantes
        const participants = memberships?.map((m: any) => {
            let name = '';
            if (m.guest_name) {
                name = m.guest_name;
            } else if (m.user_id && userProfiles[m.user_id]) {
                const p = userProfiles[m.user_id];
                name = p.full_name || p.email || 'Usuario registrado';
            }

            const playerPredictions: Record<string, string> = {};

            races.forEach(race => {
                const pred = predictions?.find((p: any) =>
                    p.race_id === race.id &&
                    (p.membership_id === m.id || (p.user_id && p.user_id === m.user_id))
                );

                if (pred) {
                    const entry = entries?.find((e: any) => e.id === pred.winner_pick);
                    if (entry) {
                        // Format: Caballo #Number
                        playerPredictions[race.id] = `Caballo #${entry.program_number}`;
                    } else {
                        playerPredictions[race.id] = '-';
                    }
                } else {
                    playerPredictions[race.id] = '-';
                }
            });

            return {
                id: m.id,
                name,
                predictions: playerPredictions
            };
        }) || [];

        // Filtrar participantes sin nombre y ordenar por nombre
        const validParticipants = participants.filter(p => p.name !== '');
        validParticipants.sort((a, b) => a.name.localeCompare(b.name));

        return NextResponse.json({
            pencaName: penca.name,
            races: races.map(r => ({
                id: r.id,
                name: `Carrera ${r.seq} - ${r.venue}`,
                seq: r.seq
            })),
            participants: validParticipants
        });

    } catch (err) {
        console.error('Error fetching all predictions:', err);
        return NextResponse.json(
            { error: 'Error al obtener las predicciones' },
            { status: 500 }
        );
    }
}
