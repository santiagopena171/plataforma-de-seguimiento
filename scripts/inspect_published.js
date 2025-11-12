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
    // remove surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

async function main() {
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

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log('Connected to Supabase at', SUPABASE_URL);

  // List up to 10 published races
  const { data: races, error: racesError } = await supabase
    .from('races')
    .select('id, venue, start_at, seq, penca_id, status')
    .eq('status', 'result_published')
    .order('start_at', { ascending: false })
    .limit(10);

  if (racesError) {
    console.error('Error fetching races:', racesError);
    process.exit(1);
  }

  if (!races || races.length === 0) {
    console.log('No published races found.');
    process.exit(0);
  }

  console.log('Found published races (up to 10):');
  races.forEach((r, i) => {
    console.log(`${i + 1}) id=${r.id} seq=${r.seq} venue=${r.venue} start_at=${r.start_at} penca_id=${r.penca_id}`);
  });

  // For each published race, fetch counts of predictions and scores to find races with activity
  console.log('\nChecking predictions/scores counts for each published race...');
  for (const r of races) {
    try {
      const [predRes, scoreRes] = await Promise.all([
        supabase.from('predictions').select('id', { count: 'exact' }).eq('race_id', r.id),
        supabase.from('scores').select('id', { count: 'exact' }).eq('race_id', r.id),
      ]);
      const preds = typeof predRes.count === 'number' ? predRes.count : (predRes.data || []).length;
      const scs = typeof scoreRes.count === 'number' ? scoreRes.count : (scoreRes.data || []).length;
      console.log(`race ${r.id} -> predictions: ${preds}, scores: ${scs}`);
      // If this race has predictions, dump a bit more detail
      if (preds > 0) {
        // Fetch active ruleset for this penca
        const { data: ruleset } = await supabase.from('rulesets').select('*').eq('penca_id', r.penca_id).eq('is_active', true).maybeSingle();
        console.log('active ruleset for penca', r.penca_id, ':', ruleset ? { points_top3: ruleset.points_top3, modalities_enabled: ruleset.modalities_enabled } : null);
        const [{ data: rResult }] = await Promise.all([
          supabase.from('race_results').select('*').eq('race_id', r.id).maybeSingle(),
        ]);
        const { data: rEntries } = await supabase.from('race_entries').select('*').eq('race_id', r.id).order('program_number', { ascending: true });
        const { data: rPreds } = await supabase.from('predictions').select('*').eq('race_id', r.id).limit(200);
        const { data: rScores } = await supabase.from('scores').select('*').eq('race_id', r.id).limit(200);

        console.log('\n>>> DETAILS for race', r.id);
        console.log('race_results:', rResult);
        console.log('entries:', (rEntries || []).map(e => ({ id: e.id, program_number: e.program_number })));
        console.log('predictions:', (rPreds || []).map(p => ({ id: p.id, membership_id: p.membership_id, user_id: p.user_id, winner_pick: p.winner_pick, exacta_pick: p.exacta_pick, trifecta_pick: p.trifecta_pick })));
        console.log('scores:', (rScores || []).map(s => ({ id: s.id, membership_id: s.membership_id, user_id: s.user_id, points_total: s.points_total, breakdown: s.breakdown })));
        // Also show legacy winner picks mapping
        const entriesById = new Set((rEntries || []).map(e => String(e.id)));
        const entriesByNumber = new Map((rEntries || []).map(e => [String(e.program_number), e.id]));
        const legacyWinnerPreds = (rPreds || []).filter(p => p.winner_pick && !entriesById.has(String(p.winner_pick)) && entriesByNumber.has(String(p.winner_pick)));
        console.log('legacy winner_pick preds (program_number stored):', legacyWinnerPreds.map(p => ({ id: p.id, winner_pick: p.winner_pick, mapped_entry_id: entriesByNumber.get(String(p.winner_pick)) })));
        console.log('\n');
      }
    } catch (e) {
      console.error('Error fetching counts for race', r.id, e.message || e);
    }
  }

  const race = races[0];
  console.log('\nInspecting latest race id=', race.id);

  const [{ data: raceResult, error: rrErr }, { data: entries, error: enErr }, { data: predictions, error: predErr }, { data: scores, error: scErr }] = await Promise.all([
    supabase.from('race_results').select('*').eq('race_id', race.id).maybeSingle(),
    supabase.from('race_entries').select('*').eq('race_id', race.id).order('program_number', { ascending: true }),
    supabase.from('predictions').select('*').eq('race_id', race.id).limit(500),
    supabase.from('scores').select('*').eq('race_id', race.id).limit(500),
  ]);

  if (rrErr) console.error('race_results error:', rrErr);
  if (enErr) console.error('entries error:', enErr);
  if (predErr) console.error('predictions error:', predErr);
  if (scErr) console.error('scores error:', scErr);

  console.log('\n--- race_results ---');
  console.log(JSON.stringify(raceResult, null, 2));

  console.log('\n--- entries (first 50) ---');
  console.log(entries ? entries.slice(0, 50).map(e => ({ id: e.id, program_number: e.program_number, horse_name: e.horse_name })) : 'none');

  console.log('\n--- predictions (first 100) ---');
  console.log(predictions ? predictions.slice(0, 100).map(p => ({ id: p.id, membership_id: p.membership_id, user_id: p.user_id, winner_pick: p.winner_pick, exacta_pick: p.exacta_pick, trifecta_pick: p.trifecta_pick })) : 'none');

  console.log('\n--- scores (first 100) ---');
  console.log(scores ? scores.slice(0, 100).map(s => ({ id: s.id, membership_id: s.membership_id, user_id: s.user_id, points_total: s.points_total, breakdown: s.breakdown })) : 'none');

  // Check for predictions where winner_pick does not match any entry id but matches a program_number
  const entriesById = new Set(entries.map(e => String(e.id)));
  const entriesByNumber = new Map(entries.map(e => [String(e.program_number), e.id]));

  const legacyWinnerPreds = (predictions || []).filter(p => p.winner_pick && !entriesById.has(String(p.winner_pick)) && entriesByNumber.has(String(p.winner_pick)));

  console.log('\n--- legacy winner_pick predictions (program_number stored) ---');
  console.log(legacyWinnerPreds.map(p => ({ id: p.id, winner_pick: p.winner_pick, mapped_entry_id: entriesByNumber.get(String(p.winner_pick)) })));

  // Check scores that have unexpected points (e.g., multiple winners getting same winner points) - this is heuristic
  console.log('\n--- scores summary ---');
  const summary = (scores || []).map(s => ({ id: s.id, user_id: s.user_id, membership_id: s.membership_id, points_total: s.points_total }));
  console.log(summary);

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
