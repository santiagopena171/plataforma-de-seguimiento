import type { NextApiRequest, NextApiResponse } from 'next';
import { createServiceRoleClient } from '@/lib/supabase/client';

const resolveEntryDisplay = (
  raw: string | null,
  entriesMap: Record<string, any>,
  entriesByNumber: Record<string, any>
) => {
  if (!raw) {
    return { number: null, label: null };
  }

  const entryById = entriesMap[raw];
  if (entryById) {
    return {
      number: entryById.program_number,
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

const formatPickLabel = (
  raw: string | null,
  entriesMap: Record<string, any>,
  entriesByNumber: Record<string, any>
) => {
  const entry = resolveEntryDisplay(raw, entriesMap, entriesByNumber);
  return entry.number ? `Caballo #${entry.number}` : 'Caballo #?';
};

const formatSequenceLabel = (
  values: string[] | null,
  entriesMap: Record<string, any>,
  entriesByNumber: Record<string, any>
) => {
  if (!values || values.length === 0) return null;
  return values
    .map((value) => formatPickLabel(value, entriesMap, entriesByNumber))
    .join(' → ');
};

const getMembershipDisplayName = (membership?: any) =>
  membership?.guest_name ||
  membership?.profiles?.display_name ||
  membership?.profiles?.full_name ||
  membership?.profiles?.email ||
  'Sin nombre';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServiceRoleClient();
    const { raceId } = req.query;

    if (typeof raceId !== 'string') {
      return res.status(400).json({ error: 'Invalid race id' });
    }

    const { data: race } = await supabase
      .from('races')
      .select('id')
      .eq('id', raceId)
      .single();

    if (!race) {
      return res.status(404).json({ rows: [] });
    }

    const [
      { data: entries, error: entriesError },
      { data: predictions, error: predictionsError },
      { data: scores, error: scoresError },
    ] =
      await Promise.all([
        supabase
          .from('race_entries')
          .select('id, program_number, label')
          .eq('race_id', raceId),
        supabase
          .from('predictions')
          .select(`
            *,
            memberships!predictions_membership_id_fkey (
              id,
              guest_name,
              profiles:user_id (
                display_name
              )
            )
          `)
          .eq('race_id', raceId),
        supabase
          .from('scores')
          .select(`
            *,
            memberships!scores_membership_id_fkey (
              id,
              guest_name,
              profiles:user_id (
                display_name
              )
            )
          `)
          .eq('race_id', raceId)
          .order('points_total', { ascending: false }),
      ]);

    if (entriesError || predictionsError || scoresError) {
      console.error('PUBLIC RACE SCORES API ERRORS', {
        entriesError,
        predictionsError,
        scoresError,
      });
      return res.status(500).json({
        error: 'Failed to load scores',
        entriesError,
        predictionsError,
        scoresError,
      });
    }

    const entriesMap: Record<string, any> = {};
    const entriesByNumber: Record<string, any> = {};
    (entries || []).forEach((entry: any) => {
      entriesMap[entry.id] = entry;
      entriesByNumber[String(entry.program_number)] = entry;
    });

    const scoreByMembership = new Map(
      (scores || []).map((score: any) => [score.membership_id, score])
    );
    const predictionByMembership = new Map(
      (predictions || []).map((prediction: any) => [
        prediction.membership_id,
        prediction,
      ])
    );

    const rowsFromScores = (scores || []).map((score: any) => {
      const prediction = predictionByMembership.get(score.membership_id);
      return {
        membershipId: score.membership_id,
        name: getMembershipDisplayName(score.memberships),
        winner: formatPickLabel(
          prediction?.winner_pick || null,
          entriesMap,
          entriesByNumber
        ),
        exacta: formatSequenceLabel(
          prediction?.exacta_pick || null,
          entriesMap,
          entriesByNumber
        ),
        trifecta: formatSequenceLabel(
          prediction?.trifecta_pick || null,
          entriesMap,
          entriesByNumber
        ),
        points: score?.points_total ?? 0,
        breakdown: score?.breakdown || null,
      };
    });

    const predictionsWithoutScore = (predictions || []).filter(
      (prediction: any) => !scoreByMembership.has(prediction.membership_id)
    );

    const rowsFromPredictions = predictionsWithoutScore.map(
      (prediction: any) => ({
        membershipId: prediction.membership_id,
        name: getMembershipDisplayName(prediction.memberships),
        winner: formatPickLabel(
          prediction.winner_pick,
          entriesMap,
          entriesByNumber
        ),
        exacta: formatSequenceLabel(
          prediction.exacta_pick,
          entriesMap,
          entriesByNumber
        ),
        trifecta: formatSequenceLabel(
          prediction.trifecta_pick,
          entriesMap,
          entriesByNumber
        ),
        points: 0,
        breakdown: null,
      })
    );

    const rows = [...rowsFromScores, ...rowsFromPredictions].sort(
      (a, b) => (b.points ?? 0) - (a.points ?? 0)
    );

    return res.status(200).json({ rows });
  } catch (error) {
    console.error('Error fetching race scores for public view', error);
    return res.status(500).json({ error: 'Failed to load scores' });
  }
}
