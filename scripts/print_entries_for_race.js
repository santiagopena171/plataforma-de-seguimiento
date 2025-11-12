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
  const envPath = path.join(repoRoot, '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('.env.local not found');
    process.exit(1);
  }
  const env = parseEnv(envPath);
  const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });

  const raceId = process.argv[2];
  if (!raceId) {
    console.error('Usage: node scripts/print_entries_for_race.js <raceId>');
    process.exit(1);
  }

  console.log('Connected to Supabase at', SUPABASE_URL);
  const { data: entries, error } = await supabase.from('race_entries').select('*').eq('race_id', raceId).order('program_number', { ascending: true }).limit(100);
  if (error) {
    console.error('Error fetching entries', error);
    process.exit(1);
  }
  console.log('Entries count:', entries.length);
  entries.forEach(e => {
    console.log('id:', e.id, 'program_number:', e.program_number, 'label:', e.label || e.horse_name || '');
  });
  process.exit(0);
})();
