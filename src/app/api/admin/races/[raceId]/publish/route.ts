import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { raceId: string } }
) {
  const supabase = createRouteHandlerClient({ cookies });

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

  try {
    const body = await request.json();
    const { positions, raceId, pencaId } = body;

    // Obtener la carrera con su penca y ruleset activo
    const { data: race, error: raceError } = await supabase
      .from('races')
      .select(`
        *,
        penca:pencas!races_penca_id_fkey (
          id,
          rulesets (
            *
          )
        )
      `)
      .eq('id', raceId)
      .single();

    if (raceError || !race) {
      return NextResponse.json({ error: 'Carrera no encontrada' }, { status: 404 });
    }

    const activeRuleset = race.penca.rulesets?.find((r: any) => r.is_active);
    if (!activeRuleset) {
      return NextResponse.json({ error: 'No hay reglas activas' }, { status: 400 });
    }

    // Encontrar los entries que terminaron en los primeros 3 lugares
    const firstPlace = Object.entries(positions).find(([, pos]) => pos === 1)?.[0];
    const secondPlace = Object.entries(positions).find(([, pos]) => pos === 2)?.[0];
    const thirdPlace = Object.entries(positions).find(([, pos]) => pos === 3)?.[0];

    if (!firstPlace || !secondPlace || !thirdPlace) {
      return NextResponse.json(
        { error: 'Faltan los primeros 3 lugares' },
        { status: 400 }
      );
    }

    // Crear o actualizar el resultado de la carrera
    const { error: resultError } = await supabase
      .from('race_results')
      .upsert({
        race_id: raceId,
        first_place_entry_id: firstPlace,
        second_place_entry_id: secondPlace,
        third_place_entry_id: thirdPlace,
        published_at: new Date().toISOString(),
      }, {
        onConflict: 'race_id'
      });

    if (resultError) {
      console.error('Error creating result:', resultError);
      return NextResponse.json(
        { error: 'Error al guardar el resultado' },
        { status: 500 }
      );
    }

    // Actualizar el estado de la carrera a finished
    const { error: updateError } = await supabase
      .from('races')
      .update({ status: 'finished' })
      .eq('id', raceId);

    if (updateError) {
      console.error('Error updating race status:', updateError);
    }

    // Obtener todas las predicciones para esta carrera
    const { data: predictions, error: predError } = await supabase
      .from('predictions')
      .select('*')
      .eq('race_id', raceId);

    if (predError) {
      console.error('Error fetching predictions:', predError);
      return NextResponse.json(
        { error: 'Error al obtener predicciones' },
        { status: 500 }
      );
    }

    // Calcular puntos para cada predicción
    const pointsData = [];
    for (const prediction of predictions || []) {
      let points = 0;

      // Modalidad: Winner
      if (activeRuleset.modalities_enabled.includes('winner')) {
        if (prediction.winner_pick === firstPlace) {
          points += activeRuleset.points_top3.first;
        } else if (prediction.winner_pick === secondPlace) {
          points += activeRuleset.points_top3.second;
        } else if (prediction.winner_pick === thirdPlace) {
          points += activeRuleset.points_top3.third;
        }
      }

      // Aquí podrías agregar lógica para otras modalidades (exacta, trifecta, etc.)

      pointsData.push({
        prediction_id: prediction.id,
        points_earned: points,
      });

      // Actualizar los puntos en la predicción
      await supabase
        .from('predictions')
        .update({ 
          points_earned: points,
          scored_at: new Date().toISOString()
        })
        .eq('id', prediction.id);
    }

    return NextResponse.json({
      success: true,
      pointsCalculated: pointsData.length,
      message: 'Resultado publicado y puntos calculados',
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Error al procesar la solicitud' },
      { status: 500 }
    );
  }
}
