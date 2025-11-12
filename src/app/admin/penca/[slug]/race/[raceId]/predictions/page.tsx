import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import AdminPredictionsForm from '@/components/AdminPredictionsForm';

interface PageProps {
  params: {
    slug: string;
    raceId: string;
  };
}

export default async function AdminPredictionsPage({ params }: PageProps) {
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

  // Obtener la carrera
  const { data: race } = await supabase
    .from('races')
    .select(`
      *,
      pencas (
        id,
        name,
        slug
      )
    `)
    .eq('id', params.raceId)
    .single();

  if (!race || race.pencas.slug !== params.slug) {
    notFound();
  }

  // Obtener el penca ID
  const pencaId = race.pencas.id;
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

  const { data: participants, error: participantsError } = await adminClient
    .from('race_entries')
    .select('*')
    .eq('race_id', params.raceId)
    .order('program_number', { ascending: true });

  // Obtener jugadores de la penca (usuarios registrados + guests, sin admin)
  const { data: memberships, error: membershipsError } = await adminClient
    .from('memberships')
    .select(`
      id,
      penca_id,
      user_id,
      guest_name,
      role
    `)
    .eq('penca_id', pencaId);

  console.log('All memberships for penca:', memberships);
  console.log('Penca ID:', pencaId);
  console.log('Memberships error:', membershipsError);

  // Obtener nombres de usuario para no-guests
  let userProfiles: Record<string, any> = {};
  const userIds = memberships?.filter((m: any) => m.user_id)?.map((m: any) => m.user_id) || [];
  
  console.log('User IDs to fetch:', userIds);
  
  if (userIds.length > 0) {
    const { data: profiles } = await adminClient
      .from('profiles')
      .select('id, email, full_name')
      .in('id', userIds);
    
    console.log('Fetched profiles:', profiles);
    
    profiles?.forEach((p: any) => {
      userProfiles[p.id] = p;
    });
  }

  // Filtrar solo los que no son admin
  const filteredMemberships = memberships?.filter((m: any) => m.role !== 'admin') || [];
  console.log('Filtered memberships (non-admin):', filteredMemberships);

  // Formatear jugadores: puede ser usuario registrado o guest
  const players = filteredMemberships?.map((m: any) => {
    let name = 'Usuario';
    if (m.guest_name) {
      name = m.guest_name;
    } else if (m.user_id && userProfiles[m.user_id]) {
      const profile = userProfiles[m.user_id];
      name = profile.full_name || profile.email || 'Usuario registrado';
    }
    return {
      membership_id: m.id,
      user_id: m.user_id,
      name: name,
      is_guest: !m.user_id,
    };
  }) || [];

  // Obtener predicciones existentes
  const { data: existingPredictions } = await adminClient
    .from('predictions')
    .select('*')
    .eq('race_id', params.raceId);

  // Mapear predicciones por membership_id o user_id
  const predictionsMap: Record<string, any> = {};
  existingPredictions?.forEach((pred: any) => {
    const key = pred.membership_id || pred.user_id;
    if (key) {
      predictionsMap[key] = {
        winner_pick: pred.winner_pick,
        exacta_pick: pred.exacta_pick,
        trifecta_pick: pred.trifecta_pick,
      };
    }
  });

  const entries =
    participants?.map((entry: any) => ({
      id: entry.id,
      number: entry.program_number,
      // Mostrar solo el número del caballo como etiqueta para evitar duplicados y "undefined"
      label: `#${entry.program_number}`,
    })) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-3">
            <a
              href={`/admin/penca/${params.slug}`}
              className="text-gray-600 hover:text-gray-900"
            >
              ← Volver
            </a>
            <span className="text-gray-400">/</span>
            <h1 className="text-2xl font-bold text-gray-900">
              Carrera #{race.seq} - Ingresar Predicciones
            </h1>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {race.venue} • {race.distance_m}m • {new Date(race.start_at).toLocaleDateString('es-UY')}
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {entries.length > 0 ? (
          <AdminPredictionsForm
            raceId={params.raceId}
            pencaSlug={params.slug}
            players={players}
            entries={entries}
            existingPredictions={predictionsMap}
          />
        ) : (
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600">
              No hay participantes configurados para esta carrera.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
