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

    // Obtener todas las carreras del día
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
        totals: [],
      });
    }

    const raceIds = races.map(r => r.id);

    // Obtener los resultados de las carreras
    const { data: raceResults, error: resultsError } = await supabaseAdmin
      .from('race_results')
      .select('*')
      .in('race_id', raceIds);

    if (resultsError) {
      console.error('Error fetching race results:', resultsError);
      throw resultsError;
    }

    console.log('Race results fetched:', raceResults?.length);
    if (raceResults && raceResults.length > 0) {
      console.log('Sample race result:', raceResults[0]);
    }

    // Obtener todas las race_entries para poder mapear los resultados
    const entryIds = (raceResults || []).flatMap(r => r.official_order || []).filter(Boolean);

    const { data: raceEntries } = await supabaseAdmin
      .from('race_entries')
      .select('id, program_number, label')
      .in('id', entryIds);

    const entriesMap = new Map((raceEntries || []).map(e => [e.id, e]));

    // Mapear resultados con nombres de caballos
    const raceResultsWithNames = (raceResults || []).map(r => {
      const officialOrder = r.official_order || [];
      return {
        ...r,
        first: entriesMap.get(officialOrder[0]),
        second: entriesMap.get(officialOrder[1]),
        third: entriesMap.get(officialOrder[2]),
        fourth: entriesMap.get(officialOrder[3]),
      };
    });

    const raceResultsMap = new Map(raceResultsWithNames.map(r => [r.race_id, r]));

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

    // Procesar las carreras
    const racesData = races.map(race => {
      const raceScores = (scores || []).filter(s => s.race_id === race.id);
      const hasResults = raceResultsMap.has(race.id);
      const raceResult = raceResultsMap.get(race.id);

      console.log(`\n--- Processing Race #${race.seq} (id: ${race.id}) ---`);
      console.log(`Scores for this race:`, raceScores.length);

      const scoresWithNames = raceScores.map(score => {
        // Obtener membership por membership_id o user_id
        let membership = null;
        if (score.membership_id) {
          membership = membershipsMap.get(score.membership_id);
        } else if (score.user_id) {
          membership = membershipsByUserId.get(score.user_id);
        }

        let playerName = 'Usuario desconocido';
        let membershipId = score.membership_id;
        
        if (membership) {
          if (membership.guest_name) {
            playerName = membership.guest_name;
          } else if (membership.profiles && Array.isArray(membership.profiles) && membership.profiles[0]?.display_name) {
            playerName = membership.profiles[0].display_name;
          }
          membershipId = membership.id;
        }

        console.log(`  - ${playerName}: ${score.points_total || 0} pts (membership: ${membershipId})`);

        return {
          playerName,
          points: score.points_total || 0,
          membershipId: membershipId || score.user_id, // Fallback a user_id si no hay membership
        };
      });

      // Ordenar por puntos descendente
      scoresWithNames.sort((a, b) => b.points - a.points);

      // Preparar resultado oficial
      let officialResult = null;
      if (hasResults && raceResult) {
        officialResult = {
          first: raceResult.first ? `#${raceResult.first.program_number}` : null,
          second: raceResult.second ? `#${raceResult.second.program_number}` : null,
          third: raceResult.third ? `#${raceResult.third.program_number}` : null,
          fourth: raceResult.fourth ? `#${raceResult.fourth.program_number}` : null,
        };
      }

      return {
        seq: race.seq,
        venue: race.venue,
        distance_m: race.distance_m,
        hasResults,
        scores: scoresWithNames,
        officialResult,
      };
    });

    // Calcular totales por jugador sumando los puntos de cada carrera del día
    const totalsMap = new Map<string, { playerName: string; totalPoints: number; membershipId: string }>();

    // Inicializar con todos los jugadores que tienen scores en este día
    scores?.forEach(score => {
      // Obtener membership por membership_id o user_id
      let membership = null;
      if (score.membership_id) {
        membership = membershipsMap.get(score.membership_id);
      } else if (score.user_id) {
        membership = membershipsByUserId.get(score.user_id);
      }

      let playerName = 'Usuario desconocido';
      let membershipId = score.membership_id;
      
      if (membership) {
        if (membership.guest_name) {
          playerName = membership.guest_name;
        } else if (membership.profiles && Array.isArray(membership.profiles) && membership.profiles[0]?.display_name) {
          playerName = membership.profiles[0].display_name;
        }
        membershipId = membership.id;
      }

      const key = membershipId || score.user_id;
      if (key && !totalsMap.has(key)) {
        totalsMap.set(key, {
          playerName,
          totalPoints: 0,
          membershipId: key,
        });
      }
    });

    // Sumar los puntos de cada carrera del día
    scores?.forEach(score => {
      const key = score.membership_id || score.user_id;
      const player = totalsMap.get(key);
      if (player) {
        player.totalPoints += score.points_total || 0;
      }
    });

    const totals = Array.from(totalsMap.values());
    totals.sort((a, b) => b.totalPoints - a.totalPoints);

    console.log('\n=== TOTALS SUMMARY ===');
    console.log('Total players:', totals.length);
    totals.forEach((t, i) => {
      console.log(`${i + 1}. ${t.playerName}: ${t.totalPoints} pts (membership: ${t.membershipId})`);
    });
    console.log('======================\n');

    return NextResponse.json({
      pencaName: penca.name,
      dayName: raceDay.day_name,
      dayDate: raceDay.day_date,
      races: racesData,
      totals,
    });
  } catch (err) {
    console.error('Error fetching race day summary:', err);
    const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);
    return NextResponse.json(
      { error: `Error al obtener el resumen: ${errorMessage}` },
      { status: 500 }
    );
  }
}
