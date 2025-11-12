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

function arrayNeedsMapping(arr, entriesById, entriesByNumber) {
  if (!Array.isArray(arr)) return false;
  for (const a of arr) {
    if (!a) continue;
    if (!entriesById.has(String(a)) && entriesByNumber.has(String(a))) return true;
  }
  return false;
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
  console.log('Connected to Supabase at', SUPABASE_URL);

  // Gather races with predictions
  const { data: raceRows } = await supabase.from('predictions').select('race_id').limit(10000);
  const raceIds = Array.from(new Set((raceRows || []).map(r => r.race_id))).filter(Boolean);
  if (raceIds.length === 0) {
    console.log('No predictions found. Exiting.');
    process.exit(0);
  }

  console.log('Scanning', raceIds.length, 'races for legacy predictions...');

  const toUpdate = [];
  const affectedRaces = new Set();

  for (const raceId of raceIds) {
    const { data: entries } = await supabase.from('race_entries').select('id, program_number').eq('race_id', raceId);
    const entriesById = new Set((entries || []).map(e => String(e.id)));
    const entriesByNumber = new Map((entries || []).map(e => [String(e.program_number), e.id]));
    if (!entries || entries.length === 0) continue;

    const { data: preds } = await supabase.from('predictions').select('*').eq('race_id', raceId).limit(10000);
    for (const p of preds || []) {
      let changed = false;
      const newP = { id: p.id };

      if (p.winner_pick && !entriesById.has(String(p.winner_pick)) && entriesByNumber.has(String(p.winner_pick))) {
        newP.winner_pick = entriesByNumber.get(String(p.winner_pick));
        changed = true;
      }

      if (arrayNeedsMapping(p.exacta_pick, entriesById, entriesByNumber)) {
        const mapped = (p.exacta_pick || []).map(el => {
          if (!el) return null;
          if (entriesById.has(String(el))) return String(el);
          if (entriesByNumber.has(String(el))) return String(entriesByNumber.get(String(el)));
          return el;
        });
        newP.exacta_pick = mapped;
        changed = true;
      }

      if (arrayNeedsMapping(p.trifecta_pick, entriesById, entriesByNumber)) {
        const mapped = (p.trifecta_pick || []).map(el => {
          if (!el) return null;
          if (entriesById.has(String(el))) return String(el);
          if (entriesByNumber.has(String(el))) return String(entriesByNumber.get(String(el)));
          return el;
        });
        newP.trifecta_pick = mapped;
        changed = true;
      }

      if (changed) {
        toUpdate.push({ race_id: raceId, pred_id: p.id, before: p, after: newP });
        affectedRaces.add(raceId);
      }
    }
  }

  console.log('\nSummary:');
  console.log('Predictions to update:', toUpdate.length);
  console.log('Affected races:', Array.from(affectedRaces));

  const backupDir = path.join(repoRoot, 'scripts', 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `predictions_fix_backup_${ts}.json`);

  // Write backup (before states)
  fs.writeFileSync(backupPath, JSON.stringify({ created_at: new Date().toISOString(), count: toUpdate.length, items: toUpdate.map(u => ({ race_id: u.race_id, pred_id: u.pred_id, before: u.before })) }, null, 2));
  console.log('Backup written to', backupPath);

  if (toUpdate.length === 0) {
    console.log('Nothing to apply. Exiting.');
    process.exit(0);
  }

  const doApply = process.argv.includes('--apply') || process.env.APPLY === '1';
  if (!doApply) {
    console.log('\nDry-run complete. To apply changes run:');
    console.log('  node scripts/backup_and_apply_fix_predictions.js --apply');
    process.exit(0);
  }

  console.log('\nApplying updates...');
  for (const u of toUpdate) {
    const updateData = {};
    if (u.after.winner_pick) updateData.winner_pick = u.after.winner_pick;
    if (u.after.exacta_pick) updateData.exacta_pick = u.after.exacta_pick;
    if (u.after.trifecta_pick) updateData.trifecta_pick = u.after.trifecta_pick;
    try {
      const { error } = await supabase.from('predictions').update(updateData).eq('id', u.pred_id);
      if (error) {
        console.error('Error updating prediction', u.pred_id, error);
      } else {
        console.log('Updated prediction', u.pred_id);
      }
    } catch (e) {
      console.error('Exception updating prediction', u.pred_id, e);
    }
  }

  // Recalculate scores for affected races (reuse recalc logic)
  console.log('\nRecalculating scores for affected races...');
  for (const raceId of Array.from(affectedRaces)) {
    const { data: race } = await supabase.from('races').select('id, penca_id').eq('id', raceId).maybeSingle();
    if (!race) continue;
    const { data: ruleset } = await supabase.from('rulesets').select('*').eq('penca_id', race.penca_id).eq('is_active', true).maybeSingle();
    if (!ruleset) {
      console.log('No active ruleset for penca', race.penca_id, 'skipping recalc');
      continue;
    }
    const { data: rr } = await supabase.from('race_results').select('official_order').eq('race_id', raceId).maybeSingle();
    if (!rr || !rr.official_order) {
      console.log('No race_results for race', raceId, 'skipping recalc');
      continue;
    }
    const officialOrder = rr.official_order;
    const { data: predictions } = await supabase.from('predictions').select('*').eq('race_id', raceId).limit(10000);

    const pointsTop3 = ruleset.points_top3 || {};
    const modalities = ruleset.modalities_enabled || [];

    for (const prediction of predictions || []) {
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
          breakdown.exacta = (pointsTop3.first || 0) + (pointsTop3.second || 0);
          totalPoints += (pointsTop3.first || 0) + (pointsTop3.second || 0);
        } else {
          breakdown.exacta = 0;
        }
      }

      if (modalities.includes('trifecta') && prediction.trifecta_pick) {
        const trifectaPick = prediction.trifecta_pick;
        if (Array.isArray(trifectaPick) && trifectaPick.length === 3 && trifectaPick[0] === officialOrder[0] && trifectaPick[1] === officialOrder[1] && trifectaPick[2] === officialOrder[2]) {
          breakdown.trifecta = (pointsTop3.first || 0) + (pointsTop3.second || 0) + (pointsTop3.third || 0);
          totalPoints += (pointsTop3.first || 0) + (pointsTop3.second || 0) + (pointsTop3.third || 0);
        } else {
          breakdown.trifecta = 0;
        }
      }

      if (modalities.includes('place') || modalities.includes('top3')) {
        breakdown.place = [];
        const picks = [
          prediction.winner_pick,
          ...(prediction.exacta_pick || []),
          ...(prediction.trifecta_pick || []),
        ].filter((p, i, arr) => p && arr.indexOf(p) === i);

        for (const pick of picks) {
          if (pick === officialOrder[0]) {
            breakdown.place.push(pointsTop3.first || 0);
            totalPoints += pointsTop3.first || 0;
          } else if (pick === officialOrder[1]) {
            breakdown.place.push(pointsTop3.second || 0);
            totalPoints += pointsTop3.second || 0;
          } else if (pick === officialOrder[2]) {
            breakdown.place.push(pointsTop3.third || 0);
            totalPoints += pointsTop3.third || 0;
          } else if (officialOrder[3] && pick === officialOrder[3]) {
            breakdown.place.push(pointsTop3.fourth || 0);
            totalPoints += pointsTop3.fourth || 0;
          } else {
            breakdown.place.push(0);
          }
        }
      }

      const scoreRow = {
        penca_id: race.penca_id,
        race_id: raceId,
        user_id: prediction.user_id,
        membership_id: prediction.membership_id || null,
        points_total: totalPoints,
        breakdown,
      };

      if (prediction.membership_id) {
        const { data: updated, error: updateError } = await supabase.from('scores').update(scoreRow).eq('race_id', raceId).eq('membership_id', prediction.membership_id).select();
        if (updateError) {
          console.error('Error updating score for prediction', prediction.id, updateError);
          await supabase.from('scores').insert(scoreRow);
        } else if (!updated || updated.length === 0) {
          await supabase.from('scores').insert(scoreRow);
        }
      } else {
        const { data: updated, error: updateError } = await supabase.from('scores').update(scoreRow).eq('race_id', raceId).eq('user_id', prediction.user_id).select();
        if (updateError) {
          console.error('Error updating score for prediction', prediction.id, updateError);
          await supabase.from('scores').insert(scoreRow);
        } else if (!updated || updated.length === 0) {
          await supabase.from('scores').insert(scoreRow);
        }
      }
    }

    console.log('Recalculated scores for race', raceId);
  }

  console.log('Done.');
  console.log('Backup file:', backupPath);
  process.exit(0);
})();
