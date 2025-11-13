import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import LogoutButton from '@/components/LogoutButton';
import DeleteRaceButton from '@/components/DeleteRaceButton';
import PencaTabs from './PencaTabs';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  params: {
    slug: string;
  };
}

export default async function ManagePencaPage({ params }: PageProps) {
  const supabase = createServerComponentClient({ cookies });
  
  // Validar que existan las variables de entorno necesarias
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }
  
  const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
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

  // Obtener la penca
  const { data: penca, error: pencaError } = await supabase
    .from('pencas')
    .select(`
      *,
      profiles!pencas_created_by_fkey (
        display_name
      ),
      rulesets (
        *
      )
    `)
    .eq('slug', params.slug)
    .single();

  if (pencaError || !penca) {
    notFound();
  }

  // Obtener carreras de la penca con service role para evitar restricciones de RLS
  const { data: races } = await supabaseAdmin
    .from('races')
    .select(`
      *,
      race_entries (
        id,
        program_number,
        horse_name:label
      ),
      predictions (
        id,
        user_id,
        winner_pick,
        is_locked
      )
    `)
    .eq('penca_id', penca.id)
    .order('seq', { ascending: true });

  // Obtener miembros con servicio role para bypass RLS
  const { data: memberships } = await supabaseAdmin
    .from('memberships')
    .select(`
      *,
      profiles (
        id,
        display_name,
        avatar_url
      )
    `)
    .eq('penca_id', penca.id);

  // Obtener códigos de invitación
  const { data: invites } = await supabase
    .from('invites')
    .select('*')
    .eq('penca_id', penca.id)
    .order('created_at', { ascending: false });

  // Obtener scores
  const { data: scores } = await supabase
    .from('scores')
    .select('*')
    .eq('penca_id', penca.id);

  // Obtener todas las predicciones con los detalles de los caballos
  const { data: predictions } = await supabase
    .from('predictions')
    .select(`
      *,
      winner_entry:race_entries!predictions_winner_pick_fkey (
        id,
        program_number,
        horse_name:label
      )
    `)
  .in('race_id', races?.map((r: any) => r.id) || []);

  // Obtener resultados oficiales publicados
  const { data: raceResults } = await supabase
    .from('race_results')
    .select('*')
  .in('race_id', races?.map((r: any) => r.id) || []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Link
                  href="/admin"
                  className="text-gray-600 hover:text-gray-900"
                >
                  ← Admin
                </Link>
                <span className="text-gray-400">/</span>
                <h1 className="text-2xl font-bold text-gray-900">
                  {penca.name}
                </h1>
              </div>
              {penca.description && (
                <p className="text-sm text-gray-600 mt-1">
                  {penca.description}
                </p>
              )}
            </div>
            <div className="self-start sm:self-auto">
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Penca Info Card */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-600">Estado</p>
              <span className={`inline-flex mt-1 px-3 py-1 text-sm font-semibold rounded-full ${
                penca.status === 'open' 
                  ? 'bg-green-100 text-green-800' 
                  : penca.status === 'closed'
                  ? 'bg-gray-100 text-gray-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {penca.status}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-600">Slug</p>
              <p className="font-mono text-sm mt-1">{penca.slug}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Creada por</p>
              <p className="mt-1">{penca.profiles?.display_name}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <PencaTabs 
          pencaSlug={params.slug}
          races={races || []}
          memberships={memberships || []}
          numParticipants={penca.num_participants || 8}
          scores={scores || []}
          predictions={predictions || []}
          raceResults={raceResults || []}
          invitesCount={invites?.length || 0}
        />
      </main>
    </div>
  );
}
