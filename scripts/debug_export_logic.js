const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugExportLogic() {
  try {
    // 1. Get penca
    const { data: penca } = await supabase
      .from('pencas')
      .select('*')
      .eq('slug', 'mensual-maronas')
      .single();

    console.log('✅ Penca:', penca.name);

    // 2. Get memberships
    const { data: memberships } = await supabase
      .from('memberships')
      .select(`
        id,
        user_id,
        guest_name,
        profiles:user_id (display_name)
      `)
      .eq('penca_id', penca.id);

    console.log(`📋 Miembros encontrados: ${memberships.length}\n`);

    // 3. Get race_days
    const { data: raceDays } = await supabase
      .from('race_days')
      .select('*')
      .eq('penca_id', penca.id)
      .order('day_date', { ascending: true });

    // 4. Get all races
    const { data: races } = await supabase
      .from('races')
      .select('*')
      .eq('penca_id', penca.id)
      .eq('status', 'result_published')
      .order('seq');

    console.log(`🏁 Carreras publicadas: ${races.length}`);

    // 5. Get all scores
    const { data: scores } = await supabase
      .from('scores')
      .select('*')
      .eq('penca_id', penca.id);

    console.log(`📊 Total scores en DB: ${scores.length}\n`);

    // Find domingo 21
    const domingo21 = raceDays.find(d => d.day_name === 'domingo 21');
    if (!domingo21) {
      console.log('❌ No se encontró domingo 21');
      return;
    }

    console.log(`🎯 Analizando: ${domingo21.day_name}`);
    console.log(`   Race Day ID: ${domingo21.id}\n`);

    // Get races for domingo 21
    const domingo21Races = races.filter(r => r.race_day_id === domingo21.id);
    console.log(`   Carreras del día: ${domingo21Races.length}`);
    console.log(`   Seq numbers: ${domingo21Races.map(r => r.seq).join(', ')}\n`);

    // For each member, calculate points EXACTLY like the export does
    console.log('═══════════════════════════════════════════════════════════');
    console.log('SIMULANDO LÓGICA DE EXPORTACIÓN:');
    console.log('═══════════════════════════════════════════════════════════\n');

    const results = [];

    for (const member of memberships) {
      const displayName = member.profiles?.display_name || member.guest_name || 'Unknown';
      
      // THIS IS THE EXACT FILTER LOGIC FROM THE EXPORT
      const memberScores = scores.filter(s => 
        (s.user_id && s.user_id === member.user_id) || s.membership_id === member.id
      );

      console.log(`\n👤 ${displayName}`);
      console.log(`   Member ID: ${member.id}`);
      console.log(`   User ID: ${member.user_id || 'NULL'}`);
      console.log(`   Total scores para este miembro: ${memberScores.length}`);

      // Calculate points for domingo 21 EXACTLY like the export
      let dayPoints = 0;
      const domingo21RaceIds = domingo21Races.map(r => r.id);
      
      for (const race of domingo21Races) {
        const raceScore = memberScores.find(s => s.race_id === race.id);
        if (raceScore) {
          console.log(`   ✓ Race ${race.seq}: ${raceScore.points_total} pts (score_id: ${raceScore.id})`);
          dayPoints += raceScore.points_total || 0;
        } else {
          console.log(`   ✗ Race ${race.seq}: NO SCORE FOUND`);
        }
      }

      console.log(`   🎯 TOTAL DOMINGO 21: ${dayPoints} pts`);

      results.push({
        name: displayName,
        points: dayPoints
      });
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('RESUMEN - DOMINGO 21:');
    console.log('═══════════════════════════════════════════════════════════\n');

    results.sort((a, b) => b.points - a.points);
    results.forEach(r => {
      console.log(`${r.name.padEnd(20)} ${r.points} pts`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugExportLogic();
