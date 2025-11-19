import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

interface RaceEntry {
    id: string;
    program_number: number;
    horse_name?: string;
    label?: string | null;
}

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

    const supabaseAdmin = createAdminClient();

    try {
        const { data, error } = await supabaseAdmin
            .from('race_entries')
            .select('*')
            .eq('race_id', params.raceId)
            .order('program_number', { ascending: true });

        if (error) throw error;

        const normalized =
            data?.map((entry: any) => ({
                ...entry,
                horse_name: entry.label ?? entry.horse_name ?? `Caballo ${entry.program_number}`,
            })) || [];

        return NextResponse.json(normalized);
    } catch (err) {
        console.error('Error fetching race entries:', err);
        const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);
        return NextResponse.json(
            { error: `Error al obtener los caballos: ${errorMessage}` },
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

        if (!body.entries || !Array.isArray(body.entries)) {
            return NextResponse.json(
                { error: 'entries debe ser un array' },
                { status: 400 }
            );
        }

        // Obtener los IDs de caballos existentes
        const { data: existingEntries } = await supabaseAdmin
            .from('race_entries')
            .select('id')
            .eq('race_id', params.raceId);

        const existingIds = new Set(existingEntries?.map((e: any) => e.id) || []);
        const newIds = new Set(body.entries.filter((e: RaceEntry) => e.id && !e.id.startsWith('new-')).map((e: RaceEntry) => e.id));

        // Eliminar caballos que no están en la lista nueva
        const toDelete = Array.from(existingIds).filter((id: string) => !newIds.has(id));
        if (toDelete.length > 0) {
            const { error: deleteError } = await supabaseAdmin
                .from('race_entries')
                .delete()
                .in('id', toDelete);
            if (deleteError) throw deleteError;
        }

        // Insertar o actualizar caballos usando solo el número y una etiqueta opcional
        for (const entry of body.entries as RaceEntry[]) {
            const number = entry.program_number;
            const labelValue =
                (entry.horse_name && entry.horse_name.trim()) ||
                (entry.label && entry.label.trim()) ||
                `Caballo ${number}`;

            const entryData = {
                race_id: params.raceId,
                program_number: number,
                label: labelValue,
            };

            if (entry.id && !entry.id.startsWith('new-')) {
                // Actualizar existente
                const { error } = await supabaseAdmin
                    .from('race_entries')
                    .update(entryData)
                    .eq('id', entry.id);
                if (error) throw error;
            } else {
                // Insertar nuevo
                const { error } = await supabaseAdmin
                    .from('race_entries')
                    .insert([entryData]);
                if (error) throw error;
            }
        }
        // Retornar los caballos actualizados
        const { data: updated } = await supabaseAdmin
            .from('race_entries')
            .select('*')
            .eq('race_id', params.raceId)
            .order('program_number', { ascending: true });

        const normalizedUpdated =
            updated?.map((entry: any) => ({
                ...entry,
                horse_name: entry.label ?? entry.horse_name ?? `Caballo ${entry.program_number}`,
            })) || [];

        return NextResponse.json(normalizedUpdated);
    } catch (err) {
        console.error('Error updating race entries:', err);
        const anyErr: any = err;
        if (anyErr && (anyErr.code === '23505' || (anyErr.message || '').includes('duplicate key'))) {
            return NextResponse.json(
                { error: 'Hay números duplicados en los caballos' },
                { status: 400 }
            );
        }
        const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);
        return NextResponse.json(
            { error: `Error al actualizar los caballos: ${errorMessage}` },
            { status: 500 }
        );
    }
}
