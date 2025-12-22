const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function parseEnv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const env = {};
  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

(async function(){
  const repoRoot = path.resolve(__dirname, '..');
  const dotEnvPath = path.join(repoRoot, '.env');
  const env = parseEnv(dotEnvPath);
  
  const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY;
  
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { 
    auth: { persistSession: false, autoRefreshToken: false } 
  });

  // Buscar penca
  const { data: penca } = await supabase
    .from('pencas')
    .select('id, name')
    .ilike('slug', '%mensual-maronas%')
    .single();

  console.log(`Penca: ${penca.name}\n`);

  // Buscar las últimas 20 carreras
  const { data: races } = await supabase
    .from('races')
    .select('id, name, seq, race_date, status')
    .eq('penca_id', penca.id)
    .order('seq', { ascending: false })
    .limit(20);

  console.log(`Últimas 20 carreras:\n`);
  
  console.log(`Total encontradas: ${races?.length || 0}`);
  
  if (!races || races.length === 0) {
    console.log('\n⚠️  No se encontraron carreras. Verificando todas las carreras...\n');
    
    const { data: allRaces, count } = await supabase
      .from('races')
      .select('*', { count: 'exact' })
      .eq('penca_id', penca.id);
    
    console.log(`Total de carreras en la penca: ${count || 0}`);
    
    if (allRaces && allRaces.length > 0) {
      console.log(`\nPrimeras 10 carreras:`);
      allRaces.slice(0, 10).forEach(r => {
        console.log(`  [${r.seq}] ${r.name} - ${r.race_date} - ${r.status}`);
      });
      
      console.log(`\nÚltimas 10 carreras:`);
      allRaces.slice(-10).forEach(r => {
        console.log(`  [${r.seq}] ${r.name} - ${r.race_date} - ${r.status}`);
      });
    }
    
    process.exit(0);
  }
  
  if (races) {
    races.forEach(r => {
      const date = new Date(r.race_date);
      const dayOfWeek = date.toLocaleDateString('es-ES', { weekday: 'long' });
      console.log(`[${r.seq}] ${r.name} - ${r.race_date} (${dayOfWeek}) - ${r.status}`);
    });
  }

  process.exit(0);
})();
