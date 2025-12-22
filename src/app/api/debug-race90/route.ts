import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get race #90
  const { data: race90 } = await supabase
    .from('races')
    .select('*')
    .eq('seq', 90)
    .single();

  if (!race90) {
    return NextResponse.json({ error: 'Race 90 not found' });
  }

  // Get race result
  const { data: raceResult } = await supabase
    .from('race_results')
    .select('*')
    .eq('race_id', race90.id)
    .single();

  // Get entries for race 90
  const { data: entries } = await supabase
    .from('race_entries')
    .select('*')
    .eq('race_id', race90.id);

  // Normalize result
  function normalizeRaceResult(result: any) {
    if (result.first_place) {
      return result;
    }
    const order = result.official_order || [];
    return {
      ...result,
      first_place: order[0] || null,
      second_place: order[1] || null,
      third_place: order[2] || null,
      fourth_place: order[3] || null,
    };
  }

  const normalized = raceResult ? normalizeRaceResult(raceResult) : null;

  // Build maps
  const entriesById: Record<string, any> = {};
  const entriesByProgram: Record<string, any> = {};

  entries?.forEach(entry => {
    entriesById[entry.id] = entry;
    entriesByProgram[String(entry.program_number)] = entry;
  });

  // Try to find entries by the IDs in normalized result
  const results = {
    race90,
    raceResult,
    normalized,
    entries,
    entriesById: Object.keys(entriesById),
    entriesByProgram: Object.keys(entriesByProgram),
    firstPlaceId: normalized?.first_place,
    firstPlaceEntry: normalized?.first_place ? entriesById[normalized.first_place] : null,
    secondPlaceId: normalized?.second_place,
    secondPlaceEntry: normalized?.second_place ? entriesById[normalized.second_place] : null,
  };

  return NextResponse.json(results, { status: 200 });
}
