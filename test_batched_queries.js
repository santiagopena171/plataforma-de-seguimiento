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

async function testBatchedQueries() {
  console.log('=== TESTING BATCHED QUERIES ===\n');

  // 1. Obtener todas las carreras
  const { data: allRaces, error: racesError } = await supabase
    .from('races')
    .select('id, seq, status')
    .order('seq', { ascending: false });

  if (racesError) {
    console.error('Error obteniendo carreras:', racesError);
    return;
  }

  console.log(`Total de carreras: ${allRaces.length}`);
  const allRaceIds = allRaces.map(r => r.id);

  // 2. Probar query de race_results en lotes
  console.log('\n=== TESTING RACE_RESULTS BATCHED ===');
  const BATCH_SIZE = 100;
  const resultsBatches = [];
  
  for (let i = 0; i < allRaceIds.length; i += BATCH_SIZE) {
    const batch = allRaceIds.slice(i, i + BATCH_SIZE);
    console.log(`Lote ${Math.floor(i/BATCH_SIZE) + 1}: Consultando ${batch.length} race_ids (${i} a ${i + batch.length - 1})`);
    
    const { data: batchData, error } = await supabase
      .from('race_results')
      .select('race_id, official_order')
      .in('race_id', batch);
    
    if (error) {
      console.error(`  ❌ Error en lote ${Math.floor(i/BATCH_SIZE) + 1}:`, error);
    } else {
      console.log(`  ✓ Obtenidos ${batchData.length} resultados`);
      resultsBatches.push(...batchData);
    }
  }

  console.log(`\nTotal resultados obtenidos: ${resultsBatches.length}`);

  // 3. Verificar cuáles carreras tienen resultados
  const resultRaceIds = new Set(resultsBatches.map(r => r.race_id));
  const racesWithResults = allRaces.filter(r => 
    r.status === 'result_published' || resultRaceIds.has(r.id)
  );

  console.log(`\nCarreras con resultados o status published: ${racesWithResults.length}`);
  
  // 4. Ver las últimas 20 carreras
  console.log('\n=== ÚLTIMAS 20 CARRERAS ===');
  racesWithResults.slice(0, 20).forEach(race => {
    const hasResult = resultRaceIds.has(race.id);
    console.log(`#${race.seq}: ${hasResult ? '✓ tiene resultado' : '✗ sin resultado'} | status: ${race.status}`);
  });

  // 5. Probar un solo lote grande (para comparar)
  console.log('\n=== TESTING SINGLE LARGE QUERY ===');
  try {
    const { data: singleQueryData, error: singleError } = await supabase
      .from('race_results')
      .select('race_id')
      .in('race_id', allRaceIds);
    
    if (singleError) {
      console.error('❌ Query única falló:', singleError.message);
    } else {
      console.log(`✓ Query única exitosa: ${singleQueryData.length} resultados`);
    }
  } catch (err) {
    console.error('❌ Query única lanzó excepción:', err.message);
  }
}

testBatchedQueries().catch(console.error);
