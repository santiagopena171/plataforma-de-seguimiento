import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import LogoutButton from '@/components/LogoutButton';

interface PencaPageProps {
  params: {
    slug: string;
  };
}

export default async function PencaPage({ params }: PencaPageProps) {
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  // Obtener datos de la penca
  const { data: penca } = await supabase
    .from('pencas')
    .select('*')
    .eq('slug', params.slug)
    .single();

  if (!penca) {
    redirect('/dashboard');
  }

  // Verificar que el usuario es miembro
  const { data: membership } = await supabase
    .from('memberships')
    .select('role')
    .eq('penca_id', penca.id)
    .eq('user_id', session.user.id)
    .single();

  if (!membership) {
    redirect('/dashboard');
  }

  // Obtener carreras de la penca
  const { data: races, error: racesError } = await supabase
    .from('races')
    .select(`
      *,
      race_entries (
        id,
        program_number,
        horse_name,
        jockey,
        trainer,
        stud,
        notes
      )
    `)
    .eq('penca_id', penca.id)
    .order('start_at', { ascending: true });

  console.log('Races query result:', { races, racesError, pencaId: penca.id });

  // Obtener predicciones del usuario
  const { data: predictions } = await supabase
    .from('predictions')
    .select(`
      *,
      winner_entry:race_entries!predictions_winner_pick_fkey (
        id,
        program_number,
        horse_name
      )
    `)
    .eq('user_id', session.user.id)
    .in('race_id', races?.map(r => r.id) || []);

  // Obtener resultados publicados
  const { data: raceResults } = await supabase
    .from('race_results')
    .select('*')
    .in('race_id', races?.map(r => r.id) || []);

  // Obtener scores del usuario
  const { data: userScores } = await supabase
    .from('scores')
    .select('*')
    .eq('user_id', session.user.id)
    .in('race_id', races?.map(r => r.id) || []);

  const predictionsMap = new Map(predictions?.map(p => [p.race_id, p]) || []);
  const resultsMap = new Map(raceResults?.map(r => [r.race_id, r]) || []);
  const scoresMap = new Map(userScores?.map(s => [s.race_id, s]) || []);

  // Obtener tabla de posiciones (leaderboard)
  const { data: leaderboard } = await supabase
    .from('memberships')
    .select(`
      user_id,
      profiles (
        display_name
      )
    `)
    .eq('penca_id', penca.id);

  // Calcular puntos totales para cada usuario
  const leaderboardWithPoints = await Promise.all(
    (leaderboard || []).map(async (member) => {
      const { data: memberScores } = await supabase
        .from('scores')
        .select('points_total')
        .eq('user_id', member.user_id)
        .eq('penca_id', penca.id);

      const totalPoints = memberScores?.reduce((sum, score) => sum + (score.points_total || 0), 0) || 0;

      return {
        user_id: member.user_id,
        display_name: (member.profiles as any)?.display_name || 'Usuario',
        total_points: totalPoints,
      };
    })
  );

  // Ordenar por puntos descendente
  leaderboardWithPoints.sort((a, b) => b.total_points - a.total_points);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <Link
                href="/dashboard"
                className="text-gray-600 hover:text-gray-900"
              >
                ← Volver al Dashboard
              </Link>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Penca Info */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {penca.name}
              </h1>
              <p className="text-gray-600">{penca.description}</p>
              <div className="mt-4 flex items-center space-x-4">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  penca.status === 'open' ? 'bg-green-100 text-green-800' :
                  penca.status === 'active' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {penca.status === 'open' ? 'Abierta' :
                   penca.status === 'active' ? 'En Progreso' :
                   'Cerrada'}
                </span>
                <span className="text-sm text-gray-600">
                  Código: <span className="font-mono font-semibold">{penca.slug}</span>
                </span>
              </div>
            </div>
            {membership.role === 'admin' && (
              <Link
                href={`/admin/penca/${penca.slug}`}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Panel Admin
              </Link>
            )}
          </div>
        </div>

        {/* Races List */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">Carreras</h2>
          
          {!races || races.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-600">No hay carreras disponibles aún.</p>
            </div>
          ) : (
            races.map((race) => {
              const prediction = predictionsMap.get(race.id);
              const raceDate = new Date(race.start_at);
              const isPast = raceDate < new Date();
              const isClosed = race.status === 'closed' || race.status === 'result_published';

              return (
                <div key={race.id} className="bg-white rounded-lg shadow p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">
                        Carrera #{race.seq}
                      </h3>
                      <div className="mt-2 space-y-1 text-sm text-gray-600">
                        <p>📍 {race.venue}</p>
                        <p>📏 {race.distance_m}m</p>
                        <p>🕐 {raceDate.toLocaleString('es-UY', {
                          dateStyle: 'medium',
                          timeStyle: 'short'
                        })}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      race.status === 'result_published' ? 'bg-purple-100 text-purple-800' :
                      race.status === 'closed' ? 'bg-red-100 text-red-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {race.status === 'result_published' ? 'Finalizada' :
                       race.status === 'closed' ? 'Cerrada' :
                       'Abierta'}
                    </span>
                  </div>

                  {/* Horse Entries */}
                  {race.race_entries && race.race_entries.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold text-gray-900 mb-2">Participantes:</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {race.race_entries
                          .sort((a, b) => a.program_number - b.program_number)
                          .map((entry) => (
                            <div key={entry.id} className="flex items-center space-x-2 text-sm">
                              <span className="font-bold text-gray-700">#{entry.program_number}</span>
                              <span className="text-gray-900">{entry.horse_name}</span>
                              {entry.jockey && (
                                <span className="text-gray-600">({entry.jockey})</span>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Prediction Status */}
                  {prediction ? (
                    <div className="space-y-3">
                      {race.status === 'result_published' && resultsMap.has(race.id) ? (
                        <div className="grid grid-cols-2 gap-4">
                          {/* Left: Tu Predicción */}
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm font-semibold text-blue-900 mb-3">Tu Predicción</p>
                            <div className="space-y-2 text-sm">
                              {prediction.winner_entry && (
                                <div>
                                  <p className="text-xs text-blue-700 font-semibold mb-1">Ganador:</p>
                                  <p className="text-blue-900 font-bold">
                                    #{prediction.winner_entry.program_number} {prediction.winner_entry.horse_name}
                                  </p>
                                </div>
                              )}
                              {prediction.exacta_pick && Array.isArray(prediction.exacta_pick) && prediction.exacta_pick.length > 0 && (
                                <div>
                                  <p className="text-xs text-blue-700 font-semibold mb-1">Exacta:</p>
                                  <div className="space-y-1">
                                    {prediction.exacta_pick.map((entryId: string, index: number) => {
                                      const entry = race.race_entries?.find((e: any) => e.id === entryId);
                                      return entry ? (
                                        <p key={entryId} className="text-blue-900">
                                          {index + 1}°: <span className="font-bold">#{entry.program_number}</span>
                                        </p>
                                      ) : null;
                                    })}
                                  </div>
                                </div>
                              )}
                              {prediction.trifecta_pick && Array.isArray(prediction.trifecta_pick) && prediction.trifecta_pick.length > 0 && (
                                <div>
                                  <p className="text-xs text-blue-700 font-semibold mb-1">Trifecta:</p>
                                  <div className="space-y-1">
                                    {prediction.trifecta_pick.map((entryId: string, index: number) => {
                                      const entry = race.race_entries?.find((e: any) => e.id === entryId);
                                      return entry ? (
                                        <p key={entryId} className="text-blue-900">
                                          {index + 1}°: <span className="font-bold">#{entry.program_number}</span>
                                        </p>
                                      ) : null;
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right: Resultado Publicado */}
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <p className="text-sm font-semibold text-yellow-900 mb-3">🏆 Resultado Publicado</p>
                            <div className="space-y-1 text-sm">
                              {resultsMap.get(race.id)?.official_order?.slice(0, 3).map((entryId: string, index: number) => {
                                const entry = race.race_entries?.find((e: any) => e.id === entryId);
                                return entry ? (
                                  <p key={entryId} className="text-yellow-900">
                                    {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'} {index + 1}°: <span className="font-bold">#{entry.program_number} {entry.horse_name}</span>
                                  </p>
                                ) : null;
                              })}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-sm font-semibold text-blue-900">
                                ✓ Ya hiciste tu predicción
                              </p>
                              {prediction.winner_entry && (
                                <p className="text-sm text-blue-800 mt-1">
                                  Ganador: <span className="font-bold">#{prediction.winner_entry.program_number} {prediction.winner_entry.horse_name}</span>
                                </p>
                              )}
                            </div>
                            {!isClosed && !isPast && (
                              <Link
                                href={`/penca/${params.slug}/race/${race.id}/predict`}
                                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                              >
                                Modificar →
                              </Link>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Puntos Obtenidos */}
                      {race.status === 'result_published' && scoresMap.has(race.id) && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                          <p className="text-lg font-bold text-green-700">
                            Tus puntos: {scoresMap.get(race.id)?.points_total || 0} pts
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      {isClosed || isPast ? (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                          <p className="text-sm text-gray-600">
                            Esta carrera ya está cerrada
                          </p>
                        </div>
                      ) : (
                        <Link
                          href={`/penca/${params.slug}/race/${race.id}/predict`}
                          className="block w-full bg-indigo-600 text-white text-center py-2 rounded-lg hover:bg-indigo-700 font-medium"
                        >
                          Hacer Predicción
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Leaderboard */}
        <div className="mt-8 bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">🏆 Tabla de Posiciones</h2>
          </div>
          
          {leaderboardWithPoints.length === 0 ? (
            <div className="p-6 text-center text-gray-600">
              No hay participantes todavía
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Posición
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Jugador
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Puntos
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {leaderboardWithPoints.map((player, index) => {
                    const isCurrentUser = player.user_id === session.user.id;
                    const position = index + 1;
                    
                    return (
                      <tr key={player.user_id} className={isCurrentUser ? 'bg-blue-50' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {position === 1 && <span className="text-2xl mr-2">🥇</span>}
                            {position === 2 && <span className="text-2xl mr-2">🥈</span>}
                            {position === 3 && <span className="text-2xl mr-2">🥉</span>}
                            <span className={`text-sm font-medium ${
                              position <= 3 ? 'text-gray-900' : 'text-gray-600'
                            }`}>
                              #{position}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {player.display_name}
                            {isCurrentUser && (
                              <span className="ml-2 text-xs text-blue-600 font-semibold">(Tú)</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className={`text-lg font-bold ${
                            position === 1 ? 'text-yellow-600' :
                            position === 2 ? 'text-gray-500' :
                            position === 3 ? 'text-orange-600' :
                            'text-gray-900'
                          }`}>
                            {player.total_points}
                          </span>
                          <span className="text-xs text-gray-500 ml-1">pts</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
