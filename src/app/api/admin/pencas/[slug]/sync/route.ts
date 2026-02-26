import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { syncPencaResults } from '@/lib/services/sync-results';

export async function POST(
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
        const { slug } = params;

        console.log(`Ejecutando sincronización manual para: ${slug}`);

        const result = await syncPencaResults(slug, true);

        if (!result.success) {
            return NextResponse.json({
                error: result.error || 'Error en el proceso de sincronización',
                log: result.logs
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Sincronización completada exitosamente',
            log: result.logs
        });

    } catch (error: any) {
        console.error('Error en endpoint de sync:', error);
        return NextResponse.json(
            {
                error: 'Error interno al procesar la sincronización',
                details: error.message
            },
            { status: 500 }
        );
    }
}
