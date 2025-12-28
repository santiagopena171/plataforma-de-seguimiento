const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://jvsejwjvhhzjuxcrhunk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2c2Vqd2p2aGh6anV4Y3JodW5rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjgwOTQyNCwiZXhwIjoyMDc4Mzg1NDI0fQ.NBXdIsRUPrxdiO_t_aPUNhHJbOMqEPxlnA5VAQevEQ0'
);

async function debugRaceResults() {
  console.log('=== DEBUGGING RACE RESULTS 104 y 105 ===\n');

  // Obtener información de las carreras 104 y 105
  const { data: races } = await supabase
    .from('races')
    .select('*')
    .in('seq', [104, 105])
    .order('seq');

  console.log('CARRERAS ENCONTRADAS:');
  races.forEach(race => {
    console.log(`  Carrera #${race.seq} - ID: ${race.id}`);
  });
  console.log('');

  // Obtener race_results para estas carreras
  const raceIds = races.map(r => r.id);
  const { data: results } = await supabase
    .from('race_results')
    .select('*')
    .in('race_id', raceIds);

  console.log('RACE_RESULTS:');
  results.forEach(result => {
    const race = races.find(r => r.id === result.race_id);
    console.log(`\n  Carrera #${race.seq}:`);
    console.log(`    first_place: ${result.first_place}`);
    console.log(`    second_place: ${result.second_place}`);
    console.log(`    third_place: ${result.third_place}`);
    console.log(`    fourth_place: ${result.fourth_place}`);
    console.log(`    official_order: ${JSON.stringify(result.official_order)}`);
  });
  console.log('');

  // Normalizar resultados
  const normalizedResults = results.map(result => {
    const order = Array.isArray(result.official_order) ? result.official_order : [];
    const [first, second, third, fourth] = order;
    return {
      race_id: result.race_id,
      first_place: result.first_place || first || null,
      second_place: result.second_place || second || null,
      third_place: result.third_place || third || null,
      fourth_place: result.fourth_place || fourth || null,
    };
  });

  console.log('RESULTADOS NORMALIZADOS:');
  normalizedResults.forEach(result => {
    const race = races.find(r => r.id === result.race_id);
    console.log(`\n  Carrera #${race.seq}:`);
    console.log(`    first_place: ${result.first_place}`);
    console.log(`    second_place: ${result.second_place}`);
    console.log(`    third_place: ${result.third_place}`);
    console.log(`    fourth_place: ${result.fourth_place}`);
  });
  console.log('');

  // Recopilar todos los entry IDs
  const allEntryIds = normalizedResults.flatMap(r => [
    r.first_place,
    r.second_place,
    r.third_place,
    r.fourth_place
  ]).filter(Boolean);

  console.log('ENTRY IDs ÚNICOS:', [...new Set(allEntryIds)]);
  console.log('Total de IDs:', allEntryIds.length);
  console.log('');

  // Obtener las entries
  const { data: entries, error } = await supabase
    .from('race_entries')
    .select('id, race_id, program_number, label')
    .in('id', allEntryIds);

  if (error) {
    console.error('ERROR al obtener entries:', error);
  }

  console.log(`ENTRIES OBTENIDAS: ${entries ? entries.length : 0} de ${allEntryIds.length}`);
  
  if (entries) {
    // Agrupar por carrera
    races.forEach(race => {
      console.log(`\n  Carrera #${race.seq}:`);
      const raceEntries = entries.filter(e => e.race_id === race.id);
      console.log(`    Entries encontradas: ${raceEntries.length}`);
      
      const result = normalizedResults.find(r => r.race_id === race.id);
      if (result) {
        console.log(`    🥇 ${result.first_place}:`, 
          entries.find(e => e.id === result.first_place)?.program_number || 'NO ENCONTRADO');
        console.log(`    🥈 ${result.second_place}:`, 
          entries.find(e => e.id === result.second_place)?.program_number || 'NO ENCONTRADO');
        console.log(`    🥉 ${result.third_place}:`, 
          entries.find(e => e.id === result.third_place)?.program_number || 'NO ENCONTRADO');
        console.log(`    4° ${result.fourth_place}:`, 
          entries.find(e => e.id === result.fourth_place)?.program_number || 'NO ENCONTRADO');
      }
    });
  }

  console.log('\n=== FIN DEBUG ===');
}

debugRaceResults().catch(console.error);
