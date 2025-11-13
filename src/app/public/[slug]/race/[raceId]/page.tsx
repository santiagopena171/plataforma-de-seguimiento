import { cookies } from 'next/headers';
import { createServiceRoleClient } from '@/lib/supabase/client';
import { notFound } from 'next/navigation';
import Link from 'next/link';

interface PageProps {
  params: {
    slug: string;
    raceId: string;
  };
}

const normalizeRaceResult = (result?: any) => {
  if (!result) return null;
  const order = Array.isArray(result.official_order) ? result.official_order : [];
  const [first, second, third, fourth] = order;
  return {
    ...result,
    first_place: result.first_place || first || null,
    second_place: result.second_place || second || null,
    third_place: result.third_place || third || null,
    fourth_place: result.fourth_place || fourth || null,
  };
};

export default async function PublicRaceDetailPage({ params }: PageProps) {
  // Use the service role client on the server-side to bypass RLS for public
  // read-only pages that should show published results to unauthenticated users.
  const supabase = createServiceRoleClient();

  // Obtener la penca
  const { data: penca } = await supabase
    .from('pencas')
    .select('*')
    .eq('slug', params.slug)
    .single();

  if (!penca) {
    notFound();
  }

  // Obtener la carrera
  const { data: race } = await supabase
    .from('races')
    .select('*')
    .eq('id', params.raceId)
    .eq('penca_id', penca.id)
    .single();

  if (!race || race.status !== 'result_published') {
    notFound();
  }

  const raceStartDate = race.start_at ? new Date(race.start_at) : null;
  const hasValidStart =
    raceStartDate && !Number.isNaN(raceStartDate.getTime());
  const raceDateLabel = hasValidStart
    ? raceStartDate.toLocaleDateString('es-UY', { dateStyle: 'medium' })
    : 'Fecha a confirmar';
  const raceTimeLabel = hasValidStart
    ? raceStartDate.toLocaleTimeString('es-UY', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  // Obtener resultado
  const { data: raceResult } = await supabase
    .from('race_results')
    .select('*')
    .eq('race_id', params.raceId)
    .single();

  const normalizedRaceResult = normalizeRaceResult(raceResult);

  // Obtener entradas (participantes)
  const { data: entries } = await supabase
    .from('race_entries')
    .select('*')
    .eq('race_id', params.raceId)
    .order('program_number', { ascending: true });

  // Crear mapa de entradas
  const entriesMap: Record<string, any> = {};
  const entriesByNumber: Record<string, any> = {};
  entries?.forEach((entry: any) => {
    // Normalize: keep the original object but add a `number` alias for older code
    // that expects `entry.number` (some components reference `.number`), while
    // the DB column is `program_number`.
    entry.number = entry.program_number;
    entriesMap[entry.id] = entry;
    entriesByNumber[String(entry.program_number)] = entry;
  });

  const resolveEntryDisplay = (raw?: string | null) => {
    if (!raw) {
      return { number: '—', label: null };
    }
    const entryById = entriesMap[raw];
    if (entryById) {
      return {
        number: entryById.number ?? entryById.program_number ?? raw,
        label: entryById.label || entryById.horse_name || null,
      };
    }
    const entryByProgram = entriesByNumber[String(raw)];
    if (entryByProgram) {
      return {
        number: entryByProgram.program_number,
        label: entryByProgram.label || entryByProgram.horse_name || null,
      };
    }
    return { number: raw, label: null };
  };

  // Obtener predicciones
  const { data: predictions } = await supabase
    .from('predictions')
    .select(`
      *,
      memberships!predictions_membership_id_fkey (
        id,
        guest_name,
        profiles:user_id (
          full_name,
          display_name,
          email
        )
      )
    `)
    .eq('race_id', params.raceId);

  // Obtener scores
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
    .eq('race_id', params.raceId)
    .order('points_total', { ascending: false });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <Link
              href={`/public/${params.slug}`}
              className="text-gray-600 hover:text-gray-900"
            >
              ← Volver
            </Link>
            <span className="text-gray-400">/</span>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{race.venue}</h1>
                <p className="text-sm text-gray-600">
                  {race.distance_m}m • {raceDateLabel}
                  {raceTimeLabel ? ` ${raceTimeLabel}` : ''}
                </p>
              </div>
            </div>
          </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Race Result */}
        {normalizedRaceResult && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              🏁 Resultado Oficial
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  key: 'first_place' as const,
                  label: '1° Lugar',
                  icon: '🥇',
                  container: 'bg-yellow-50 border border-yellow-200',
                },
                {
                  key: 'second_place' as const,
                  label: '2° Lugar',
                  icon: '🥈',
                  container: 'bg-gray-50 border border-gray-200',
                },
                {
                  key: 'third_place' as const,
                  label: '3° Lugar',
                  icon: '🥉',
                  container: 'bg-orange-50 border border-orange-200',
                },
                {
                  key: 'fourth_place' as const,
                  label: '4° Lugar',
                  icon: '🏅',
                  container: 'bg-indigo-50 border border-indigo-200',
                },
              ].map((place) => {
                const entry = resolveEntryDisplay(
                  normalizedRaceResult[place.key]
                );
                const horseNumberLabel = entry.number
                  ? `Caballo #${entry.number}`
                  : 'Caballo #?';
                return (
                  <div
                    key={place.key}
                    className={`${place.container} rounded-lg p-4 text-center`}
                  >
                    <div className="text-3xl mb-2">{place.icon}</div>
                    <div className="text-sm text-gray-600">{place.label}</div>
                    <div className="text-xl font-bold text-gray-900">
                      {horseNumberLabel}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Scores Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              📊 Puntuaciones
            </h2>
          </div>

          {!scores || scores.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No hay puntuaciones disponibles.
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
                      Predicción
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Puntos
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {scores.map((score: any, index: number) => {
                    const membership = score.memberships;
                    const name = membership?.guest_name || 
                               membership?.profiles?.display_name || 
                               membership?.profiles?.full_name || 
                               membership?.profiles?.email || 
                               'Sin nombre';

                    // Buscar predicción correspondiente
                    const prediction = predictions?.find((p: any) => 
                      p.membership_id === score.membership_id
                    );

                    return (
                      <tr key={score.id} className={index < 3 ? 'bg-yellow-50' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {index === 0 && '🥇'}
                          {index === 1 && '🥈'}
                          {index === 2 && '🥉'}
                          {index > 2 && `${index + 1}°`}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 text-center">
                          {prediction ? (
                            <div className="flex gap-2 justify-center">
                              <span>
                                #{(entriesMap[prediction.winner_pick]?.number || entriesByNumber[String(prediction.winner_pick)]?.program_number) || '?'}
                              </span>
                              <span>-</span>
                              <span>
                                #{(entriesMap[prediction.exacta_pick?.[1]]?.number || entriesByNumber[String(prediction.exacta_pick?.[1])]?.program_number) || '?'}
                              </span>
                              <span>-</span>
                              <span>
                                #{(entriesMap[prediction.trifecta_pick?.[2]]?.number || entriesByNumber[String(prediction.trifecta_pick?.[2])]?.program_number) || '?'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400">Sin predicción</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-center">
                          {score.points_total}
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
