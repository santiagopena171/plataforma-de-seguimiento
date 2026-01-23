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
  
  let SUPABASE_URL, SERVICE_ROLE;
  
  // Try to read from .env.local first
  if (fs.existsSync(envPath)) {
    const env = parseEnv(envPath);
    SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
    SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY;
  }
  
  // Fall back to environment variables
  if (!SUPABASE_URL) {
    SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  }
  if (!SERVICE_ROLE) {
    SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
  }
  
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error('❌ Faltan credenciales de Supabase');
    console.error('Por favor, configura las variables de entorno:');
    console.error('  NEXT_PUBLIC_SUPABASE_URL');
    console.error('  SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });

  console.log('=== DIAGNÓSTICO: Domingo 21 - Penca mensual-maronas ===\n');

  // 1. Buscar la penca mensual-maronas
  const { data: penca } = await supabase
    .from('pencas')
    .select('*')
    .ilike('slug', '%mensual-maronas%')
    .single();

  if (!penca) {
    console.error('❌ No se encontró la penca mensual-maronas');
    process.exit(1);
  }

  console.log('✅ Penca encontrada:', penca.name, '(ID:', penca.id + ')');
  console.log('   Slug:', penca.slug);
  console.log('');

  // 2. Buscar carreras del domingo 21 de diciembre 2024
  const { data: races } = await supabase
    .from('races')
    .select('*')
    .eq('penca_id', penca.id)
    .gte('race_date', '2024-12-21')
    .lt('race_date', '2024-12-22')
    .order('race_date', { ascending: true });

  if (!races || races.length === 0) {
    console.error('❌ No se encontraron carreras para el domingo 21 de diciembre 2024');
    process.exit(1);
  }

  console.log(`✅ Encontradas ${races.length} carreras para el domingo 21:\n`);
  
  for (const race of races) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`CARRERA: ${race.name}`);
    console.log(`  ID: ${race.id}`);
    console.log(`  Fecha: ${race.race_date}`);
    console.log(`  Estado: ${race.status}`);
    console.log(`  Resultado oficial: ${JSON.stringify(race.official_result)}`);
    console.log(`${'='.repeat(80)}`);

    // 3. Obtener el ruleset activo
    const { data: ruleset } = await supabase
      .from('rulesets')
      .select('*')
      .eq('penca_id', penca.id)
      .eq('is_active', true)
      .single();

    console.log('\n📋 Ruleset activo:');
    console.log('   Puntos Top 3:', JSON.stringify(ruleset.points_top3));
    console.log('   Modalidades:', JSON.stringify(ruleset.modalities_enabled));

    // 4. Obtener predicciones
    const { data: predictions } = await supabase
      .from('predictions')
      .select('*, memberships!predictions_membership_id_fkey(id, guest_name)')
      .eq('race_id', race.id);

    console.log(`\n👥 Total predicciones: ${predictions?.length || 0}`);

    // 5. Obtener scores
    const { data: scores } = await supabase
      .from('scores')
      .select('*, memberships!scores_membership_id_fkey(id, guest_name)')
      .eq('race_id', race.id)
      .order('points_total', { ascending: false });

    console.log(`\n🏆 Scores registrados: ${scores?.length || 0}`);
    
    if (scores && scores.length > 0) {
      console.log('\nTop 10 Puntajes:');
      scores.slice(0, 10).forEach((s, idx) => {
        const name = s.memberships?.guest_name || s.user_id || 'Unknown';
        console.log(`  ${idx + 1}. ${name}: ${s.points_total} puntos`);
        console.log(`     Breakdown: ${JSON.stringify(s.breakdown)}`);
      });
    }

    // 6. Verificar ganador exclusivo
    if (race.official_result && race.official_result.length > 0) {
      const winner = race.official_result[0];
      const winnerPicks = predictions?.filter(p => p.winner_pick === winner).length || 0;
      console.log(`\n🎯 Análisis del ganador: ${winner}`);
      console.log(`   Personas que lo eligieron como ganador: ${winnerPicks}`);
      console.log(`   ${winnerPicks === 1 ? `✨ GANADOR EXCLUSIVO (${ruleset.exclusive_winner_points || 25} puntos)` : `⚡ Ganador compartido (${ruleset.points_top3.first} puntos)`}`);

      // Contar cuántas personas lo eligieron en cualquier posición (para place/top3)
      let placePicks = 0;
      if (predictions) {
        for (const pred of predictions) {
          const allPicks = [
            pred.winner_pick,
            ...(pred.exacta_pick || []),
            ...(pred.trifecta_pick || []),
          ].filter((p, i, arr) => p && arr.indexOf(p) === i);
          
          if (allPicks.includes(winner)) {
            placePicks++;
          }
        }
      }
      console.log(`   Personas que lo incluyeron en alguna pick (place/top3): ${placePicks}`);
      console.log(`   ${placePicks === 1 ? `✨ GANADOR EXCLUSIVO EN PLACE (${ruleset.exclusive_winner_points || 25} puntos)` : `⚡ Ganador compartido en place (${ruleset.points_top3.first} puntos)`}`);
    }

    // 7. Recalcular manualmente algunos scores para verificar
    if (predictions && predictions.length > 0 && race.official_result) {
      console.log('\n🔍 Verificación manual de cálculo (primeras 3 predicciones):');
      
      // Calcular winnerCounts
      const winnerCounts = {};
      const placeWinnerCounts = {};
      
      for (const pred of predictions) {
        if (pred.winner_pick) {
          winnerCounts[pred.winner_pick] = (winnerCounts[pred.winner_pick] || 0) + 1;
        }
        
        const picks = [
          pred.winner_pick,
          ...(pred.exacta_pick || []),
          ...(pred.trifecta_pick || []),
        ].filter((p, i, arr) => p && arr.indexOf(p) === i);
        
        if (picks.includes(race.official_result[0])) {
          placeWinnerCounts[race.official_result[0]] = (placeWinnerCounts[race.official_result[0]] || 0) + 1;
        }
      }
      
      for (let i = 0; i < Math.min(3, predictions.length); i++) {
        const pred = predictions[i];
        const name = pred.memberships?.guest_name || pred.user_id || 'Unknown';
        console.log(`\n  ${name}:`);
        console.log(`    Winner pick: ${pred.winner_pick}`);
        console.log(`    Exacta pick: ${JSON.stringify(pred.exacta_pick)}`);
        console.log(`    Trifecta pick: ${JSON.stringify(pred.trifecta_pick)}`);
        
        let calculatedPoints = 0;
        const breakdown = {};
        
        // Winner modality
        if (ruleset.modalities_enabled.includes('winner') && pred.winner_pick) {
          if (pred.winner_pick === race.official_result[0]) {
            const isExclusive = winnerCounts[race.official_result[0]] === 1;
            const points = isExclusive ? (ruleset.exclusive_winner_points || 25) : ruleset.points_top3.first;
            breakdown.winner = points;
            calculatedPoints += points;
            console.log(`    ✓ Winner: ${points} pts ${isExclusive ? '(EXCLUSIVO)' : ''}`);
          } else {
            breakdown.winner = 0;
            console.log(`    ✗ Winner: 0 pts`);
          }
        }
        
        // Place/Top3 modality
        if (ruleset.modalities_enabled.includes('place') || ruleset.modalities_enabled.includes('top3')) {
          breakdown.place = [];
          const picks = [
            pred.winner_pick,
            ...(pred.exacta_pick || []),
            ...(pred.trifecta_pick || []),
          ].filter((p, i, arr) => p && arr.indexOf(p) === i);
          
          console.log(`    Picks únicos para place: ${JSON.stringify(picks)}`);
          
          for (const pick of picks) {
            if (pick === race.official_result[0]) {
              const isExclusive = placeWinnerCounts[race.official_result[0]] === 1;
              const points = isExclusive ? (ruleset.exclusive_winner_points || 25) : ruleset.points_top3.first;
              breakdown.place.push(points);
              calculatedPoints += points;
              console.log(`      ${pick}: ${points} pts (1er lugar) ${isExclusive ? '(EXCLUSIVO)' : ''}`);
            } else if (pick === race.official_result[1]) {
              breakdown.place.push(ruleset.points_top3.second);
              calculatedPoints += ruleset.points_top3.second;
              console.log(`      ${pick}: ${ruleset.points_top3.second} pts (2do lugar)`);
            } else if (pick === race.official_result[2]) {
              breakdown.place.push(ruleset.points_top3.third);
              calculatedPoints += ruleset.points_top3.third;
              console.log(`      ${pick}: ${ruleset.points_top3.third} pts (3er lugar)`);
            } else if (race.official_result[3] && pick === race.official_result[3]) {
              const fourthPoints = ruleset.points_top3.fourth || 0;
              breakdown.place.push(fourthPoints);
              calculatedPoints += fourthPoints;
              console.log(`      ${pick}: ${fourthPoints} pts (4to lugar)`);
            } else {
              breakdown.place.push(0);
              console.log(`      ${pick}: 0 pts (no acertó)`);
            }
          }
        }
        
        const existingScore = scores?.find(s => 
          (pred.membership_id && s.membership_id === pred.membership_id) ||
          (!pred.membership_id && s.user_id === pred.user_id)
        );
        
        console.log(`    CALCULADO: ${calculatedPoints} pts`);
        console.log(`    REGISTRADO: ${existingScore?.points_total || 'N/A'} pts`);
        
        if (existingScore && existingScore.points_total !== calculatedPoints) {
          console.log(`    ⚠️  DIFERENCIA DETECTADA: ${existingScore.points_total} vs ${calculatedPoints}`);
        }
      }
    }
  }

  console.log('\n\n' + '='.repeat(80));
  console.log('RESUMEN DEL DIAGNÓSTICO');
  console.log('='.repeat(80));
  console.log(`Total de carreras analizadas: ${races.length}`);
  console.log('\n✅ Diagnóstico completado');
  
  process.exit(0);
})();
