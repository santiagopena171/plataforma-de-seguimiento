import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';

export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = createServerComponentClient({ cookies });
    
    // Verificar autenticación
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Verificar que sea admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      );
    }

    // Obtener la penca
    const { data: penca } = await supabase
      .from('pencas')
      .select('id')
      .eq('slug', params.slug)
      .single();

    if (!penca) {
      return NextResponse.json(
        { error: 'Penca no encontrada' },
        { status: 404 }
      );
    }

    // Configurar cliente admin
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing environment variables');
    }

    const supabaseAdmin = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Obtener el nombre del request body
    const body = await request.json();
    const { guestName } = body;

    if (!guestName || !guestName.trim()) {
      return NextResponse.json(
        { error: 'El nombre del miembro es requerido' },
        { status: 400 }
      );
    }

    // Crear membership con guest_name
    const { data: newMembership, error: membershipError } = await supabaseAdmin
      .from('memberships')
      .insert({
        penca_id: penca.id,
        user_id: null, // Guest member, no user account
        guest_name: guestName.trim(),
        role: 'player',
      })
      .select()
      .single();

    if (membershipError) {
      console.error('Error creating membership:', membershipError);
      return NextResponse.json(
        { error: 'Error al crear el miembro' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      membership: newMembership,
    });
  } catch (error: any) {
    console.error('Error in add member API:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
