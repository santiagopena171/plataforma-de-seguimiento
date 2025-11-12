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

(async function main(){
  const repoRoot = path.resolve(__dirname, '..');
  const envPath = path.join(repoRoot, '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('.env.local not found at', envPath);
    process.exit(1);
  }
  const env = parseEnv(envPath);
  const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });

  const raceId = process.env.RACE_ID || process.argv[2];
  if (!raceId) {
    console.error('Usage: node scripts/dedupe_scores.js <raceId>');
    process.exit(1);
  }

  console.log('Deduplicating scores for race', raceId);

  const { data: scores } = await supabase.from('scores').select('*').eq('race_id', raceId).order('membership_id', { ascending: true }).order('created_at', { ascending: true });
  if (!scores || scores.length === 0) {
    console.log('No scores for race');
    process.exit(0);
  }

  // group by membership_id (or user_id if membership_id null)
  const groups = {};
  for (const s of scores) {
    const key = s.membership_id ? `m:${s.membership_id}` : `u:${s.user_id}`;
    groups[key] = groups[key] || [];
    groups[key].push(s);
  }

  let deleted = 0;
  for (const key of Object.keys(groups)) {
    const arr = groups[key];
    if (arr.length <= 1) continue;
    // keep the last (by updated_at or created_at)
    arr.sort((a,b) => new Date(a.updated_at || a.created_at) - new Date(b.updated_at || b.created_at));
    const toKeep = arr[arr.length-1];
    const toDelete = arr.slice(0, arr.length-1);
    for (const d of toDelete) {
      const { error } = await supabase.from('scores').delete().eq('id', d.id);
      if (error) console.error('Error deleting score', d.id, error);
      else deleted++;
    }
  }

  console.log('Deleted duplicate scores:', deleted);
  process.exit(0);
})();