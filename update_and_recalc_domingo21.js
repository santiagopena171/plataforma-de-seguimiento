const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://jvsejwjvhhzjuxcrhunk.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Nueva configuración de puntos
const NEW_POINTS_CONFIG = {
  place: {
    first: 13,           // 1° cuando más de uno acierta
    second: 7,           // 2°
    third: 4,            // 3°
    fourth: 2,           // 4°
    exclusive_winner: 25 // 1° solo (nadie más acertó)
  }
};

async function updatePencaAndRecalculate() {
  console.log('=== ACTUALIZACIÓN DE CONFIGURACIÓN Y RECÁLCULO ===\n');

  // 1. Actualizar configuración de la penca
  console.log('1. Actualizando configuración de la penca...');
  const { error: updateError } = await supabase
    .from('pencas')
    .update({
      scoring_modality: 'place',
      points_config: NEW_POINTS_CONFIG
    })
    .eq('slug', 'mensual-maronas');

  if (updateError) {
    console.error('Error actualizando penca:', updateError);
    return;
  }
  console.log('✓ Configuración actualizada\n');

  // 2. Obtener penca y domingo 21
  const { data: penca } = await supabase
    .from('pencas')
    .select('id')
    .eq('slug', 'mensual-maronas')
    .single();

  const { data: races } = await supabase
    .from('races')
    .select('id, seq')
    .eq('race_day_id', 'ea868d1e-5f97-402c-b4ac-60bad2058481')
    .order('seq');

  console.log(`2. Recalculando ${races.length} carreras del domingo 21...\n`);

  // 3. Recalcular cada carrera
  let successCount = 0;
  for (const race of races) {
    try {
      console.log(`   Recalculando carrera #${race.seq}...`);
      
      const response = await fetch('https://jvsejwjvhhzjuxcrhunk.supabase.co/functions/v1/recalculate-scores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify({
          raceId: race.id,
          pencaId: penca.id
        })
      });

      if (response.ok) {
        successCount++;
        console.log(`   ✓ Carrera #${race.seq} recalculada`);
      } else {
        const error = await response.text();
        console.log(`   ✗ Error en carrera #${race.seq}:`, error);
      }
    } catch (error) {
      console.log(`   ✗ Error en carrera #${race.seq}:`, error.message);
    }
  }

  console.log(`\n✓ ${successCount}/${races.length} carreras recalculadas exitosamente\n`);

  // 4. Verificar nuevos totales
  console.log('3. Verificando nuevos totales...\n');
  
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

  console.log('Nuevos totales por jugador:');
  Object.entries(byPlayer)
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, total]) => {
      console.log(`   ${name}: ${total} pts`);
    });

  console.log('\n=== PROCESO COMPLETADO ===');
}

updatePencaAndRecalculate().catch(console.error);
