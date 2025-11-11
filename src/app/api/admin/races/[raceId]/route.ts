import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
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

  try {
    const { data, error } = await supabase
      .from('races')
      .select('*')
      .eq('id', params.raceId)
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Carrera no encontrada' }, { status: 404 });

    return NextResponse.json(data);
  } catch (err) {
    console.error('Error fetching race:', err);
    return NextResponse.json(
      { error: 'Error al obtener la carrera' },
      { status: 500 }
    );
  }
}

export async function PUT(
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

  try {
    const body = await req.json();

    // Validar campos requeridos
    if (!body.venue || !body.distance_m || !body.start_at) {
      return NextResponse.json(
        { error: 'Campos requeridos: venue, distance_m, start_at' },
        { status: 400 }
      );
    }

    // Actualizar carrera
    const { data, error } = await supabase
      .from('races')
      .update({
        venue: body.venue,
        distance_m: body.distance_m,
        start_at: body.start_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.raceId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Carrera no encontrada' }, { status: 404 });

    return NextResponse.json(data);
  } catch (err) {
    console.error('Error updating race:', err);
    return NextResponse.json(
      { error: 'Error al actualizar la carrera' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

  try {
    // Eliminar carrera (cascada eliminará entries, predictions, etc.)
    const { error } = await supabase
      .from('races')
      .delete()
      .eq('id', params.raceId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error deleting race:', err);
    return NextResponse.json(
      { error: 'Error al eliminar la carrera' },
      { status: 500 }
    );
  }
}
