import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      race_id,
      user_id,
      winner_pick,
      exacta_first,
      exacta_second,
      trifecta_first,
      trifecta_second,
      trifecta_third,
    } = body;

    // Verificar que el usuario está autenticado como el mismo usuario
    if (user_id !== session.user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Verificar que la carrera existe y obtener su penca
    const { data: race, error: raceError } = await supabase
      .from('races')
      .select('id, penca_id, start_at, status')
      .eq('id', race_id)
      .single();

    if (raceError || !race) {
      return NextResponse.json({ error: 'Carrera no encontrada' }, { status: 404 });
    }

    // Verificar que el usuario es miembro de la penca
    const { data: membership } = await supabase
      .from('memberships')
      .select('role')
      .eq('penca_id', race.penca_id)
      .eq('user_id', user_id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'No eres miembro de esta penca' }, { status: 403 });
    }

    // Obtener las reglas para verificar el tiempo de cierre
    const { data: ruleset } = await supabase
      .from('rulesets')
      .select('lock_minutes_before_start')
      .eq('penca_id', race.penca_id)
      .eq('is_active', true)
      .single();

    if (!ruleset) {
      return NextResponse.json({ error: 'No se encontraron reglas activas' }, { status: 404 });
    }

    // Verificar que la carrera no está cerrada
    const raceDate = new Date(race.start_at);
    const lockTime = new Date(raceDate.getTime() - ruleset.lock_minutes_before_start * 60000);
    const now = new Date();

    if (now >= lockTime || race.status === 'closed' || race.status === 'result_published') {
      return NextResponse.json({ error: 'La carrera ya está cerrada para predicciones' }, { status: 400 });
    }

    // Crear la predicción
    const predictionData: any = {
      race_id,
      user_id,
      winner_pick,
    };

    // Agregar exacta_pick si hay valores
    if (exacta_first && exacta_second) {
      predictionData.exacta_pick = [exacta_first, exacta_second];
    }

    // Agregar trifecta_pick si hay valores
    if (trifecta_first && trifecta_second && trifecta_third) {
      predictionData.trifecta_pick = [trifecta_first, trifecta_second, trifecta_third];
    }

    const { data: prediction, error: predictionError } = await supabase
      .from('predictions')
      .insert(predictionData)
      .select()
      .single();

    if (predictionError) {
      console.error('Error creating prediction:', predictionError);
      return NextResponse.json(
        { error: 'Error al guardar la predicción' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, prediction });
  } catch (error: any) {
    console.error('Error in POST /api/predictions:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      race_id,
      user_id,
      winner_pick,
      exacta_first,
      exacta_second,
      trifecta_first,
      trifecta_second,
      trifecta_third,
    } = body;

    // Verificar que el usuario está autenticado como el mismo usuario
    if (user_id !== session.user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Verificar que la carrera existe y obtener su penca
    const { data: race, error: raceError } = await supabase
      .from('races')
      .select('id, penca_id, start_at, status')
      .eq('id', race_id)
      .single();

    if (raceError || !race) {
      return NextResponse.json({ error: 'Carrera no encontrada' }, { status: 404 });
    }

    // Obtener las reglas para verificar el tiempo de cierre
    const { data: ruleset } = await supabase
      .from('rulesets')
      .select('lock_minutes_before_start')
      .eq('penca_id', race.penca_id)
      .eq('is_active', true)
      .single();

    if (!ruleset) {
      return NextResponse.json({ error: 'No se encontraron reglas activas' }, { status: 404 });
    }

    // Verificar que la carrera no está cerrada
    const raceDate = new Date(race.start_at);
    const lockTime = new Date(raceDate.getTime() - ruleset.lock_minutes_before_start * 60000);
    const now = new Date();

    if (now >= lockTime || race.status === 'closed' || race.status === 'result_published') {
      return NextResponse.json({ error: 'La carrera ya está cerrada para predicciones' }, { status: 400 });
    }

    // Actualizar la predicción
    const updateData: any = {
      winner_pick,
    };

    // Agregar exacta_pick si hay valores
    if (exacta_first && exacta_second) {
      updateData.exacta_pick = [exacta_first, exacta_second];
    } else {
      updateData.exacta_pick = null;
    }

    // Agregar trifecta_pick si hay valores
    if (trifecta_first && trifecta_second && trifecta_third) {
      updateData.trifecta_pick = [trifecta_first, trifecta_second, trifecta_third];
    } else {
      updateData.trifecta_pick = null;
    }

    const { data: prediction, error: predictionError } = await supabase
      .from('predictions')
      .update(updateData)
      .eq('race_id', race_id)
      .eq('user_id', user_id)
      .select()
      .single();

    if (predictionError) {
      console.error('Error updating prediction:', predictionError);
      return NextResponse.json(
        { error: 'Error al actualizar la predicción' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, prediction });
  } catch (error: any) {
    console.error('Error in PUT /api/predictions:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
