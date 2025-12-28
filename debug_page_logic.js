const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://jvsejwjvhhzjuxcrhunk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2c2Vqd2p2aGh6anV4Y3JodW5rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjgwOTQyNCwiZXhwIjoyMDc4Mzg1NDI0fQ.NBXdIsRUPrxdiO_t_aPUNhHJbOMqEPxlnA5VAQevEQ0'
);

const normalizeRaceResult = (result) => {
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

async function simulatePageLogic() {
  console.log('=== SIMULANDO LÓGICA DE LA PÁGINA ===\n');

  const membershipId = '9c6496d0-16f2-424c-ba88-15add6682fdc';
  const slug = 'mensual-maronas';

  // 1. Obtener penca
  const { data: penca } = await supabase
    .from('pencas')
    .select('id, name')
    .eq('slug', slug)
    .single();

  console.log('1. Penca:', penca.name);

  // 2. Obtener membership
  const { data: membership } = await supabase
    .from('memberships')
    .select(`
      *,
      profiles:user_id (
        display_name
      )
    `)
    .eq('id', membershipId)
    .eq('penca_id', penca.id)
    .single();

  console.log('2. Membership:', membership.guest_name || membership.profiles?.display_name);

  // 3. Obtener races
  const { data: races } = await supabase
    .from('races')
    .select('id, seq, venue, distance_m, start_at, status')
    .eq('penca_id', penca.id)
    .in('seq', [104, 105])
    .order('seq', { ascending: false });

  console.log('3. Races:', races.map(r => `#${r.seq}`).join(', '));

  const allRaceIds = races.map(race => race.id);

  // 4. Obtener race_results y normalizar inmediatamente
  const { data: fetchedResults } = await supabase
    .from('race_results')
    .select('*')
    .in('race_id', allRaceIds);

  console.log('\n4. Race results antes de normalizar:', fetchedResults.length);
  const raceResults = (fetchedResults || []).map(result => normalizeRaceResult(result));
  console.log('   Race results después de normalizar:', raceResults.length);

  raceResults.forEach((result, idx) => {
    const race = races.find(r => r.id === result.race_id);
    console.log(`   - Carrera #${race.seq}:`);
    console.log(`     first_place: ${result.first_place}`);
    console.log(`     second_place: ${result.second_place}`);
  });

  const raceIdsWithResults = new Set(raceResults.map(result => result.race_id));
  const publishedRaces = races.filter(race =>
    race.status === 'result_published' || raceIdsWithResults.has(race.id)
  );
  const publishedRaceIds = publishedRaces.map(race => race.id);

  console.log('\n5. Published races:', publishedRaces.length);

  let entries = [];

  if (publishedRaceIds.length > 0) {
    const { data: fetchedEntries } = await supabase
      .from('race_entries')
      .select('id, race_id, program_number, horse_name:label')
      .in('race_id', publishedRaceIds);
    entries = fetchedEntries || [];
    console.log('6. Initial entries:', entries.length);
  }

  // Extraer IDs de resultados oficiales NORMALIZADOS
  const resultEntryIds = Array.from(
    new Set(
      raceResults
        .flatMap(result => [
          result.first_place,
          result.second_place,
          result.third_place,
          result.fourth_place,
        ])
        .filter(Boolean)
    )
  );

  console.log('\n7. Result entry IDs:', resultEntryIds.length);
  console.log('   IDs:', resultEntryIds.slice(0, 2).map(id => id.substring(0, 8) + '...'));

  if (resultEntryIds.length > 0) {
    const { data: resultEntries } = await supabase
      .from('race_entries')
      .select('id, race_id, program_number, horse_name:label')
      .in('id', resultEntryIds);
    
    console.log('8. Result entries fetched:', resultEntries?.length || 0);
    entries = entries.concat(resultEntries || []);
    console.log('   Total entries after concat:', entries.length);
  }

  // Crear mapa
  const entryById = new Map();
  entries.forEach(entry => {
    if (entry) {
      entryById.set(entry.id, entry);
    }
  });

  console.log('\n9. EntryById Map size:', entryById.size);

  // Mapear resultados
  const resultsMap = new Map(
    raceResults.map(result => [result.race_id, result])
  );

  console.log('\n10. Testing render logic:');
  publishedRaces.forEach(race => {
    const raceResult = resultsMap.get(race.id);
    console.log(`\n   Carrera #${race.seq}:`);
    if (raceResult) {
      console.log(`     first_place ID: ${raceResult.first_place?.substring(0, 12)}...`);
      const firstEntry = entryById.get(raceResult.first_place);
      console.log(`     First entry found:`, firstEntry ? `#${firstEntry.program_number}` : 'NOT FOUND');
      
      const secondEntry = entryById.get(raceResult.second_place);
      console.log(`     Second entry found:`, secondEntry ? `#${secondEntry.program_number}` : 'NOT FOUND');
    }
  });

  console.log('\n=== FIN SIMULACIÓN ===');
}

simulatePageLogic().catch(console.error);
