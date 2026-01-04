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

async function debugRaceLimit() {
  console.log('=== DEBUGGING RACE LIMIT ISSUE ===\n');

  // 1. Obtener penca
  const { data: penca } = await supabase
    .from('pencas')
    .select('id, name')
    .eq('slug', 'mensual-maronas')
    .single();

  // 2. Obtener races sin order
  const { data: racesDesc } = await supabase
    .from('races')
    .select('id, seq, status')
    .eq('penca_id', penca.id)
    .order('seq', { ascending: false });

  console.log(`Total races found: ${racesDesc.length}`);
  console.log(`First race (desc order): #${racesDesc[0].seq}`);
  console.log(`Last race (desc order): #${racesDesc[racesDesc.length - 1].seq}`);

  // 3. Verificar si hay un límite implícito en la query
  console.log('\n=== Testing if there\'s a query limit ===');
  
  const { data: racesWithLimit, count } = await supabase
    .from('races')
    .select('id, seq, status', { count: 'exact' })
    .eq('penca_id', penca.id)
    .order('seq', { ascending: false });

  console.log(`Returned: ${racesWithLimit.length} races`);
  console.log(`Count: ${count} total`);

  if (racesWithLimit.length !== count) {
    console.log('⚠️  QUERY ESTÁ LIMITADA! Solo devolvió una porción');
  }

  // 4. Probar con limit explícito
  console.log('\n=== Testing with explicit limit(500) ===');
  const { data: racesUnlimited } = await supabase
    .from('races')
    .select('id, seq, status')
    .eq('penca_id', penca.id)
    .order('seq', { ascending: false })
    .limit(500);

  console.log(`With limit(500): ${racesUnlimited.length} races`);
  console.log(`First: #${racesUnlimited[0].seq}, Last: #${racesUnlimited[racesUnlimited.length - 1].seq}`);

  // 5. Verificar cuántos result_published hay
  const publishedRaces = racesUnlimited.filter(r => r.status === 'result_published');
  console.log(`\nPublished races: ${publishedRaces.length}`);
  console.log(`Highest published: #${publishedRaces[0].seq}`);
  console.log(`Lowest published: #${publishedRaces[publishedRaces.length - 1].seq}`);
}

debugRaceLimit().catch(console.error);
