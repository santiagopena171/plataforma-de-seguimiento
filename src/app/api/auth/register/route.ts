import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { email, password, displayName } = await request.json();

    const supabase = createServerComponentClient({ cookies });

    // Registrar el usuario con el display_name en metadata
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName.trim(),
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/callback`,
      },
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    if (data.user) {
      // Actualizar el perfil con el display_name
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim(),
        })
        .eq('id', data.user.id);

      if (updateError) {
        console.error('Error updating profile:', updateError);
        // No fallamos si falla la actualización, el trigger ya creó el perfil
      }
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error('Register error:', error);
    return NextResponse.json(
      { error: error.message || 'Error en el registro' },
      { status: 500 }
    );
  }
}
