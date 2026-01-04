import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServiceRoleClient } from '@/lib/supabase/client';

interface PageProps {
  params: {
    slug: string;
    membershipId: string;
  };
}

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
    .order('seq', { ascending: false });

  const allRaceIds = (races || []).map((race: any) => race.id);

  let raceResults: any[] = [];
  if (allRaceIds.length > 0) {
    // Consultar en lotes para evitar límites de URL
    const BATCH_SIZE = 100;
    const resultsBatches: any[] = [];
    
    for (let i = 0; i < allRaceIds.length; i += BATCH_SIZE) {
      const batch = allRaceIds.slice(i, i + BATCH_SIZE);
      const { data: batchData } = await supabase
        .from('race_results')
        .select('*')
        .in('race_id', batch);
      
      if (batchData) {
        resultsBatches.push(...batchData);
      }
    }
    
    // Normalizar resultados inmediatamente después de obtenerlos
    raceResults = resultsBatches.map((result: any) => normalizeRaceResult(result));
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
    const BATCH_SIZE = 100;

    // Buscar predicciones por membership_id primero (en lotes)
    const predictionsBatches: any[] = [];
    for (let i = 0; i < publishedRaceIds.length; i += BATCH_SIZE) {
      const batch = publishedRaceIds.slice(i, i + BATCH_SIZE);
      const { data: batchData } = await supabase
        .from('predictions')
        .select('id, race_id, winner_pick, exacta_pick, trifecta_pick, created_at')
        .eq('membership_id', membership.id)
        .in('race_id', batch);
      if (batchData) {
        predictionsBatches.push(...batchData);
      }
    }
    predictions = predictionsBatches;

    // Si no hay predicciones y el miembro tiene user_id, buscar por user_id como fallback
    if (predictions.length === 0 && membership.user_id) {
      const fallbackPredictionsBatches: any[] = [];
      for (let i = 0; i < publishedRaceIds.length; i += BATCH_SIZE) {
        const batch = publishedRaceIds.slice(i, i + BATCH_SIZE);
        const { data: batchData } = await supabase
          .from('predictions')
          .select('id, race_id, winner_pick, exacta_pick, trifecta_pick, created_at')
          .eq('user_id', membership.user_id)
          .in('race_id', batch);
        if (batchData) {
          fallbackPredictionsBatches.push(...batchData);
        }
      }
      predictions = fallbackPredictionsBatches;
    }

    // Buscar scores por membership_id primero (en lotes)
    const scoresBatches: any[] = [];
    for (let i = 0; i < publishedRaceIds.length; i += BATCH_SIZE) {
      const batch = publishedRaceIds.slice(i, i + BATCH_SIZE);
      const { data: batchData } = await supabase
        .from('scores')
        .select('id, race_id, points_total, breakdown')
        .eq('membership_id', membership.id)
        .in('race_id', batch);
      if (batchData) {
        scoresBatches.push(...batchData);
      }
    }
    scores = scoresBatches;

    // Si no hay scores y el miembro tiene user_id, buscar por user_id como fallback
    if (scores.length === 0 && membership.user_id) {
      const fallbackScoresBatches: any[] = [];
      for (let i = 0; i < publishedRaceIds.length; i += BATCH_SIZE) {
        const batch = publishedRaceIds.slice(i, i + BATCH_SIZE);
        const { data: batchData } = await supabase
          .from('scores')
          .select('id, race_id, points_total, breakdown')
          .eq('user_id', membership.user_id)
          .in('race_id', batch);
        if (batchData) {
          fallbackScoresBatches.push(...batchData);
        }
      }
      scores = fallbackScoresBatches;
    }

    // Buscar entries (en lotes)
    const entriesBatches: any[] = [];
    for (let i = 0; i < publishedRaceIds.length; i += BATCH_SIZE) {
      const batch = publishedRaceIds.slice(i, i + BATCH_SIZE);
      const { data: batchData } = await supabase
        .from('race_entries')
        .select('id, race_id, program_number, horse_name:label')
        .in('race_id', batch);
      if (batchData) {
        entriesBatches.push(...batchData);
      }
    }
    entries = entriesBatches;
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

  // Obtener entries de los resultados oficiales (ya normalizados)
  const resultEntryIds = Array.from(
    new Set(
      raceResults
        .flatMap((result: any) => [
          result.first_place,
          result.second_place,
          result.third_place,
          result.fourth_place,
        ])
        .filter(Boolean)
    )
  );

  // Hacer consultas en lotes para evitar límites de URL
  if (resultEntryIds.length > 0) {
    const BATCH_SIZE = 100; // Consultar máximo 100 IDs a la vez
    const resultEntriesBatches: any[] = [];
    
    for (let i = 0; i < resultEntryIds.length; i += BATCH_SIZE) {
      const batch = resultEntryIds.slice(i, i + BATCH_SIZE);
      const { data: batchData } = await supabase
        .from('race_entries')
        .select('id, race_id, program_number, horse_name:label')
        .in('id', batch);
      
      if (batchData) {
        resultEntriesBatches.push(...batchData);
      }
    }
    
    if (resultEntriesBatches.length > 0) {
      entries = entries.concat(resultEntriesBatches);
    }
  }

  const resultsMap = new Map(
    raceResults.map((result: any) => [result.race_id, result])
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
                        <li>🥇 caballo #{entryById.get(raceResult.first_place)?.program_number || '?'}</li>
                        <li>🥈 caballo #{entryById.get(raceResult.second_place)?.program_number || '?'}</li>
                        <li>🥉 caballo #{entryById.get(raceResult.third_place)?.program_number || '?'}</li>
                        <li><span className="font-semibold text-gray-900">4°</span> caballo #{entryById.get(raceResult.fourth_place)?.program_number || '?'}</li>
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
                        <div className="font-semibold text-gray-900">
                          caballo #{entryById.get(playerPrediction.winner_pick)?.program_number || playerPrediction.winner_pick || '?'}
                        </div>
                        {playerPrediction.exacta_pick &&
                          playerPrediction.exacta_pick.length > 0 && (
                            <div>
                              <span className="font-semibold text-gray-900">
                                Exacta:{' '}
                              </span>
                              {playerPrediction.exacta_pick
                                .map((pick: string) => 
                                  `caballo #${entryById.get(pick)?.program_number || pick || '?'}`
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
                                  `caballo #${entryById.get(pick)?.program_number || pick || '?'}`
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
                            obtuvo{' '}
                            <strong>
                              {typeof value === 'number' || typeof value === 'string'
                                ? value
                                : Array.isArray(value)
                                  ? value.join(', ')
                                  : JSON.stringify(value)}
                            </strong>{' '}
                            pts
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
