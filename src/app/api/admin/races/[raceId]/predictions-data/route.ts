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

        // Obtener todas las predicciones de esta carrera
        const { data: predictions, error: predsError } = await adminClient
            .from('predictions')
            .select('*')
            .eq('race_id', params.raceId);

        if (predsError) {
            throw predsError;
        }

        // Obtener los caballos de la carrera
        const { data: entries, error: entriesError } = await adminClient
            .from('race_entries')
            .select('*')
            .eq('race_id', params.raceId)
            .order('program_number', { ascending: true });

        if (entriesError) {
            throw entriesError;
        }

        // Obtener memberships de la penca
        const { data: memberships, error: membershipsError } = await adminClient
            .from('memberships')
            .select(`
        id,
        user_id,
        guest_name,
        role
      `)
            .eq('penca_id', race.penca_id);

        if (membershipsError) {
            throw membershipsError;
        }

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

        // Mapear predicciones con nombres de jugadores
        const predictionsWithNames = predictions?.map((pred: any) => {
            // Buscar membership por membership_id primero, luego por user_id
            let membership = memberships?.find((m: any) => m.id === pred.membership_id);

            // Si no se encontró por membership_id, buscar por user_id
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

            return {
                playerName,
                winnerNumber: winnerEntry?.program_number || 'N/A',
                winnerLabel: winnerEntry?.label || `Caballo #${winnerEntry?.program_number || '?'}`,
                // Debug info
                predictionId: pred.id,
                membershipId: pred.membership_id,
                userId: pred.user_id,
                foundMembership: !!membership,
            };
        }) || [];

        // Log para debugging
        console.log('Predictions data:', {
            totalPredictions: predictions?.length,
            totalMemberships: memberships?.length,
            predictionsWithNames: predictionsWithNames.map(p => ({
                name: p.playerName,
                membershipId: p.membershipId,
                userId: p.userId,
                foundMembership: p.foundMembership,
            })),
        });

        return NextResponse.json({
            race: {
                seq: race.seq,
                venue: race.venue,
                distance_m: race.distance_m,
                start_at: race.start_at,
                pencaName: race.pencas.name,
            },
            predictions: predictionsWithNames,
        });
    } catch (err) {
        console.error('Error fetching predictions data:', err);
        return NextResponse.json(
            { error: 'Error al obtener las predicciones' },
            { status: 500 }
        );
    }
}
