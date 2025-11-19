import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

export async function GET(
    req: NextRequest,
    { params }: { params: { raceId: string } }
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
        // Obtener la carrera con información de la penca
        const { data: race, error: raceError } = await adminClient
            .from('races')
            .select(`
        id,
        seq,
        venue,
        distance_m,
        start_at,
        penca_id,
        pencas (
          id,
          name,
          slug
        )
      `)
            .eq('id', params.raceId)
            .single();

        if (raceError || !race) {
            return NextResponse.json({ error: 'Carrera no encontrada' }, { status: 404 });
        }

        // Obtener el resultado oficial
        const { data: raceResult } = await adminClient
            .from('race_results')
            .select('*')
            .eq('race_id', params.raceId)
            .single();

        // Obtener los caballos de la carrera
        const { data: entries } = await adminClient
            .from('race_entries')
            .select('*')
            .eq('race_id', params.raceId)
            .order('program_number', { ascending: true });

        // Obtener todas las predicciones de esta carrera
        const { data: predictions } = await adminClient
            .from('predictions')
            .select('*')
            .eq('race_id', params.raceId);

        // Obtener scores de esta carrera
        const { data: scores } = await adminClient
            .from('scores')
            .select('*')
            .eq('race_id', params.raceId);

        // Obtener memberships de la penca
        const { data: memberships } = await adminClient
            .from('memberships')
            .select(`
        id,
        user_id,
        guest_name,
        role
      `)
            .eq('penca_id', race.penca_id);

        // Obtener perfiles de usuarios
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

        // Mapear resultado oficial con nombres de caballos
        const officialResult = raceResult?.official_order?.slice(0, 3).map((entryId: string, index: number) => {
            const entry = entries?.find((e: any) => e.id === entryId);
            return {
                position: index + 1,
                number: entry?.program_number || '?',
                label: entry?.label || `Caballo #${entry?.program_number || '?'}`,
            };
        }) || [];

        // Log para debugging
        console.log('=== DEBUG RESULTS DATA ===');
        console.log('Race ID:', params.raceId);
        console.log('Total predictions:', predictions?.length);
        console.log('Total scores:', scores?.length);
        if (predictions && predictions.length > 0) {
            console.log('Sample prediction:', JSON.stringify(predictions[0], null, 2));
        }
        if (scores && scores.length > 0) {
            console.log('Sample score:', JSON.stringify(scores[0], null, 2));
        }

        // Mapear predicciones con nombres de jugadores y puntos
        const predictionsWithScores = predictions?.map((pred: any) => {
            // Buscar membership
            let membership = memberships?.find((m: any) => m.id === pred.membership_id);
            if (!membership && pred.user_id) {
                membership = memberships?.find((m: any) => m.user_id === pred.user_id);
            }

            let playerName = 'Desconocido';
            if (membership) {
                if (membership.guest_name) {
                    playerName = membership.guest_name;
                } else if (membership.user_id && userProfiles[membership.user_id]) {
                    const profile = userProfiles[membership.user_id];
                    playerName = profile.full_name || profile.email || 'Usuario registrado';
                }
            }

            // Encontrar el caballo predicho
            const winnerEntry = entries?.find((e: any) => e.id === pred.winner_pick);

            // Encontrar el score - buscar por membership_id primero, luego por user_id
            let score = null;
            if (pred.membership_id) {
                score = scores?.find((s: any) => s.membership_id === pred.membership_id);
            }
            if (!score && pred.user_id) {
                score = scores?.find((s: any) => s.user_id === pred.user_id);
            }

            return {
                playerName,
                winnerNumber: winnerEntry?.program_number || 'N/A',
                winnerLabel: winnerEntry?.label || `Caballo #${winnerEntry?.program_number || '?'}`,
                points: score?.points_total || 0,
                breakdown: score?.breakdown || {},
            };
        }) || [];

        // Ordenar por puntos (mayor a menor)
        predictionsWithScores.sort((a, b) => b.points - a.points);

        console.log('Predictions with scores (first 3):', JSON.stringify(predictionsWithScores.slice(0, 3), null, 2));
        console.log('========================');

        return NextResponse.json({
            race: {
                seq: race.seq,
                venue: race.venue,
                distance_m: race.distance_m,
                start_at: race.start_at,
                pencaName: (race.pencas as any).name,
            },
            officialResult,
            predictions: predictionsWithScores,
        });
    } catch (err) {
        console.error('Error fetching results data:', err);
        return NextResponse.json(
            { error: 'Error al obtener los resultados' },
            { status: 500 }
        );
    }
}
