import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServiceRoleClient } from '@/lib/supabase/client';

interface PageProps {
  params: {
    slug: string;
    membershipId: string;
  };
}

const formatEntry = (entry: any, fallbackId?: string | null) => {
  if (!entry) {
    return fallbackId ? `#${fallbackId}` : '—';
  }
  const horse = entry.horse_name ? ` ${entry.horse_name}` : '';
  return `#${entry.program_number}${horse}`;
};

const formatHorseNumber = (entry?: any, fallbackId?: string | null) => {
  if (entry?.program_number) {
    return `caballo #${entry.program_number}`;
  }
  if (fallbackId && /^[0-9]+$/.test(fallbackId)) {
    return `caballo #${fallbackId}`;
  }
  return 'caballo #?';
};

const normalizeRaceResult = (result: any) => {
  if (!result) return result;
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

export default async function PublicPlayerPredictionsPage({ params }: PageProps) {
  const supabase = createServiceRoleClient();

  const { data: penca } = await supabase
    .from('pencas')
    .select('id, name')
    .eq('slug', params.slug)
    .single();

  if (!penca) {
    notFound();
  }

  const { data: membership } = await supabase
    .from('memberships')
    .select(
      `
        *,
        profiles:user_id (
          display_name
        )
      `
    )
    .eq('id', params.membershipId)
    .eq('penca_id', penca.id)
    .single();

  if (!membership || membership.role === 'admin') {
    notFound();
  }

  const playerName =
    membership.guest_name ||
    membership.profiles?.display_name ||
    'Sin nombre';

  const { data: races } = await supabase
    .from('races')
    .select('id, seq, venue, distance_m, start_at, status')
    .eq('penca_id', penca.id)
    .order('start_at', { ascending: false });

  const allRaceIds = (races || []).map((race: any) => race.id);

  let raceResults: any[] = [];
  if (allRaceIds.length > 0) {
    const { data: fetchedResults } = await supabase
      .from('race_results')
      .select('*')
      .in('race_id', allRaceIds);
    raceResults = fetchedResults || [];
  }

  const raceIdsWithResults = new Set(
    raceResults.map((result: any) => result.race_id)
  );

  const publishedRaces = (races || []).filter(
    (race: any) =>
      race.status === 'result_published' || raceIdsWithResults.has(race.id)
  );
  const publishedRaceIds = publishedRaces.map((race: any) => race.id);

  let predictions: any[] = [];
  let scores: any[] = [];
  let entries: any[] = [];

  if (publishedRaceIds.length > 0) {
    const { data: fetchedPredictions } = await supabase
      .from('predictions')
      .select('id, race_id, winner_pick, exacta_pick, trifecta_pick, created_at')
      .eq('membership_id', membership.id)
      .in('race_id', publishedRaceIds);
    predictions = fetchedPredictions || [];

    const { data: fetchedScores } = await supabase
      .from('scores')
      .select('id, race_id, points_total, breakdown')
      .eq('membership_id', membership.id)
      .in('race_id', publishedRaceIds);
    scores = fetchedScores || [];

    const { data: fetchedEntries } = await supabase
      .from('race_entries')
      .select('id, race_id, program_number, horse_name:label')
      .in('race_id', publishedRaceIds);
    entries = fetchedEntries || [];
  }

  const predictionEntryIds = Array.from(
    new Set(
      predictions
        .flatMap((prediction: any) => [
          prediction.winner_pick,
          ...(prediction.exacta_pick || []),
          ...(prediction.trifecta_pick || []),
        ])
        .filter(Boolean)
    )
  );

  if (predictionEntryIds.length > 0) {
    const { data: extraEntries } = await supabase
      .from('race_entries')
      .select('id, race_id, program_number, horse_name:label')
      .in('id', predictionEntryIds);
    entries = entries.concat(extraEntries || []);
  }

  const resultsMap = new Map(
    raceResults.map((result: any) => {
      const normalized = normalizeRaceResult(result);
      return [normalized.race_id, normalized];
    })
  );
  const predictionsMap = new Map(
    predictions.map((prediction: any) => [prediction.race_id, prediction])
  );
  const scoresMap = new Map(
    scores.map((score: any) => [score.race_id, score])
  );
  type RaceEntriesMaps = {
    byId: Record<string, any>;
    byProgram: Record<string | number, any>;
  };

  const entriesByRace = new Map<string, RaceEntriesMaps>();
  const entryById = new Map<string, any>();

  const addEntryToMaps = (entry: any) => {
    if (!entry) return;
    entryById.set(entry.id, entry);
    if (!entriesByRace.has(entry.race_id)) {
      entriesByRace.set(entry.race_id, { byId: {}, byProgram: {} });
    }
    const raceEntries = entriesByRace.get(entry.race_id)!;
    raceEntries.byId[entry.id] = entry;
    raceEntries.byProgram[String(entry.program_number)] = entry;
  };

  entries.forEach(addEntryToMaps);

  const getEntryFromRace = (
    raceEntries: RaceEntriesMaps | undefined,
    pick?: string | null
  ) => {
    if (!pick) return undefined;
    if (raceEntries) {
      const entry =
        raceEntries.byId[pick] || raceEntries.byProgram[String(pick)];
      if (entry) return entry;
    }
    return entryById.get(pick);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <Link
              href={`/public/${params.slug}`}
              className="text-gray-600 hover:text-gray-900"
            >
              ← Volver
            </Link>
            <span className="text-gray-400">/</span>
            <div>
              <p className="text-sm text-gray-500 uppercase tracking-wide">
                Predicciones del jugador
              </p>
              <h1 className="text-2xl font-bold text-gray-900">{playerName}</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {publishedRaces.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            No hay carreras con resultados publicados para este jugador todavía.
          </div>
        ) : (
          publishedRaces.map((race: any) => {
            const raceResult = resultsMap.get(race.id);
            const playerPrediction = predictionsMap.get(race.id);
            const playerScore = scoresMap.get(race.id);
            const raceEntries = entriesByRace.get(race.id);

            const raceDateLabel = race.start_at
              ? new Date(race.start_at).toLocaleDateString('es-UY')
              : 'Sin fecha';

            return (
              <div
                key={race.id}
                className="bg-white rounded-lg shadow p-6 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">
                      Carrera #{race.seq || '—'}
                    </p>
                    <h2 className="text-xl font-semibold text-gray-900">
                      {race.venue}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {race.distance_m}m • {raceDateLabel}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Puntaje</p>
                    <p className="text-2xl font-bold text-indigo-600">
                      {playerScore?.points_total ?? 0} pts
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <p className="text-xs uppercase text-gray-500 tracking-wide mb-2">
                      Resultado Oficial
                    </p>
                    {raceResult ? (
                      <ul className="space-y-1 text-sm text-gray-700">
                        <li>
                          🥇{' '}
                          {formatHorseNumber(
                            getEntryFromRace(raceEntries, raceResult.first_place),
                            raceResult.first_place
                          )}
                        </li>
                        <li>
                          🥈{' '}
                          {formatHorseNumber(
                            getEntryFromRace(raceEntries, raceResult.second_place),
                            raceResult.second_place
                          )}
                        </li>
                        <li>
                          🥉{' '}
                          {formatHorseNumber(
                            getEntryFromRace(raceEntries, raceResult.third_place),
                            raceResult.third_place
                          )}
                        </li>
                        <li>
                          <span className="font-semibold text-gray-900">4°</span>{' '}
                          {formatHorseNumber(
                            getEntryFromRace(raceEntries, raceResult.fourth_place),
                            raceResult.fourth_place
                          )}
                        </li>
                      </ul>
                    ) : (
                      <p className="text-gray-400 text-sm">
                        Sin resultado registrado.
                      </p>
                    )}
                  </div>

                    <div className="border border-gray-200 rounded-lg p-4 md:col-span-2">
                    <p className="text-xs uppercase text-gray-500 tracking-wide mb-2">
                      Predicción del jugador
                    </p>
                    {playerPrediction ? (
                      <div className="space-y-2 text-sm text-gray-700">
                        {(() => {
                          const winnerEntry = getEntryFromRace(
                            raceEntries,
                            playerPrediction.winner_pick
                          );
                          if (!winnerEntry) {
                            console.warn('Missing entry for winner_pick', {
                              raceId: race.id,
                              pick: playerPrediction.winner_pick,
                              raceEntriesIds: Object.keys(
                                raceEntries?.byId || {}
                              ),
                              raceEntriesPrograms: Object.keys(
                                raceEntries?.byProgram || {}
                              ),
                              entryByIdHas: entryById.has(
                                playerPrediction.winner_pick || ''
                              ),
                            });
                          }
                          return null;
                        })()}
                        <div className="font-semibold text-gray-900">
                          {formatHorseNumber(
                            getEntryFromRace(
                              raceEntries,
                              playerPrediction.winner_pick
                            ),
                            playerPrediction.winner_pick
                          )}
                        </div>
                        {playerPrediction.exacta_pick &&
                          playerPrediction.exacta_pick.length > 0 && (
                            <div>
                              <span className="font-semibold text-gray-900">
                                Exacta:{' '}
                              </span>
                              {playerPrediction.exacta_pick
                                .map((pick: string) =>
                                  formatHorseNumber(
                                    getEntryFromRace(raceEntries, pick),
                                    pick
                                  )
                                )
                                .join(' → ')}
                            </div>
                          )}
                        {playerPrediction.trifecta_pick &&
                          playerPrediction.trifecta_pick.length > 0 && (
                            <div>
                              <span className="font-semibold text-gray-900">
                                Trifecta:{' '}
                              </span>
                              {playerPrediction.trifecta_pick
                                .map((pick: string) =>
                                  formatHorseNumber(
                                    getEntryFromRace(raceEntries, pick),
                                    pick
                                  )
                                )
                                .join(' → ')}
                            </div>
                          )}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-sm">
                        Este jugador no presentó predicción para esta carrera.
                      </p>
                    )}
                  </div>
                </div>

                {playerScore?.breakdown && (
                  <div className="border border-dashed border-gray-200 rounded-lg p-4 bg-gray-50">
                    <p className="text-xs uppercase text-gray-500 tracking-wide mb-2">
                      Detalle de puntos
                    </p>
                    <div className="flex flex-wrap gap-3 text-sm text-gray-700">
                      {Object.entries(playerScore.breakdown).map(
                        ([key, value]) => (
                          <span
                            key={key}
                            className="px-3 py-1 bg-white border border-gray-200 rounded-full"
                          >
                            obtuvo <strong>{value} pts</strong>
                          </span>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
