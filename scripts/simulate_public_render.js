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
    console.error('Usage: node scripts/simulate_public_render.js <raceId>');
    process.exit(1);
  }

  const { data: raceResult } = await supabase.from('race_results').select('*').eq('race_id', raceId).maybeSingle();
  const { data: entries } = await supabase.from('race_entries').select('*').eq('race_id', raceId);
  const { data: predictions } = await supabase.from('predictions').select('*').eq('race_id', raceId);
  const { data: scores } = await supabase.from('scores').select('*, memberships!scores_membership_id_fkey(id, guest_name)').eq('race_id', raceId).order('points_total', { ascending: false });

  const entriesMap = {};
  const entriesByNumber = {};
  entries.forEach(e => {
    // mimic page behavior: add compatibility alias `number` for program_number
    e.number = e.program_number;
    entriesMap[e.id] = e;
    entriesByNumber[String(e.program_number)] = e;
  });

  console.log('Simulated public render for race', raceId);
  scores.forEach((s, index) => {
    const membershipName = s.memberships?.guest_name || 'Unknown';
    const prediction = predictions.find(p => p.membership_id === s.membership_id);
    const emap = prediction ? entriesMap[prediction.winner_pick] : null;
    const ebyNum = prediction ? entriesByNumber[String(prediction.winner_pick)] : null;
    const displayWinner = prediction ? ((emap?.number || ebyNum?.program_number) || '?') : 'Sin predicción';
    console.log(`${index+1}. ${membershipName} -> prediction display: #${displayWinner}, points: ${s.points_total}`);
    if (prediction) {
      console.log('   debug -> prediction.winner_pick:', prediction.winner_pick);
      console.log('   debug -> entriesMap lookup:', emap);
      console.log('   debug -> entriesByNumber lookup:', ebyNum);
    }
  });

  process.exit(0);
})();
