const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://jvsejwjvhhzjuxcrhunk.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function test() {
  console.log('Testeando renderizado de carrera #90...\n');

  // Get race #90
  const { data: race90 } = await supabase
    .from('races')
    .select('*')
    .eq('seq', 90)
    .single();

  console.log('Race #90 ID:', race90.id);

  // Get result
  const { data: result } = await supabase
    .from('race_results')
    .select('*')
    .eq('race_id', race90.id)
    .single();

  // Get entries
  const { data: entries } = await supabase
    .from('race_entries')
    .select('*')
    .eq('race_id', race90.id);

  console.log('Entries found:', entries.length);

  // Normalize
  const order = result.official_order || [];
  const normalized = {
    first_place: order[0],
    second_place: order[1],
    third_place: order[2],
    fourth_place: order[3],
  };

  // Build map
  const entryById = {};
  entries.forEach(entry => {
    entryById[entry.id] = entry;
  });

  console.log('\nResultados:');
  console.log('🥇 caballo #' + (entryById[normalized.first_place]?.program_number || '?'));
  console.log('🥈 caballo #' + (entryById[normalized.second_place]?.program_number || '?'));
  console.log('🥉 caballo #' + (entryById[normalized.third_place]?.program_number || '?'));
  console.log('4° caballo #' + (entryById[normalized.fourth_place]?.program_number || '?'));

  console.log('\nIDs:');
  console.log('First:', normalized.first_place);
  console.log('Entry:', entryById[normalized.first_place]);
}

test().catch(console.error);
