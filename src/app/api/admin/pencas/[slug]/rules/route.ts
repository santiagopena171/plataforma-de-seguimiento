import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/client';

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

  const adminSupabase = createServiceRoleClient();

  try {
    const body = await request.json();
    const {
      pencaId,
      version,
      points_top3,
      exclusive_winner_points,
      modalities_enabled,
      lock_minutes_before_start,
      sealed_predictions_until_close,
      effective_from_race_seq,
    } = body;

    // Verificar que la penca existe
    const { data: penca, error: pencaError } = await adminSupabase
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

    const { data: latestRuleset } = await adminSupabase
      .from('rulesets')
      .select('version')
      .eq('penca_id', pencaId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    let targetVersion =
      typeof version === 'number' && version > 0
        ? version
        : (latestRuleset?.version || 0) + 1;

    if (latestRuleset?.version && targetVersion <= latestRuleset.version) {
      targetVersion = latestRuleset.version + 1;
    }

    // Desactivar rulesets anteriores
    await adminSupabase
      .from('rulesets')
      .update({ is_active: false })
      .eq('penca_id', pencaId);

    // Crear nuevo ruleset
    const { data: newRuleset, error: rulesetError } = await adminSupabase
      .from('rulesets')
      .insert({
        penca_id: pencaId,
        version: targetVersion,
        points_top3,
        exclusive_winner_points,
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
