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

async function debugRaceVisibility() {
  console.log('=== DEBUGGING RACE VISIBILITY ===\n');

  // 1. Obtener todas las carreras
  const { data: allRaces, error: racesError } = await supabase
    .from('races')
    .select('id, seq, status, penca_id')
    .order('seq', { ascending: false });

  if (racesError) {
    console.error('Error obteniendo carreras:', racesError);
    return;
  }

  console.log(`Total de carreras en la BD: ${allRaces.length}`);
  if (allRaces.length > 0) {
    console.log(`Última carrera: #${allRaces[0].seq}`);
    console.log(`Primera carrera: #${allRaces[allRaces.length - 1].seq}`);
  }

  // 2. Obtener resultados de carreras
  const { data: results, error: resultsError } = await supabase
    .from('race_results')
    .select('race_id, official_order');

  if (resultsError) {
    console.error('Error obteniendo resultados:', resultsError);
  } else {
    console.log(`\nResultados registrados: ${results.length}`);
    const validResults = results.filter(r => r.official_order && r.official_order.length > 0);
    console.log(`Resultados con official_order: ${validResults.length}`);
  }

  // 3. Ver distribución por estado
  const statusCount = {};
  allRaces.forEach(race => {
    statusCount[race.status] = (statusCount[race.status] || 0) + 1;
  });

  console.log('\nDistribución por estado:');
  Object.entries(statusCount).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

  // 4. Ver últimas 15 carreras con detalles
  console.log('\n=== ÚLTIMAS 15 CARRERAS ===');
  const last15 = allRaces.slice(0, 15);
  const resultIds = new Set(results?.map(r => r.race_id) || []);
  
  for (const race of last15) {
    const hasResult = resultIds.has(race.id);
    console.log(`Carrera #${race.seq}: status="${race.status}" | Resultado: ${hasResult ? '✓' : '✗'}`);
  }

  // 5. Buscar carreras desde la 130 en adelante
  console.log('\n=== CARRERAS 130-139 ===');
  const races130Plus = allRaces.filter(r => r.seq >= 130 && r.seq <= 139);
  
  for (const race of races130Plus.sort((a, b) => a.seq - b.seq)) {
    const hasResult = resultIds.has(race.id);
    console.log(`Carrera #${race.seq}: status="${race.status}" | Resultado: ${hasResult ? '✓' : '✗'}`);
  }
}

debugRaceVisibility().catch(console.error);
