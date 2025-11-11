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

  const userId = session.user.id;

  // Cliente de servicio para bypasear RLS si es necesario
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json(
        { error: 'El código es requerido' },
        { status: 400 }
      );
    }

    // Buscar la penca por slug (que es el código)
    const slugToSearch = code.toLowerCase().trim();
    console.log('Buscando penca con slug:', slugToSearch);
    
    const { data: penca, error: pencaError } = await supabase
      .from('pencas')
      .select('id, name, status')
      .eq('slug', slugToSearch)
      .single();

    console.log('Resultado de búsqueda:', { penca, pencaError });

    if (pencaError || !penca) {
      return NextResponse.json(
        { error: 'Código inválido. La penca no existe.' },
        { status: 404 }
      );
    }

    // Verificar que la penca esté abierta
    if (penca.status === 'closed') {
      return NextResponse.json(
        { error: 'Esta penca está cerrada y no acepta nuevos miembros.' },
        { status: 400 }
      );
    }

    // Verificar si el usuario tiene perfil, si no, crearlo
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (!existingProfile) {
      // Usar cliente de servicio para crear perfil (bypass RLS)
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: userId,
          display_name: session.user.email?.split('@')[0] || 'Usuario',
          role: 'user',
        });

      if (profileError) {
        console.error('Error creating profile:', profileError);
        return NextResponse.json(
          { error: 'Error al crear el perfil' },
          { status: 500 }
        );
      }
    }

    // Verificar si ya es miembro
    const { data: existingMembership } = await supabase
      .from('memberships')
      .select('id')
      .eq('penca_id', penca.id)
      .eq('user_id', userId)
      .single();

    if (existingMembership) {
      return NextResponse.json(
        { error: 'Ya eres miembro de esta penca.' },
        { status: 400 }
      );
    }

    // Crear membership
    const { error: membershipError } = await supabase
      .from('memberships')
      .insert({
        penca_id: penca.id,
        user_id: userId,
        role: 'player',
      });

    if (membershipError) {
      console.error('Error creating membership:', membershipError);
      return NextResponse.json(
        { error: 'Error al unirse a la penca' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Te has unido a ${penca.name}`,
      pencaId: penca.id,
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Error al procesar la solicitud' },
      { status: 500 }
    );
  }
}
