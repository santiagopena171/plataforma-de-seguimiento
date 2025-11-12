import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';

interface PageProps {
  params: {
    slug: string;
  };
}

export default async function PublicPencaPage({ params }: PageProps) {
  const supabase = createServerComponentClient({ cookies });

  // Obtener la penca (pública)
  const { data: penca } = await supabase
    .from('pencas')
    .select('*')
    .eq('slug', params.slug)
    .single();

  if (!penca) {
    notFound();
  }

  // Obtener carreras con resultados publicados
  const { data: races } = await supabase
    .from('races')
    .select(`
      id,
      venue,
      distance_m,
      date,
      time,
      status
    `)
    .eq('penca_id', penca.id)
    .eq('status', 'result_published')
    .order('date', { ascending: false });

  // Obtener resultados de las carreras
  const raceIds = races?.map((r: any) => r.id) || [];
  
  const { data: raceResults } = await supabase
    .from('race_results')
    .select('*')
    .in('race_id', raceIds);

  // Mapear resultados por race_id
  const resultsMap: Record<string, any> = {};
  raceResults?.forEach((result: any) => {
    resultsMap[result.race_id] = result;
  });

  // Obtener scores acumulados
  const { data: scores } = await supabase
    .from('scores')
    .select(`
      *,
      memberships!scores_membership_id_fkey (
        id,
        guest_name,
        profiles:user_id (
          full_name,
          display_name,
          email
        )
      )
    `)
    .in('race_id', raceIds);

  // Agrupar scores por jugador
  const playerScores: Record<string, {
    name: string;
    totalPoints: number;
    races: number;
  }> = {};

  scores?.forEach((score: any) => {
    const membership = score.memberships;
    if (!membership) return;

    const membershipId = membership.id;
    const name = membership.guest_name || 
                 membership.profiles?.display_name || 
                 membership.profiles?.full_name || 
                 membership.profiles?.email || 
                 'Sin nombre';

    if (!playerScores[membershipId]) {
      playerScores[membershipId] = {
        name,
        totalPoints: 0,
        races: 0,
      };
    }

  playerScores[membershipId].totalPoints += score.points_total || 0;
    playerScores[membershipId].races += 1;
  });

  // Ordenar por puntos
  const leaderboard = Object.entries(playerScores)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.totalPoints - a.totalPoints);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{penca.name}</h1>
              {penca.description && (
                <p className="mt-1 text-sm text-gray-600">{penca.description}</p>
              )}
            </div>
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Iniciar Sesión
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Leaderboard */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              🏆 Tabla de Posiciones
            </h2>
          </div>
          
          {leaderboard.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No hay resultados publicados aún.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Posición
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Jugador
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Carreras
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Puntos
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {leaderboard.map((player, index) => (
                    <tr key={player.id} className={index < 3 ? 'bg-yellow-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {index === 0 && '🥇'}
                        {index === 1 && '🥈'}
                        {index === 2 && '🥉'}
                        {index > 2 && `${index + 1}°`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {player.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {player.races}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-center">
                        {player.totalPoints}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Races History */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              📋 Historial de Carreras
            </h2>
          </div>

          {!races || races.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No hay carreras finalizadas.
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {races.map((race: any) => {
                const result = resultsMap[race.id];
                
                return (
                  <div key={race.id} className="px-6 py-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">
                          {race.venue}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {race.distance_m}m • {new Date(race.date).toLocaleDateString('es-UY')} {race.time}
                        </p>
                        
                        {result && (
                          <div className="mt-3 flex gap-4 text-sm">
                            <span className="text-gray-700">
                              🥇 1°: <span className="font-medium">#{result.first_place}</span>
                            </span>
                            <span className="text-gray-700">
                              🥈 2°: <span className="font-medium">#{result.second_place}</span>
                            </span>
                            <span className="text-gray-700">
                              🥉 3°: <span className="font-medium">#{result.third_place}</span>
                            </span>
                          </div>
                        )}
                      </div>

                      <Link
                        href={`/public/${params.slug}/race/${race.id}`}
                        className="px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-md transition-colors"
                      >
                        Ver Detalles
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-gray-500">
            Plataforma de Seguimiento - {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
