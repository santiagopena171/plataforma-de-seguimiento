import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
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

  // Obtener participantes de la carrera
  const { data: participants } = await supabase
    .from('race_entries')
    .select('*')
    .eq('race_id', params.raceId)
    .order('program_number', { ascending: true });

  // Obtener jugadores de la penca (usuarios registrados + guests)
  const { data: memberships } = await supabase
    .from('memberships')
    .select(`
      id,
      user_id,
      guest_name,
      profiles (
        id,
        display_name,
        full_name,
        email
      )
    `)
    .eq('penca_id', race.pencas.id)
    .eq('status', 'active');

  // Formatear jugadores: puede ser usuario registrado o guest
  const players = memberships?.map((m: any) => ({
    membership_id: m.id,
    user_id: m.user_id,
    name: m.guest_name || m.profiles?.display_name || m.profiles?.full_name || m.profiles?.email || 'Sin nombre',
    is_guest: !m.user_id,
  })) || [];

  // Obtener predicciones existentes
  const { data: existingPredictions } = await supabase
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
        {participants && participants.length > 0 ? (
          <AdminPredictionsForm
            raceId={params.raceId}
            pencaSlug={params.slug}
            players={players}
            entries={participants}
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
