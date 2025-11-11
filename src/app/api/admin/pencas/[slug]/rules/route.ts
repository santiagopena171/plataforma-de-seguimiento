import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: { slug: string } }
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
    const {
      pencaId,
      version,
      points_top3,
      modalities_enabled,
      lock_minutes_before_start,
      sealed_predictions_until_close,
      effective_from_race_seq,
    } = body;

    // Verificar que la penca existe
    const { data: penca, error: pencaError } = await supabase
      .from('pencas')
      .select('id')
      .eq('id', pencaId)
      .eq('slug', params.slug)
      .single();

    if (pencaError || !penca) {
      return NextResponse.json(
        { error: 'Penca no encontrada' },
        { status: 404 }
      );
    }

    // Desactivar rulesets anteriores
    await supabase
      .from('rulesets')
      .update({ is_active: false })
      .eq('penca_id', pencaId);

    // Crear nuevo ruleset
    const { data: newRuleset, error: rulesetError } = await supabase
      .from('rulesets')
      .insert({
        penca_id: pencaId,
        version,
        points_top3,
        modalities_enabled,
        lock_minutes_before_start,
        sealed_predictions_until_close,
        effective_from_race_seq,
        is_active: true,
      })
      .select()
      .single();

    if (rulesetError) {
      return NextResponse.json(
        { error: rulesetError.message },
        { status: 400 }
      );
    }

    return NextResponse.json(newRuleset);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Error al procesar la solicitud' },
      { status: 500 }
    );
  }
}
