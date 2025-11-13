import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function DELETE(
  _request: Request,
  { params }: { params: { slug: string } }
) {
  const supabase = createRouteHandlerClient({ cookies });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { data: penca, error: pencaError } = await supabase
    .from('pencas')
    .select('id')
    .eq('slug', params.slug)
    .single();

  if (pencaError || !penca) {
    return NextResponse.json(
      { error: 'Penca no encontrada' },
      { status: 404 }
    );
  }

  const { error: deleteError } = await supabase
    .from('pencas')
    .delete()
    .eq('id', penca.id);

  if (deleteError) {
    console.error('Error deleting penca:', deleteError);
    return NextResponse.json(
      { error: 'No se pudo eliminar la penca' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
