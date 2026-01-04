const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Leer .env.local manualmente
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.SUPABASE_SERVICE_ROLE_KEY
);

// Simular exactamente lo que hace la página
async function simulatePageLoad() {
  console.log('=== SIMULATING PAGE LOAD ===\n');

  // 1. Obtener penca
  const { data: penca } = await supabase
    .from('pencas')
    .select('id, name')
    .eq('slug', 'mensual-maronas')
    .single();

  console.log(`Penca: ${penca.name}`);

  // 2. Obtener membership (usar el ID de Alana del screenshot)
  const { data: membership } = await supabase
    .from('memberships')
    .select(`*, profiles:user_id (display_name)`)
    .eq('id', '5d19501d-7d05-420f-8f83-8e6a01aa8934')
    .eq('penca_id', penca.id)
    .single();

  console.log(`Jugador: ${membership.guest_name || membership.profiles?.display_name}`);

  // 3. Obtener races
  const { data: races } = await supabase
    .from('races')
    .select('id, seq, venue, distance_m, start_at, status')
    .eq('penca_id', penca.id)
    .order('seq', { ascending: false });

  console.log(`\nTotal races: ${races.length}`);
  const allRaceIds = races.map(race => race.id);

  // 4. Obtener race_results en lotes
  console.log('\n=== FETCHING RACE_RESULTS ===');
  const BATCH_SIZE = 100;
  const resultsBatches = [];
  
  for (let i = 0; i < allRaceIds.length; i += BATCH_SIZE) {
    const batch = allRaceIds.slice(i, i + BATCH_SIZE);
    console.log(`Batch ${Math.floor(i/BATCH_SIZE) + 1}: ${batch.length} IDs`);
    
    const { data: batchData } = await supabase
      .from('race_results')
      .select('*')
      .in('race_id', batch);
    
    console.log(`  Got ${batchData.length} results`);
    resultsBatches.push(...batchData);
  }

  console.log(`\nTotal race_results: ${resultsBatches.length}`);

  // 5. Filtrar published races
  const raceIdsWithResults = new Set(resultsBatches.map(r => r.race_id));
  const publishedRaces = races.filter(race =>
    race.status === 'result_published' || raceIdsWithResults.has(race.id)
  );

  console.log(`Published races to display: ${publishedRaces.length}`);
  
  // Mostrar las primeras 10 y últimas 10
  console.log('\n=== FIRST 10 RACES ===');
  publishedRaces.slice(0, 10).forEach(r => {
    console.log(`#${r.seq}: ${r.venue}`);
  });

  console.log('\n=== LAST 10 RACES ===');
  publishedRaces.slice(-10).forEach(r => {
    console.log(`#${r.seq}: ${r.venue}`);
  });

  const publishedRaceIds = publishedRaces.map(race => race.id);

  // 6. Obtener predictions en lotes
  console.log('\n=== FETCHING PREDICTIONS ===');
  const predictionsBatches = [];
  for (let i = 0; i < publishedRaceIds.length; i += BATCH_SIZE) {
    const batch = publishedRaceIds.slice(i, i + BATCH_SIZE);
    console.log(`Batch ${Math.floor(i/BATCH_SIZE) + 1}: ${batch.length} IDs`);
    
    const { data: batchData } = await supabase
      .from('predictions')
      .select('id, race_id, winner_pick, exacta_pick, trifecta_pick, created_at')
      .eq('membership_id', membership.id)
      .in('race_id', batch);
    
    console.log(`  Got ${batchData ? batchData.length : 0} predictions`);
    if (batchData) predictionsBatches.push(...batchData);
  }

  console.log(`\nTotal predictions: ${predictionsBatches.length}`);
  console.log(`Predictions have data for ${new Set(predictionsBatches.map(p => p.race_id)).size} races`);
}

simulatePageLoad().catch(console.error);
