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

  // Inicializar cliente admin
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

    // Validar campos requeridos
    if (!body.day_name || body.day_number === undefined) {
      return NextResponse.json(
        { error: 'Campos requeridos: day_name, day_number' },
        { status: 400 }
      );
    }

    // Obtener penca por slug
    const { data: penca, error: pencaError } = await supabaseAdmin
      .from('pencas')
      .select('id')
      .eq('slug', params.slug)
      .single();

    if (pencaError || !penca) {
      return NextResponse.json({ error: 'Penca no encontrada' }, { status: 404 });
    }

    // Crear día de carrera
    const { data, error } = await supabaseAdmin
      .from('race_days')
      .insert([
        {
          penca_id: penca.id,
          day_number: body.day_number,
          day_name: body.day_name,
          day_date: body.day_date || null,
        },
      ])
      .select()
      .single();

    if (error) {
      // Manejar error de unicidad
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Ya existe un día con ese número en esta penca' },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('Error creating race day:', err);
    const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);
    return NextResponse.json(
      { error: `Error al crear el día: ${errorMessage}` },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
    const { searchParams } = new URL(req.url);
    const dayId = searchParams.get('dayId');

    if (!dayId) {
      return NextResponse.json(
        { error: 'dayId es requerido' },
        { status: 400 }
      );
    }

    // Eliminar el día (las carreras se desasociarán automáticamente por ON DELETE SET NULL)
    const { error } = await supabaseAdmin
      .from('race_days')
      .delete()
      .eq('id', dayId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('Error deleting race day:', err);
    const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);
    return NextResponse.json(
      { error: `Error al eliminar el día: ${errorMessage}` },
      { status: 500 }
    );
  }
}
