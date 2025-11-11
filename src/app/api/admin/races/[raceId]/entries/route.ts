import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

interface RaceEntry {
  id: string;
  program_number: number;
  horse_name: string;
  jockey: string;
  trainer?: string | null;
  stud?: string | null;
  notes?: string | null;
}

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

  try {
    const { data, error } = await supabase
      .from('race_entries')
      .select('*')
      .eq('race_id', params.raceId)
      .order('program_number', { ascending: true });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error('Error fetching race entries:', err);
    return NextResponse.json(
      { error: 'Error al obtener los caballos' },
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

    if (!body.entries || !Array.isArray(body.entries)) {
      return NextResponse.json(
        { error: 'entries debe ser un array' },
        { status: 400 }
      );
    }

    // Obtener los IDs de caballos existentes
    const { data: existingEntries } = await supabase
      .from('race_entries')
      .select('id')
      .eq('race_id', params.raceId);

    const existingIds = new Set(existingEntries?.map((e: any) => e.id) || []);
    const newIds = new Set(body.entries.filter((e: RaceEntry) => e.id && !e.id.startsWith('new-')).map((e: RaceEntry) => e.id));

    // Eliminar caballos que no están en la lista nueva
  const toDelete = Array.from(existingIds).filter((id: string) => !newIds.has(id));
    if (toDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('race_entries')
        .delete()
        .in('id', toDelete);
      if (deleteError) throw deleteError;
    }

    // Insertar o actualizar caballos
    for (const entry of body.entries as RaceEntry[]) {
      const entryData = {
        race_id: params.raceId,
        program_number: entry.program_number,
        horse_name: entry.horse_name,
        jockey: entry.jockey,
        trainer: entry.trainer || null,
        stud: entry.stud || null,
        notes: entry.notes || null,
      };

      if (entry.id && !entry.id.startsWith('new-')) {
        // Actualizar existente
        const { error } = await supabase
          .from('race_entries')
          .update(entryData)
          .eq('id', entry.id);
        if (error) throw error;
      } else {
        // Insertar nuevo
        const { error } = await supabase
          .from('race_entries')
          .insert([entryData]);
        if (error) throw error;
      }
    }

    // Retornar los caballos actualizados
    const { data: updated } = await supabase
      .from('race_entries')
      .select('*')
      .eq('race_id', params.raceId)
      .order('program_number', { ascending: true });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('Error updating race entries:', err);
    return NextResponse.json(
      { error: 'Error al actualizar los caballos' },
      { status: 500 }
    );
  }
}
