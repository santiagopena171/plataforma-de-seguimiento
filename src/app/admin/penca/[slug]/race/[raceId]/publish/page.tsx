import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import LogoutButton from '@/components/LogoutButton';
import PublishResultForm from './PublishResultForm';
import { createClient } from '@supabase/supabase-js';

interface PageProps {
  params: {
    slug: string;
    raceId: string;
  };
}

export default async function PublishResultPage({ params }: PageProps) {
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  // Verificar que sea admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  if (profile?.role !== 'admin') {
    redirect('/dashboard');
  }

  // Crear cliente admin para bypass RLS
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  // Obtener la carrera con sus caballos usando admin client
  const { data: race, error: raceError } = await adminClient
    .from('races')
    .select(`
      *,
      penca:pencas!races_penca_id_fkey (
        id,
        slug,
        name,
        rulesets (
          *
        )
      ),
      race_entries (
        id,
        program_number,
        horse_name:label
      )
    `)
    .eq('id', params.raceId)
    .single();

  if (raceError || !race) {
    console.error('Error fetching race:', raceError);
    notFound();
  }

  // Cast race to any to avoid TS issues with the join if types aren't generated
  const raceData = race as any;

  // Verificar que la carrera pertenece a la penca correcta
  if (raceData.penca.slug !== params.slug) {
    notFound();
  }

  // Verificar si el resultado ya está publicado
  if (race.status === 'result_published') {
    redirect(`/admin/penca/${params.slug}`);
  }

  // Obtener el ruleset activo
  const activeRuleset = raceData.penca.rulesets?.find((r: any) => r.is_active);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <Link
                href={`/admin/penca/${params.slug}`}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Volver a {raceData.penca.name}
              </Link>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              Publicar Resultado - Carrera #{race.seq}
            </h1>
            <div className="mt-2 text-sm text-gray-600">
              <p>{race.venue} • {race.distance_m}m</p>
              <p>{new Date(race.start_at).toLocaleString('es', {
                dateStyle: 'medium',
                timeStyle: 'short'
              })}</p>
            </div>
          </div>

          {/* Rules Info */}
          {activeRuleset && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm font-semibold text-blue-900 mb-2">
                Reglas de Puntuación Activas
              </p>
              <div className="text-sm text-blue-800">
                <p>1° lugar: {activeRuleset.points_top3.first} puntos</p>
                <p>2° lugar: {activeRuleset.points_top3.second} puntos</p>
                <p>3° lugar: {activeRuleset.points_top3.third} puntos</p>
                {activeRuleset.points_top3.fourth !== undefined && (
                  <p>4° lugar: {activeRuleset.points_top3.fourth} puntos</p>
                )}
              </div>
            </div>
          )}

          <PublishResultForm
            race={race}
            entries={race.race_entries || []}
            slug={params.slug}
            activeRuleset={activeRuleset}
          />
        </div>
      </main>
    </div>
  );
}
