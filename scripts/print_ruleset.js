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
    console.error('.env.local not found at', envPath);
    process.exit(1);
  }
  const env = parseEnv(envPath);
  const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error('Missing SUPABASE_URL or SERVICE_ROLE in .env.local');
    process.exit(1);
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });

  const raceId = process.argv[2];
  if (!raceId) {
    console.error('Usage: node scripts/print_ruleset.js <raceId>');
    process.exit(1);
  }

  const { data: race, error: raceError } = await supabase.from('races').select('id, penca_id').eq('id', raceId).maybeSingle();
  if (raceError) {
    console.error('Error fetching race:', raceError);
    process.exit(1);
  }
  console.log('race:', race);

  const { data: ruleset } = await supabase.from('rulesets').select('*').eq('penca_id', race.penca_id).eq('is_active', true).maybeSingle();
  console.log('ruleset:', ruleset);

  process.exit(0);
})();
