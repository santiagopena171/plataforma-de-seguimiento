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
  if (!fs.existsSync(envPath)) { console.error('.env.local missing'); process.exit(1); }
  const env = parseEnv(envPath);
  const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
  const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !ANON) { console.error('Missing anon key'); process.exit(1); }

  const client = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
  const raceId = process.argv[2];
  if (!raceId) { console.error('Usage: node test_rls_as_anon.js <raceId>'); process.exit(1); }

  console.log('Testing RLS as anon for race', raceId);
  const q1 = await client.from('predictions').select('*').eq('race_id', raceId).limit(100);
  console.log('predictions error:', q1.error); console.log('predictions count:', q1.data?.length);
  const q2 = await client.from('scores').select('*').eq('race_id', raceId).limit(100);
  console.log('scores error:', q2.error); console.log('scores count:', q2.data?.length);
  const q3 = await client.from('race_results').select('*').eq('race_id', raceId).maybeSingle();
  console.log('race_results error:', q3.error); console.log('race_results:', q3.data ? 'present' : 'null');

  process.exit(0);
})();
