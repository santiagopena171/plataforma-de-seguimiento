import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@supabase/supabase-js';

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
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

  // Inicializar cliente admin para saltar RLS
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
    const body = await req.json();

    // Validar campos requeridos (seq es opcional: lo calculamos si falta)
    if (!body.venue || body.distance_m === undefined || !body.start_at) {
      return NextResponse.json(
        { error: 'Campos requeridos: venue, distance_m, start_at' },
        { status: 400 }
      );
    }

    // Obtener penca por slug para validar que existe (usando admin por si acaso)
    const { data: penca, error: pencaError } = await supabaseAdmin
      .from('pencas')
      .select('id')
      .eq('slug', params.slug)
      .single();

    if (pencaError || !penca) {
      return NextResponse.json({ error: 'Penca no encontrada' }, { status: 404 });
    }

    // Choose seq: use requested if available, else next available for this penca
    let seq: number | null = null;
    const requestedSeq: number | undefined =
      typeof body.seq === 'number' ? body.seq : (body.seq ? parseInt(body.seq, 10) : undefined);

    if (requestedSeq && requestedSeq > 0) {
      const { data: existing } = await supabaseAdmin
        .from('races')
        .select('id')
        .eq('penca_id', penca.id)
        .eq('seq', requestedSeq)
        .maybeSingle();
      if (!existing) {
        seq = requestedSeq;
      }
    }

    if (seq === null) {
      const { data: lastRace } = await supabaseAdmin
        .from('races')
        .select('seq')
        .eq('penca_id', penca.id)
        .order('seq', { ascending: false })
        .limit(1)
        .maybeSingle();
      seq = (lastRace?.seq ?? 0) + 1;
    }

    // Crear carrera usando admin client
    const { data, error } = await supabaseAdmin
      .from('races')
      .insert([
        {
          penca_id: penca.id,
          seq,
          venue: body.venue,
          distance_m: body.distance_m,
          start_at: body.start_at,
          status: 'scheduled',
        },
      ])
      .select()
      .single();

    if (error) {
      // Manejar error de unicidad
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Ya existe una carrera con ese número en esta penca' },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('Error creating race:', err);
    const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);
    return NextResponse.json(
      { error: `Error al crear la carrera: ${errorMessage}` },
      { status: 500 }
    );
  }
}

