import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

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

  try {
    const body = await req.json();

    // Validar campos requeridos (seq es opcional: lo calculamos si falta)
    if (!body.venue || !body.distance_m || !body.start_at) {
      return NextResponse.json(
        { error: 'Campos requeridos: venue, distance_m, start_at' },
        { status: 400 }
      );
    }

    // Obtener penca por slug para validar que existe y pertenece al admin
    const { data: penca, error: pencaError } = await supabase
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
      const { data: existing } = await supabase
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
      const { data: lastRace } = await supabase
        .from('races')
        .select('seq')
        .eq('penca_id', penca.id)
        .order('seq', { ascending: false })
        .limit(1)
        .maybeSingle();
      seq = (lastRace?.seq ?? 0) + 1;
    }

    // Crear carrera
    const { data, error } = await supabase
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
    return NextResponse.json(
      { error: 'Error al crear la carrera' },
      { status: 500 }
    );
  }
}

