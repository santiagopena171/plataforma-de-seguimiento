// Este script recalcula los scores para las carreras 82-93 directamente en la DB
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://jvsejwjvhhzjuxcrhunk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2c2Vqd2p2aGh6anV4Y3JodW5rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjgwOTQyNCwiZXhwIjoyMDc4Mzg1NDI0fQ.NBXdIsRUPrxdiO_t_aPUNhHJbOMqEPxlnA5VAQevEQ0'
);

//  Lógica de calculateScores simplificada (solo place/top4)
function calculatePlace(officialOrder, predictedOrder, modalities) {
  if (!modalities.place?.enabled) return { points: 0, breakdown: {} };
  
  const topN = modalities.place.top_n || 4;
  const pointsPerPosition = modalities.place.points_per_position || { first: 10, second: 7, third: 5, fourth: 3 };
  
  let points = 0;
  const breakdown = [];

  for (let i = 0; i < Math.min(topN, officialOrder.length); i++) {
    const officialEntryId = officialOrder[i];
    const predictedEntryId = predictedOrder?.[i];
    
    if (predictedEntryId && officialEntryId === predictedEntryId) {
      let posPoints = 0;
      if (i === 0) posPoints = pointsPerPosition.first || 0;
      else if (i === 1) posPoints = pointsPerPosition.second || 0;
      else if (i === 2) posPoints = pointsPerPosition.third || 0;
      else if (i === 3) posPoints = pointsPerPosition.fourth || 0;
      
      points += posPoints;
      breakdown.push(posPoints);
    }
  }

  return { points, breakdown: { place: breakdown } };
}

async function recalculateRace(raceId, raceSeq, pencaModalities) {
  console.log(`\n🔄 Recalculando carrera ${raceSeq}...`);
  
  // Get race
  const { data: race, error: raceError } = await supabase
    .from('races')
    .select('*')
    .eq('id', raceId)
    .single();

  if (raceError) {
    console.log(`  ❌ Error obteniendo carrera:`, raceError.message);
    return;
  }

  if (!race) {
    console.log(`  ⚠️  Carrera no encontrada`);
    return;
  }

  console.log(`  Status: ${race.status}`);

  if (race.status !== 'result_published') {
    console.log(`  ⚠️  Carrera no publicada`);
    return;
  }

  // Get official results
  const { data: raceResult } = await supabase
    .from('race_results')
    .select('*')
    .eq('race_id', raceId)
    .single();

  if (!raceResult) {
    console.log(`  ⚠️  No hay resultado oficial`);
    return;
  }

  const officialOrder = raceResult.official_order;
  
  // Get all predictions for this race
  const { data: predictions } = await supabase
    .from('predictions')
    .select('*')
    .eq('race_id', raceId);

  if (!predictions || predictions.length === 0) {
    console.log(`  ⚠️  No hay predicciones`);
    return;
  }

  console.log(`  Procesando ${predictions.length} predicciones...`);
  
  const modalities = pencaModalities;
  let scoresCreated = 0;
  let scoresUpdated = 0;

  for (const prediction of predictions) {
    // Calculate score
    const predictedOrder = prediction.place_pick || [];
    const result = calculatePlace(officialOrder, predictedOrder, modalities);
    
    const scoreData = {
      penca_id: race.penca_id,
      race_id: raceId,
      user_id: prediction.user_id,
      membership_id: prediction.membership_id,
      points_total: result.points,
      breakdown: result.breakdown
    };

    // Try to update existing score first
    const { data: existingScore, error: findError } = await supabase
      .from('scores')
      .select('id')
      .eq('race_id', raceId)
      .eq('membership_id', prediction.membership_id)
      .maybeSingle();

    if (existingScore && existingScore.id) {
      const { error: updateError } = await supabase
        .from('scores')
        .update(scoreData)
        .eq('id', existingScore.id);
      
      if (updateError) {
        console.log(`  ⚠️  Error actualizando score: ${updateError.message}`);
      } else {
        scoresUpdated++;
      }
    } else {
      const { error: insertError } = await supabase
        .from('scores')
        .insert([scoreData]);
      
      if (insertError) {
        console.log(`  ⚠️  Error creando score: ${insertError.message}`);
      } else {
        scoresCreated++;
      }
    }
  }

  console.log(`  ✅ Completado: ${scoresCreated} creados, ${scoresUpdated} actualizados`);
}

async function main() {
  const { data: penca } = await supabase
    .from('pencas')
    .select('*')
    .eq('slug', 'mensual-maronas')
    .single();

  console.log('Penca:', penca.name, '\n');

  // Hardcode modalities for mensual-maronas (place/top4 only)
  const modalities = {
    place: {
      enabled: true,
      top_n: 4,
      points_per_position: {
        first: 10,
        second: 7,
        third: 5,
        fourth: 3
      }
    }
  };

  const { data: races } = await supabase
    .from('races')
    .select('*')
    .eq('penca_id', penca.id)
    .gte('seq', 82)
    .lte('seq', 93)
    .order('seq');

  console.log(`📊 Recalculando ${races.length} carreras del domingo 21\n`);

  for (const race of races) {
    await recalculateRace(race.id, race.seq, modalities);
  }

  console.log('\n✨ Proceso completado');
}

main().catch(console.error);
