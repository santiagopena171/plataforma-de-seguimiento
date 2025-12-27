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

    // Validar num_races si se proporciona
    const numRaces = body.num_races || 0;
    if (numRaces < 0 || numRaces > 20) {
      return NextResponse.json(
        { error: 'num_races debe estar entre 0 y 20' },
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

    // Obtener el último número de secuencia de carrera para continuar la numeración
    const { data: lastRace } = await supabaseAdmin
      .from('races')
      .select('seq')
      .eq('penca_id', penca.id)
      .order('seq', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextSeq = (lastRace?.seq ?? 0) + 1;

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

    // Crear las carreras si se especificó num_races
    if (numRaces > 0) {
      const races = [];
      for (let i = 0; i < numRaces; i++) {
        const raceSeq = nextSeq + i;
        
        // Crear la carrera
        const { data: race, error: raceError } = await supabaseAdmin
          .from('races')
          .insert({
            penca_id: penca.id,
            seq: raceSeq,
            venue: body.day_name, // Usar el nombre del día como venue por defecto
            distance_m: 1600, // Distancia por defecto
            start_at: new Date().toISOString(), // Fecha/hora por defecto
            status: 'scheduled',
            race_day_id: data.id,
          })
          .select()
          .single();

        if (raceError) {
          console.error(`Error creating race ${raceSeq}:`, raceError);
          continue; // Continuar con las demás carreras aunque una falle
        }

        if (race) {
          races.push(race);

          // Crear 15 caballos para esta carrera
          const entries = Array.from({ length: 15 }, (_, j) => ({
            race_id: race.id,
            program_number: j + 1,
            label: `Caballo ${j + 1}`,
          }));

          const { error: entriesError } = await supabaseAdmin
            .from('race_entries')
            .insert(entries);

          if (entriesError) {
            console.error(`Error creating entries for race ${raceSeq}:`, entriesError);
          }
        }
      }

      return NextResponse.json({ 
        ...data, 
        races_created: races.length,
        starting_race_number: nextSeq 
      }, { status: 201 });
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
