/**
 * recalc_sabado28.js
 * Recalcula los puntos de todas las carreras publicadas de la penca maronas-sabado-28
 * Normaliza correctamente las modalidades en español ('lugar' -> 'place', 'ganador' -> 'winner')
 */
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const raw = fs.readFileSync('.env.local', 'utf8');
const env = {};
raw.split(/\r?\n/).forEach(l => {
  const eq = l.indexOf('=');
  if (eq > 0) {
    env[l.slice(0, eq).trim()] = l.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
  }
});

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

function normalizeModalities(raw) {
  return (raw || []).map(m => {
    if (!m) return m;
    const mm = m.toString().toLowerCase();
    if (mm === 'lugar' || mm === 'place') return 'place';
    if (mm === 'ganador' || mm === 'winner') return 'winner';
    if (mm === 'top3' || mm === 'top_3' || mm === 'top-three') return 'top3';
    if (mm === 'exacta') return 'exacta';
    if (mm === 'trifecta') return 'trifecta';
    return mm;
  });
}

async function recalcRace(pencaId, raceId, raceSeq, ruleset) {
  const modalities = normalizeModalities(ruleset.modalities_enabled);
  const pointsTop3 = ruleset.points_top3;

  // Get result
  const { data: result } = await sb.from('race_results')
    .select('official_order, first_place_tie')
    .eq('race_id', raceId)
    .single();

  if (!result) {
    console.log(`  ⚠️  Sin resultado para carrera #${raceSeq}`);
    return;
  }

  const { official_order: officialOrder, first_place_tie: firstPlaceTie } = result;

  // Get predictions
  const { data: predictions } = await sb.from('predictions')
    .select('*')
    .eq('race_id', raceId);

  if (!predictions || predictions.length === 0) {
    console.log(`  ⚠️  Sin predicciones para carrera #${raceSeq}`);
    return;
  }

  // Count winner pickers for exclusive logic
  let exactWinnerGuesserCount = 0;
  for (const p of predictions) {
    const picks = [
      p.winner_pick,
      ...(p.exacta_pick || []),
      ...(p.trifecta_pick || []),
    ].filter((v, i, arr) => v && arr.indexOf(v) === i);

    const guessed = firstPlaceTie
      ? (picks.includes(officialOrder[0]) || picks.includes(officialOrder[1]))
      : picks.includes(officialOrder[0]);
    if (guessed) exactWinnerGuesserCount++;
  }

  const isExclusive = exactWinnerGuesserCount === 1;
  let firstPlacePoints = pointsTop3.first;
  if (isExclusive && ruleset.exclusive_winner_points) {
    firstPlacePoints = ruleset.exclusive_winner_points;
    console.log(`  🏆 Ganador exclusivo! Puntos especiales: ${firstPlacePoints}`);
  }

  let saved = 0;
  for (const prediction of predictions) {
    let totalPoints = 0;
    const breakdown = {};

    if (modalities.includes('winner') && prediction.winner_pick) {
      const isWinner = firstPlaceTie
        ? (prediction.winner_pick === officialOrder[0] || prediction.winner_pick === officialOrder[1])
        : (prediction.winner_pick === officialOrder[0]);
      breakdown.winner = isWinner ? firstPlacePoints : 0;
      if (isWinner) totalPoints += firstPlacePoints;
    }

    if (modalities.includes('exacta') && prediction.exacta_pick) {
      if (!firstPlaceTie && prediction.exacta_pick.length === 2 &&
          prediction.exacta_pick[0] === officialOrder[0] &&
          prediction.exacta_pick[1] === officialOrder[1]) {
        breakdown.exacta = firstPlacePoints + pointsTop3.second;
        totalPoints += firstPlacePoints + pointsTop3.second;
      } else {
        breakdown.exacta = 0;
      }
    }

    if (modalities.includes('trifecta') && prediction.trifecta_pick) {
      if (!firstPlaceTie && prediction.trifecta_pick.length === 3 &&
          prediction.trifecta_pick[0] === officialOrder[0] &&
          prediction.trifecta_pick[1] === officialOrder[1] &&
          prediction.trifecta_pick[2] === officialOrder[2]) {
        breakdown.trifecta = firstPlacePoints + pointsTop3.second + pointsTop3.third;
        totalPoints += firstPlacePoints + pointsTop3.second + pointsTop3.third;
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
      ].filter((v, i, arr) => v && arr.indexOf(v) === i);

      for (const pick of picks) {
        if (firstPlaceTie) {
          if (pick === officialOrder[0] || pick === officialOrder[1]) {
            breakdown.place.push(firstPlacePoints);
            totalPoints += firstPlacePoints;
          } else if (pick === officialOrder[2]) {
            breakdown.place.push(pointsTop3.third);
            totalPoints += pointsTop3.third;
          } else if (officialOrder[3] && pick === officialOrder[3]) {
            breakdown.place.push(pointsTop3.fourth || 0);
            totalPoints += pointsTop3.fourth || 0;
          } else {
            breakdown.place.push(0);
          }
        } else {
          if (pick === officialOrder[0]) {
            breakdown.place.push(firstPlacePoints);
            totalPoints += firstPlacePoints;
          } else if (pick === officialOrder[1]) {
            breakdown.place.push(pointsTop3.second);
            totalPoints += pointsTop3.second;
          } else if (pick === officialOrder[2]) {
            breakdown.place.push(pointsTop3.third);
            totalPoints += pointsTop3.third;
          } else if (officialOrder[3] && pick === officialOrder[3]) {
            breakdown.place.push(pointsTop3.fourth || 0);
            totalPoints += pointsTop3.fourth || 0;
          } else {
            breakdown.place.push(0);
          }
        }
      }
    }

    const scoreRow = {
      penca_id: pencaId,
      race_id: raceId,
      user_id: prediction.user_id,
      membership_id: prediction.membership_id || null,
      points_total: totalPoints,
      breakdown,
    };

    // Delete old score and insert new one
    if (prediction.membership_id) {
      await sb.from('scores').delete().eq('race_id', raceId).eq('membership_id', prediction.membership_id);
    } else if (prediction.user_id) {
      await sb.from('scores').delete().eq('race_id', raceId).eq('user_id', prediction.user_id);
    }

    const { error } = await sb.from('scores').insert(scoreRow);
    if (error) {
      console.error(`  ❌ Error guardando score para prediction ${prediction.id}:`, error.message);
    } else {
      saved++;
      if (totalPoints > 0) {
        console.log(`  ✅ ${prediction.membership_id || prediction.user_id} → ${totalPoints} pts (${JSON.stringify(breakdown)})`);
      }
    }
  }
  console.log(`  📊 Carrera #${raceSeq}: ${saved} scores guardados`);
}

(async () => {
  const PENCA_SLUG = 'maronas-sabado-28';

  const { data: penca, error: pe } = await sb.from('pencas').select('id').eq('slug', PENCA_SLUG).single();
  if (pe || !penca) { console.error('Penca no encontrada', pe); process.exit(1); }

  const { data: ruleset } = await sb.from('rulesets')
    .select('*')
    .eq('penca_id', penca.id)
    .eq('is_active', true)
    .single();
  if (!ruleset) { console.error('Sin ruleset activo'); process.exit(1); }

  console.log(`Ruleset encontrado:`);
  console.log(`  Modalidades raw: ${JSON.stringify(ruleset.modalities_enabled)}`);
  console.log(`  Modalidades normalizadas: ${JSON.stringify(normalizeModalities(ruleset.modalities_enabled))}`);
  console.log(`  Puntos: ${JSON.stringify(ruleset.points_top3)}`);
  console.log(`  Puntos exclusivo: ${ruleset.exclusive_winner_points}`);

  const { data: races } = await sb.from('races')
    .select('id, seq, status')
    .eq('penca_id', penca.id)
    .eq('status', 'result_published')
    .order('seq');

  if (!races || races.length === 0) {
    console.log('No hay carreras con resultados publicados.');
    process.exit(0);
  }

  console.log(`\nRecalculando ${races.length} carrera(s) publicadas...`);

  for (const race of races) {
    console.log(`\nCarrera #${race.seq} (${race.id})`);
    await recalcRace(penca.id, race.id, race.seq, ruleset);
  }

  console.log('\n✅ Recálculo completo!');
  process.exit(0);
})();
