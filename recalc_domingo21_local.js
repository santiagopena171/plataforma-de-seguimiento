const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://jvsejwjvhhzjuxcrhunk.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Función para calcular scores (adaptada de calculateScores.ts)
async function calculateAndUpdateScores(pencaId, raceId, officialOrder) {
  // Get ruleset
  const { data: ruleset } = await supabase
    .from('rulesets')
    .select('*')
    .eq('penca_id', pencaId)
    .eq('is_active', true)
    .single();

  if (!ruleset) {
    throw new Error('No active ruleset found');
  }

  // Get predictions
  const { data: predictions } = await supabase
    .from('predictions')
    .select('*')
    .eq('race_id', raceId);

  if (!predictions || predictions.length === 0) {
    return 0;
  }

  const pointsTop3 = ruleset.points_top3;

  // Pre-calculate winner counts for place modality
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
  const scoresToUpdate = [];
  
  for (const prediction of predictions) {
    let totalPoints = 0;
    const breakdown = { place: [] };

    // Place modality
    const picks = [
      prediction.winner_pick,
      ...(prediction.exacta_pick || []),
      ...(prediction.trifecta_pick || []),
    ].filter((p, i, arr) => p && arr.indexOf(p) === i);

    for (let position = 0; position < officialOrder.length; position++) {
      const officialEntry = officialOrder[position];
      
      if (picks.includes(officialEntry)) {
        let points = 0;
        
        if (position === 0) {
          const isExclusiveWinner = placeWinnerCounts[officialOrder[0]] === 1;
          points = isExclusiveWinner ? ruleset.exclusive_winner_points : pointsTop3.first;
        } else if (position === 1) {
          points = pointsTop3.second;
        } else if (position === 2) {
          points = pointsTop3.third;
        } else if (position === 3) {
          points = pointsTop3.fourth;
        }
        
        if (points > 0) {
          totalPoints += points;
          breakdown.place.push(points);
        }
      }
    }

    scoresToUpdate.push({
      race_id: raceId,
      penca_id: pencaId,
      user_id: prediction.user_id,
      membership_id: prediction.membership_id,
      points_total: totalPoints,
      breakdown: breakdown
    });
  }

  // Update scores in database
  for (const score of scoresToUpdate) {
    await supabase
      .from('scores')
      .update({
        points_total: score.points_total,
        breakdown: score.breakdown
      })
      .eq('race_id', score.race_id)
      .eq('membership_id', score.membership_id);
  }

  return scoresToUpdate.length;
}

async function recalculateDomingo21() {
  console.log('=== RECALCULANDO SCORES DEL DOMINGO 21 ===\n');

  const { data: penca } = await supabase
    .from('pencas')
    .select('id')
    .eq('slug', 'mensual-maronas')
    .single();

  const { data: races } = await supabase
    .from('races')
    .select('*')
    .eq('race_day_id', 'ea868d1e-5f97-402c-b4ac-60bad2058481')
    .order('seq');

  console.log(`Procesando ${races.length} carreras (${races.map(r => r.seq).join(', ')})...\n`);

  let successCount = 0;
  
  for (const race of races) {
    try {
      // Get race result
      const { data: result } = await supabase
        .from('race_results')
        .select('*')
        .eq('race_id', race.id)
        .single();

      if (!result || !result.official_order) {
        console.log(`✗ Carrera #${race.seq}: sin resultado oficial`);
        continue;
      }

      const scoresUpdated = await calculateAndUpdateScores(
        penca.id,
        race.id,
        result.official_order
      );

      successCount++;
      console.log(`✓ Carrera #${race.seq}: ${scoresUpdated} scores recalculados`);
    } catch (error) {
      console.log(`✗ Carrera #${race.seq}: ${error.message}`);
    }
  }

  console.log(`\n${successCount}/${races.length} carreras recalculadas exitosamente\n`);

  // Mostrar nuevos totales
  console.log('=== NUEVOS TOTALES ===\n');
  
  const raceIds = races.map(r => r.id);
  const { data: scores } = await supabase
    .from('scores')
    .select('*, memberships!inner(guest_name, profiles(display_name))')
    .in('race_id', raceIds);

  const byPlayer = {};
  scores.forEach(score => {
    const name = score.memberships.guest_name || score.memberships.profiles?.display_name || 'Sin nombre';
    if (!byPlayer[name]) byPlayer[name] = 0;
    byPlayer[name] += score.points_total;
  });

  Object.entries(byPlayer)
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, total]) => {
      console.log(`${name}: ${total} pts`);
    });
}

recalculateDomingo21().catch(console.error);
