const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://jvsejwjvhhzjuxcrhunk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2c2Vqd2p2aGh6anV4Y3JodW5rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjgwOTQyNCwiZXhwIjoyMDc4Mzg1NDI0fQ.NBXdIsRUPrxdiO_t_aPUNhHJbOMqEPxlnA5VAQevEQ0'
);

// Lógica COMPLETA copiada de calculateScores.ts
async function calculateScoresForRace(raceId, raceSeq) {
  console.log(`\n🔄 Recalculando carrera ${raceSeq}...`);

  // Get race
  const { data: race } = await supabase
    .from('races')
    .select('*')
    .eq('id', raceId)
    .single();

  if (!race || race.status !== 'result_published') {
    console.log('  ⚠️  Carrera no publicada');
    return;
  }

  // Get result
  const { data: raceResult } = await supabase
    .from('race_results')
    .select('*')
    .eq('race_id', raceId)
    .single();

  if (!raceResult) {
    console.log('  ⚠️  Sin resultado oficial');
    return;
  }

  const officialOrder = raceResult.official_order;

  // Get predictions
  const { data: predictions } = await supabase
    .from('predictions')
    .select('*')
    .eq('race_id', raceId);

  if (!predictions || predictions.length === 0) {
    console.log('  ⚠️  Sin predicciones');
    return;
  }

  console.log(`  Procesando ${predictions.length} predicciones...`);

  // Get ruleset for the penca
  const { data: ruleset } = await supabase
    .from('rulesets')
    .select('*')
    .eq('penca_id', race.penca_id)
    .eq('is_active', true)
    .single();

  if (!ruleset) {
    console.log('  ⚠️  No se encontró ruleset activo');
    return;
  }

  // Use ruleset values or fallback to hardcoded (for mensual-maronas)
  const modalities = ruleset.modalities_enabled || ['place'];
  const pointsTop3 = ruleset.points_top3 || { first: 10, second: 7, third: 5, fourth: 3 };

  // Count how many people picked the winner in place mode
  const placeWinnerCounts = {};

  for (const prediction of predictions) {
    const picks = [
      prediction.winner_pick,
      ...(prediction.exacta_pick || []),
      ...(prediction.trifecta_pick || []),
    ].filter((p, i, arr) => p && arr.indexOf(p) === i);

    if (picks.includes(officialOrder[0])) {
      placeWinnerCounts[officialOrder[0]] = (placeWinnerCounts[officialOrder[0]] || 0) + 1;
    }
  }

  // Calculate scores for each prediction
  let scoresUpdated = 0;

  for (const prediction of predictions) {
    let totalPoints = 0;
    const breakdown = { place: [] };

    // Combine all picks
    const picks = [
      prediction.winner_pick,
      ...(prediction.exacta_pick || []),
      ...(prediction.trifecta_pick || []),
    ].filter((p, i, arr) => p && arr.indexOf(p) === i);

    for (const pick of picks) {
      if (pick === officialOrder[0]) {
        // Check if this is an exclusive winner
        const isExclusiveWinner = placeWinnerCounts[officialOrder[0]] === 1;
        const points = isExclusiveWinner ? ruleset.exclusive_winner_points : pointsTop3.first;
        breakdown.place.push(points);
        totalPoints += points;
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

    // Update score in database
    const scoreData = {
      penca_id: race.penca_id,
      race_id: raceId,
      user_id: prediction.user_id,
      membership_id: prediction.membership_id,
      points_total: totalPoints,
      breakdown: breakdown
    };

    const { error } = await supabase
      .from('scores')
      .update(scoreData)
      .eq('race_id', raceId)
      .eq('membership_id', prediction.membership_id);

    if (!error) {
      scoresUpdated++;
    } else {
      console.log(`  ⚠️  Error actualizando score: ${error.message}`);
    }
  }

  console.log(`  ✅ Completado: ${scoresUpdated} scores actualizados`);
}

async function main() {
  const { data: penca } = await supabase
    .from('pencas')
    .select('*')
    .eq('slug', 'mensual-maronas')
    .single();

  const { data: races } = await supabase
    .from('races')
    .select('*')
    .eq('penca_id', penca.id)
    .gte('seq', 82)
    .lte('seq', 93)
    .order('seq');

  console.log(`📊 Recalculando ${races.length} carreras del domingo 21 con lógica CORRECTA\n`);

  for (const race of races) {
    await calculateScoresForRace(race.id, race.seq);
  }

  console.log('\n✨ Proceso completado');
}

main().catch(console.error);
