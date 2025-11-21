import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    const body = await request.json();
    const { positions, raceId, pencaId } = body;

    // Obtener la carrera con su penca y ruleset activo
    const { data: race, error: raceError } = await adminClient
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
    const fourthPlace = Object.entries(positions).find(([, pos]) => pos === 4)?.[0];

    if (!firstPlace || !secondPlace || !thirdPlace || !fourthPlace) {
      return NextResponse.json(
        { error: 'Faltan los primeros 4 lugares' },
        { status: 400 }
      );
    }

    // Crear o actualizar el resultado de la carrera
    const { error: resultError } = await adminClient
      .from('race_results')
      .upsert({
        race_id: raceId,
        official_order: [firstPlace, secondPlace, thirdPlace, fourthPlace],
        published_at: new Date().toISOString(),
        published_by: session.user.id,
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

    // Actualizar el estado de la carrera a result_published
    const { error: updateError } = await adminClient
      .from('races')
      .update({ status: 'result_published' })
      .eq('id', raceId);

    if (updateError) {
      console.error('Error updating race status:', updateError);
    }

    // Calcular puntos para cada predicción usando helper compartido
    try {
      const officialOrder = [firstPlace, secondPlace, thirdPlace, fourthPlace];
      const helper = await import('../../../../../../lib/calculateScores');
      // helper exports default and named; prefer named
      const calculateScores = helper.calculateScores || helper.default;
      await calculateScores(adminClient, race.penca_id, raceId, officialOrder);
    } catch (err) {
      console.error('Error calculating scores with helper:', err);
      return NextResponse.json({ error: 'Error al calcular puntos' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
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
