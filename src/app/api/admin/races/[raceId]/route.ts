import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@supabase/supabase-js';

// Helper para crear cliente admin
const createAdminClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

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

  const supabaseAdmin = createAdminClient();

  try {
    const { data, error } = await supabaseAdmin
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

  const supabaseAdmin = createAdminClient();

  try {
    const body = await req.json();

    // Construir objeto de actualización dinámicamente
    const updateData: any = { updated_at: new Date().toISOString() };

    // Si viene status, lo agregamos
    if (body.status) {
      updateData.status = body.status;
    }

    // Si vienen otros campos, los agregamos también
    if (body.venue) updateData.venue = body.venue;
    if (body.distance_m) updateData.distance_m = body.distance_m;
    if (body.start_at) updateData.start_at = body.start_at;

    // Validar que al menos se esté actualizando algo
    if (Object.keys(updateData).length === 1) { // Solo tiene updated_at
      return NextResponse.json(
        { error: 'Debes especificar al menos un campo para actualizar' },
        { status: 400 }
      );
    }

    // Actualizar carrera
    const { data, error } = await supabaseAdmin
      .from('races')
      .update(updateData)
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

  const supabaseAdmin = createAdminClient();

  try {
    console.log(`Intentando eliminar carrera ${params.raceId}...`);

    // Primero eliminar todas las tablas relacionadas
    // 1. Eliminar scores de esta carrera
    const scoresResult = await supabaseAdmin
      .from('scores')
      .delete()
      .eq('race_id', params.raceId);
    console.log('Scores eliminados:', scoresResult);

    // 2. Eliminar resultados de esta carrera
    const resultsResult = await supabaseAdmin
      .from('race_results')
      .delete()
      .eq('race_id', params.raceId);
    console.log('Results eliminados:', resultsResult);

    // 3. Eliminar predicciones de esta carrera
    const predictionsResult = await supabaseAdmin
      .from('predictions')
      .delete()
      .eq('race_id', params.raceId);
    console.log('Predictions eliminados:', predictionsResult);

    // 4. Eliminar entries de esta carrera
    const entriesResult = await supabaseAdmin
      .from('race_entries')
      .delete()
      .eq('race_id', params.raceId);
    console.log('Entries eliminados:', entriesResult);

    // 5. Finalmente eliminar la carrera
    console.log('Eliminando race...');
    const { data: raceData, error: raceError } = await supabaseAdmin
      .from('races')
      .delete()
      .eq('id', params.raceId)
      .select();

    if (raceError) {
      console.error('ERROR al eliminar race:', raceError);
      return NextResponse.json(
        { error: `Error al eliminar la carrera: ${raceError.message}` },
        { status: 500 }
      );
    }

    if (!raceData || raceData.length === 0) {
      console.error('No se eliminó ninguna carrera');
      return NextResponse.json(
        { error: 'No se pudo eliminar la carrera. Verifica que exista.' },
        { status: 404 }
      );
    }

    console.log(`Carrera ${params.raceId} eliminada exitosamente:`, raceData);
    return NextResponse.json({ success: true, deleted: raceData });
  } catch (err) {
    console.error('Error deleting race:', err);
    return NextResponse.json(
      { error: 'Error al eliminar la carrera' },
      { status: 500 }
    );
  }
}
