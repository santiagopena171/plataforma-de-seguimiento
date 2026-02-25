import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import util from 'util';

const execPromise = util.promisify(exec);

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

        // Ejecutar el script de sincronización
        // Usamos el slug de la penca para que busque su propio URL en la BD
        const scriptPath = path.join(process.cwd(), 'scripts', 'sync-results-excel.js');

        console.log(`Ejecutando sincronización manual para: ${slug}`);

        // Ejecutamos el script de forma asíncrona para no bloquear la respuesta si tarda mucho,
        // pero para darle feedback al usuario esperaremos el resultado inicial.
        // Usamos --force para asegurar que se recalculen resultados si es necesario.
        try {
            const { stdout, stderr } = await execPromise(`node "${scriptPath}" --penca-slug "${slug}" --force`);

            if (stderr && !stdout) {
                console.error('Error en script:', stderr);
                return NextResponse.json({ error: 'Error en el proceso de sincronización' }, { status: 500 });
            }

            console.log('Script output:', stdout);

            return NextResponse.json({
                success: true,
                message: 'Sincronización completada exitosamente',
                log: stdout
            });
        } catch (scriptError: any) {
            console.error('Error ejecutando script:', scriptError);
            return NextResponse.json({
                error: 'Error al ejecutar el script de sincronización',
                details: scriptError.message
            }, { status: 500 });
        }

    } catch (error) {
        console.error('Error en endpoint de sync:', error);
        return NextResponse.json(
            { error: 'Error interno al procesar la sincronización' },
            { status: 500 }
        );
    }
}
