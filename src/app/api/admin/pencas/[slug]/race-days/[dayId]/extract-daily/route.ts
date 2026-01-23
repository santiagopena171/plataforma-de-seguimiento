import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string; dayId: string } }
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

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  try {
    // Obtener la penca
    const { data: penca, error: pencaError } = await supabaseAdmin
      .from('pencas')
      .select('id, name')
      .eq('slug', params.slug)
      .single();

    if (pencaError || !penca) {
      return NextResponse.json({ error: 'Penca no encontrada' }, { status: 404 });
    }

    // Obtener el día de carrera
    const { data: raceDay, error: raceDayError } = await supabaseAdmin
      .from('race_days')
      .select('*')
      .eq('id', params.dayId)
      .eq('penca_id', penca.id)
      .single();

    if (raceDayError || !raceDay) {
      return NextResponse.json({ error: 'Día de carrera no encontrado' }, { status: 404 });
    }

    // Obtener todas las carreras del día, ordenadas por seq
    const { data: races, error: racesError } = await supabaseAdmin
      .from('races')
      .select('*')
      .eq('race_day_id', params.dayId)
      .order('seq', { ascending: true });

    if (racesError) {
      throw racesError;
    }

    if (!races || races.length === 0) {
      return NextResponse.json({
        pencaName: penca.name,
        dayName: raceDay.day_name,
        dayDate: raceDay.day_date,
        races: [],
        participants: [],
      });
    }

    const raceIds = races.map(r => r.id);

    // Obtener todos los memberships de la penca
    const { data: memberships, error: membershipsError } = await supabaseAdmin
      .from('memberships')
      .select(`
        id,
        user_id,
        guest_name,
        profiles (
          display_name
        )
      `)
      .eq('penca_id', penca.id)
      .eq('role', 'player');

    if (membershipsError) {
      console.error('Error fetching memberships:', membershipsError);
      throw membershipsError;
    }

    // Crear mapa de memberships
    const membershipsMap = new Map(
      (memberships || []).map(m => [m.id, m])
    );

    // También crear mapa por user_id para usuarios registrados
    const membershipsByUserId = new Map(
      (memberships || []).filter(m => m.user_id).map(m => [m.user_id!, m])
    );

    // Obtener todas las predicciones de las carreras del día
    const { data: predictions, error: predictionsError } = await supabaseAdmin
      .from('predictions')
      .select(`
        *,
        winner_entry:race_entries!predictions_winner_pick_fkey (
          id,
          program_number
        )
      `)
      .in('race_id', raceIds);

    if (predictionsError) {
      console.error('Error fetching predictions:', predictionsError);
      throw predictionsError;
    }

    // Obtener los scores de todas las carreras del día
    const { data: scores, error: scoresError } = await supabaseAdmin
      .from('scores')
      .select('*')
      .in('race_id', raceIds);

    if (scoresError) {
      console.error('Error fetching scores:', scoresError);
      throw scoresError;
    }

    console.log('Scores fetched:', scores?.length);
    console.log('Predictions fetched:', predictions?.length);

    // Crear estructura de datos para cada participante
    const participantsMap = new Map<string, {
      membershipId: string;
      name: string;
      raceData: Array<{
        raceId: string;
        prediction: number | null;
        accumulatedPoints: number;
      }>;
    }>();

    // Inicializar todos los participantes
    memberships?.forEach(membership => {
      const membershipId = membership.id;
      let name = 'Usuario desconocido';
      
      if (membership.guest_name) {
        name = membership.guest_name;
      } else if (membership.profiles && Array.isArray(membership.profiles) && membership.profiles[0]?.display_name) {
        name = membership.profiles[0].display_name;
      }

      participantsMap.set(membershipId, {
        membershipId,
        name,
        raceData: [],
      });
    });

    // Procesar cada carrera para agregar predicciones y puntos acumulados
    let cumulativeScoresByParticipant = new Map<string, number>();

    races.forEach(race => {
      // Verificar si la carrera tiene resultado publicado
      const hasResult = race.status === 'result_published';
      
      // Obtener predicciones de esta carrera
      const racePredictions = (predictions || []).filter(p => p.race_id === race.id);
      
      // Obtener scores de esta carrera (solo si tiene resultado)
      const raceScores = hasResult ? (scores || []).filter(s => s.race_id === race.id) : [];

      // Para cada participante, agregar datos de esta carrera
      participantsMap.forEach((participant, membershipId) => {
        // Buscar predicción de este participante para esta carrera
        const prediction = racePredictions.find(
          p => p.membership_id === membershipId || (p.user_id && membershipsByUserId.has(p.user_id) && membershipsByUserId.get(p.user_id)?.id === membershipId)
        );

        // Solo buscar score si la carrera tiene resultado publicado
        let score = null;
        if (hasResult) {
          score = raceScores.find(
            s => s.membership_id === membershipId || (s.user_id && membershipsByUserId.has(s.user_id) && membershipsByUserId.get(s.user_id)?.id === membershipId)
          );
        }

        // Actualizar puntos acumulados solo si la carrera tiene resultado
        let newCumulative = null;
        if (hasResult) {
          const currentScore = score?.points_total || 0;
          const previousCumulative = cumulativeScoresByParticipant.get(membershipId) || 0;
          newCumulative = previousCumulative + currentScore;
          cumulativeScoresByParticipant.set(membershipId, newCumulative);
        }

        // Obtener el program_number de la predicción
        let predictionNumber = null;
        if (prediction?.winner_entry && typeof prediction.winner_entry === 'object') {
          predictionNumber = prediction.winner_entry.program_number;
        }

        // Agregar datos de esta carrera
        participant.raceData.push({
          raceId: race.id,
          prediction: predictionNumber,
          accumulatedPoints: newCumulative, // null si no tiene resultado, número si tiene resultado
        });
      });
    });

    // Convertir el mapa a array y ordenar por puntos finales (descendente)
    const participants = Array.from(participantsMap.values())
      .sort((a, b) => {
        // Buscar el último puntaje no-null para ordenar correctamente
        const aFinalPoints = a.raceData.reverse().find(rd => rd.accumulatedPoints !== null)?.accumulatedPoints || 0;
        const bFinalPoints = b.raceData.reverse().find(rd => rd.accumulatedPoints !== null)?.accumulatedPoints || 0;
        a.raceData.reverse(); // restaurar orden original
        b.raceData.reverse(); // restaurar orden original
        return bFinalPoints - aFinalPoints;
      });

    console.log('\n=== DAILY SUMMARY ===');
    console.log('Total participants:', participants.length);
    console.log('Total races:', races.length);
    console.log('=====================\n');

    return NextResponse.json({
      pencaName: penca.name,
      dayName: raceDay.day_name,
      dayDate: raceDay.day_date,
      races: races.map(r => ({ id: r.id, seq: r.seq })),
      participants,
    });
  } catch (err) {
    console.error('Error fetching daily summary:', err);
    const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);
    return NextResponse.json(
      { error: `Error al obtener el resumen diario: ${errorMessage}` },
      { status: 500 }
    );
  }
}
