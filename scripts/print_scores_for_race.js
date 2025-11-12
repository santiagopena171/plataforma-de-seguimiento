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
    console.error('Usage: node scripts/print_scores_for_race.js <raceId>');
    process.exit(1);
  }

  console.log('Connected to Supabase at', SUPABASE_URL);
  const { data: scores, error } = await supabase.from('scores').select('*, memberships!scores_membership_id_fkey(id, guest_name)').eq('race_id', raceId).order('points_total', { ascending: false }).limit(100);
  if (error) {
    console.error('Error fetching scores', error);
    process.exit(1);
  }
  console.log('Scores count:', scores.length);
  scores.forEach(s => {
    console.log('id:', s.id, 'membership_id:', s.membership_id, 'membership_guest:', s.memberships?.guest_name, 'user_id:', s.user_id, 'points_total:', s.points_total, 'breakdown:', JSON.stringify(s.breakdown));
  });
  process.exit(0);
})();
