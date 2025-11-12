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
    console.error('Usage: node scripts/recalc_race.js <raceId>  OR set env RACE_ID');
    process.exit(1);
  }

  console.log('Recalculating scores for race', raceId);

  const { data: race } = await supabase.from('races').select('id, penca_id').eq('id', raceId).maybeSingle();
  if (!race) {
    console.error('Race not found', raceId);
    process.exit(1);
  }

  const { data: ruleset } = await supabase.from('rulesets').select('*').eq('penca_id', race.penca_id).eq('is_active', true).maybeSingle();
  if (!ruleset) {
    console.error('No active ruleset for penca', race.penca_id);
    process.exit(1);
  }

  const { data: rr } = await supabase.from('race_results').select('official_order').eq('race_id', raceId).maybeSingle();
  if (!rr || !rr.official_order) {
    console.error('No race_results/official_order for race', raceId);
    process.exit(1);
  }

  const officialOrder = rr.official_order;
  console.log('official order:', officialOrder);

  const { data: predictions } = await supabase.from('predictions').select('*').eq('race_id', raceId).limit(1000);
  console.log('predictions count:', (predictions||[]).length);

  const pointsTop3 = ruleset.points_top3 || {};
  const modalities = ruleset.modalities_enabled || [];

  for (const prediction of (predictions||[])) {
    let totalPoints = 0;
    const breakdown = {};

    if (modalities.includes('winner') && prediction.winner_pick) {
      if (prediction.winner_pick === officialOrder[0]) {
        breakdown.winner = pointsTop3.first || 0;
        totalPoints += pointsTop3.first || 0;
      } else {
        breakdown.winner = 0;
      }
    }

    if (modalities.includes('exacta') && prediction.exacta_pick) {
      const exactaPick = prediction.exacta_pick;
      if (Array.isArray(exactaPick) && exactaPick.length === 2 && exactaPick[0] === officialOrder[0] && exactaPick[1] === officialOrder[1]) {
        breakdown.exacta = (pointsTop3.first||0) + (pointsTop3.second||0);
        totalPoints += (pointsTop3.first||0) + (pointsTop3.second||0);
      } else {
        breakdown.exacta = 0;
      }
    }

    if (modalities.includes('trifecta') && prediction.trifecta_pick) {
      const trifectaPick = prediction.trifecta_pick;
      if (Array.isArray(trifectaPick) && trifectaPick.length === 3 && trifectaPick[0] === officialOrder[0] && trifectaPick[1] === officialOrder[1] && trifectaPick[2] === officialOrder[2]) {
        breakdown.trifecta = (pointsTop3.first||0) + (pointsTop3.second||0) + (pointsTop3.third||0);
        totalPoints += (pointsTop3.first||0) + (pointsTop3.second||0) + (pointsTop3.third||0);
      } else {
        breakdown.trifecta = 0;
      }
    }

    if (modalities.includes('place') || modalities.includes('top3')) {
      breakdown.place = [];
      const picks = [prediction.winner_pick, ...(prediction.exacta_pick||[]), ...(prediction.trifecta_pick||[])].filter((p,i,arr)=>p && arr.indexOf(p)===i);
      for (const pick of picks) {
        if (pick === officialOrder[0]) {
          breakdown.place.push(pointsTop3.first||0);
          totalPoints += pointsTop3.first||0;
        } else if (pick === officialOrder[1]) {
          breakdown.place.push(pointsTop3.second||0);
          totalPoints += pointsTop3.second||0;
        } else if (pick === officialOrder[2]) {
          breakdown.place.push(pointsTop3.third||0);
          totalPoints += pointsTop3.third||0;
        } else if (officialOrder[3] && pick === officialOrder[3]) {
          breakdown.place.push(pointsTop3.fourth||0);
          totalPoints += pointsTop3.fourth||0;
        } else {
          breakdown.place.push(0);
        }
      }
    }

    // Persist score: try update by membership_id (preferred) or user_id; insert if none updated.
    const scoreRow = { penca_id: race.penca_id, race_id: raceId, user_id: prediction.user_id, membership_id: prediction.membership_id||null, points_total: totalPoints, breakdown };
    if (prediction.membership_id) {
      const { data: updated, error: updateError } = await supabase.from('scores').update(scoreRow).eq('race_id', raceId).eq('membership_id', prediction.membership_id).select();
      if (updateError) {
        console.error('Error updating score for prediction', prediction.id, updateError);
        await supabase.from('scores').insert(scoreRow);
      } else if (!updated || updated.length === 0) {
        await supabase.from('scores').insert(scoreRow);
      } else {
        console.log('updated score for prediction', prediction.id, 'points_total=', totalPoints);
      }
    } else {
      const { data: updated, error: updateError } = await supabase.from('scores').update(scoreRow).eq('race_id', raceId).eq('user_id', prediction.user_id).select();
      if (updateError) {
        console.error('Error updating score for prediction', prediction.id, updateError);
        await supabase.from('scores').insert(scoreRow);
      } else if (!updated || updated.length === 0) {
        await supabase.from('scores').insert(scoreRow);
      } else {
        console.log('updated score for prediction', prediction.id, 'points_total=', totalPoints);
      }
    }
  }

  // Fetch and print scores
  const { data: scores } = await supabase.from('scores').select('*').eq('race_id', raceId).order('points_total', { ascending: false });
  console.log('Final scores:');
  console.log(scores.map(s=>({ id: s.id, membership_id: s.membership_id, user_id: s.user_id, points_total: s.points_total, breakdown: s.breakdown })));

  process.exit(0);
})();
