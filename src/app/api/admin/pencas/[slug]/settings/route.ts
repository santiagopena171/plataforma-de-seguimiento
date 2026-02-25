import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PATCH(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const supabase = createRouteHandlerClient({ cookies });

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
    const body = await request.json();
    const { num_participants, external_results_url, sync_interval_minutes } = body;

    // Validar
    if (!num_participants || num_participants < 3) {
      return NextResponse.json(
        { error: 'Número de caballos debe ser mínimo 3' },
        { status: 400 }
      );
    }

    const adminSupabase = createServiceRoleClient();

    // Actualizar la penca usando el slug
    const { error } = await adminSupabase
      .from('pencas')
      .update({
        num_participants,
        external_results_url: external_results_url || null,
        sync_interval_minutes: Number(sync_interval_minutes) || 0
      })
      .eq('slug', params.slug);

    if (error) {
      console.error('Error updating penca:', error);
      return NextResponse.json(
        { error: 'Error al actualizar la configuración' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Error al procesar la solicitud' },
      { status: 500 }
    );
  }
}
