import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
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

  // Verificar que sea admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  // Crear cliente con service role para bypasear RLS
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const body = await request.json();
    const { name, slug, description, status, created_by } = body;

    // Validaciones
    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Nombre y slug son requeridos' },
        { status: 400 }
      );
    }

    // Verificar que el slug no exista
    const { data: existingPenca } = await supabaseAdmin
      .from('pencas')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existingPenca) {
      return NextResponse.json(
        { error: 'Ya existe una penca con ese slug' },
        { status: 400 }
      );
    }

    // Crear la penca
    const { data: penca, error: pencaError } = await supabaseAdmin
      .from('pencas')
      .insert({
        name,
        slug,
        description: description || null,
        status: status || 'open',
        created_by,
      })
      .select()
      .single();

    if (pencaError) {
      console.error('Error creating penca:', pencaError);
      return NextResponse.json(
        { error: pencaError.message },
        { status: 400 }
      );
    }

    // Crear el ruleset inicial por defecto
    const { error: rulesetError } = await supabaseAdmin
      .from('rulesets')
      .insert({
        penca_id: penca.id,
        version: 1,
        points_top3: { first: 5, second: 3, third: 1 },
        modalities_enabled: ['winner'],
        lock_minutes_before_start: 15,
        sealed_predictions_until_close: true,
        effective_from_race_seq: 1,
        is_active: true,
      });

    if (rulesetError) {
      console.error('Error creating default ruleset:', rulesetError);
      // No falla la creación de la penca si falla el ruleset
    }

    // Crear membership del creador como admin de la penca
    const { error: membershipError } = await supabaseAdmin
      .from('memberships')
      .insert({
        penca_id: penca.id,
        user_id: created_by,
        role: 'admin',
      });

    if (membershipError) {
      console.error('Error creating membership:', membershipError);
      // No falla la creación de la penca si falla el membership
    }

    return NextResponse.json(penca);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Error al procesar la solicitud' },
      { status: 500 }
    );
  }
}
