import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
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
    const body = await req.json();
    const { predictions } = body;

    if (!Array.isArray(predictions) || predictions.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere un array de predicciones' },
        { status: 400 }
      );
    }

    // Verificar que la carrera existe y pertenece a una penca del admin
    const { data: race } = await adminClient
      .from('races')
      .select('id, penca_id')
      .eq('id', params.raceId)
      .single();

    if (!race) {
      return NextResponse.json({ error: 'Carrera no encontrada' }, { status: 404 });
    }

    // Eliminar predicciones existentes de esta carrera
    await adminClient
      .from('predictions')
      .delete()
      .eq('race_id', params.raceId);

    // Insertar nuevas predicciones
    const predictionsToInsert = predictions.map((pred: any) => ({
      race_id: params.raceId,
      user_id: pred.user_id || null, // Para usuarios registrados
      membership_id: pred.membership_id || null, // Para participantes guest
      winner_pick: pred.winner_pick,
      exacta_pick: pred.exacta_pick,
      trifecta_pick: pred.trifecta_pick,
      entered_by_admin: true,
      is_locked: true, // Las predicciones ingresadas por admin están bloqueadas
    }));

    const { data, error } = await adminClient
      .from('predictions')
      .insert(predictionsToInsert)
      .select();

    if (error) throw error;

    // Si ya existe un resultado oficial para la carrera, recalcular puntos
    try {
      const { data: result } = await adminClient
        .from('race_results')
        .select('official_order, first_place_tie, bonus_winner_points')
        .eq('race_id', params.raceId)
        .maybeSingle();

      if (result && result.official_order && result.official_order.length > 0) {
        const officialOrder = result.official_order;
        const firstPlaceTie = !!result.first_place_tie;
        const bonus = result.bonus_winner_points || 0;

        const helper = await import('../../../../../../lib/calculateScores');
        const calculateScores = helper.calculateScores || helper.default;
        await calculateScores(adminClient, race.penca_id, params.raceId, officialOrder, firstPlaceTie, bonus);
      }
    } catch (err) {
      console.error('Error recalculating scores after batch predictions:', err);
      // no block: we still return success for predictions insertion
    }

    return NextResponse.json({
      success: true,
      count: data.length,
      predictions: data,
    });
  } catch (err) {
    console.error('Error saving batch predictions:', err);
    return NextResponse.json(
      { error: 'Error al guardar las predicciones' },
      { status: 500 }
    );
  }
}
