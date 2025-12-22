import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const membershipId = searchParams.get('membershipId') || '3b5699a2-fa93-4ece-8f34-1d3ed7e7f733';
  const pencaSlug = searchParams.get('slug') || 'mensual-maronas';
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get penca
  const { data: penca } = await supabase
    .from('pencas')
    .select('*')
    .eq('slug', pencaSlug)
    .single();

  if (!penca) {
    return NextResponse.json({ error: 'Penca not found' });
  }

  // Get published races
  const { data: publishedRaces } = await supabase
    .from('races')
    .select('*')
    .eq('penca_id', penca.id)
    .eq('status', 'result_published')
    .order('seq', { ascending: false })
    .limit(3);

  // Get race results
  const raceIds = publishedRaces?.map((r: any) => r.id) || [];
  const { data: raceResults } = await supabase
    .from('race_results')
    .select('*')
    .in('race_id', raceIds);

  // Get ALL entries for these races
  const { data: entries } = await supabase
    .from('race_entries')
    .select('id, race_id, program_number, horse_name:label')
    .in('race_id', raceIds);

  // Normalize results
  function normalizeRaceResult(result: any) {
    if (result.first_place) return result;
    const order = result.official_order || [];
    return {
      ...result,
      first_place: order[0] || null,
      second_place: order[1] || null,
      third_place: order[2] || null,
      fourth_place: order[3] || null,
    };
  }

  const normalizedResults = raceResults?.map(normalizeRaceResult) || [];
  
  // Build entryById Map
  const entryByIdObj: Record<string, any> = {};
  entries?.forEach((entry: any) => {
    entryByIdObj[entry.id] = entry;
  });

  // Test rendering
  const testRace = publishedRaces?.[0];
  const testResult = normalizedResults.find((r: any) => r.race_id === testRace?.id);
  
  const rendered = testResult ? {
    first: entryByIdObj[testResult.first_place]?.program_number || '?',
    second: entryByIdObj[testResult.second_place]?.program_number || '?',
    third: entryByIdObj[testResult.third_place]?.program_number || '?',
    fourth: entryByIdObj[testResult.fourth_place]?.program_number || '?',
  } : null;

  return NextResponse.json({
    race: testRace,
    result: testResult,
    entriesCount: entries?.length || 0,
    entryByIdKeys: Object.keys(entryByIdObj).length,
    firstPlaceId: testResult?.first_place,
    firstPlaceEntry: entryByIdObj[testResult?.first_place],
    secondPlaceId: testResult?.second_place,
    secondPlaceEntry: entryByIdObj[testResult?.second_place],
    rendered,
  });
}
