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
  const dotEnvPath = path.join(repoRoot, '.env');
  const env = parseEnv(dotEnvPath);
  
  const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY;
  
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { 
    auth: { persistSession: false, autoRefreshToken: false } 
  });

  // Buscar penca
  const { data: penca } = await supabase
    .from('pencas')
    .select('id, name')
    .ilike('slug', '%mensual-maronas%')
    .single();

  console.log(`✅ Penca: ${penca.name} (${penca.id})\n`);

  // Buscar las últimas carreras por seq
  const { data: races } = await supabase
    .from('races')
    .select('*')
    .eq('penca_id', penca.id)
    .gte('seq', 80)
    .order('seq', { ascending: true });

  console.log(`📋 Carreras desde seq 80: ${races?.length || 0}\n`);
  
  if (races && races.length > 0) {
    races.forEach(r => {
      console.log(`[${r.seq}] Carrera ID: ${r.id} - Status: ${r.status}`);
    });
    
    const raceIds = races.map(r => r.id);
    
    console.log('\n📊 Obteniendo scores...\n');
    
    // Obtener memberships
    const { data: memberships } = await supabase
      .from('memberships')
      .select('id, user_id, guest_name, profiles(display_name)')
      .eq('penca_id', penca.id);
    
    console.log(`👥 Miembros: ${memberships?.length || 0}\n`);
    
    // Obtener scores
    const { data: allScores } = await supabase
      .from('scores')
      .select('*')
      .in('race_id', raceIds)
      .eq('penca_id', penca.id);
    
    console.log(`📈 Scores totales: ${allScores?.length || 0}\n`);
    console.log('='.repeat(100));
    console.log('PUNTAJES POR MIEMBRO\n');
    console.log('='.repeat(100));
    
    // Agrupar por miembro
    const memberScores = {};
    
    memberships.forEach(member => {
      const name = member.profiles?.display_name || member.guest_name || 'Sin nombre';
      memberScores[member.id] = {
        name,
        membership_id: member.id,
        user_id: member.user_id,
        scores: {},
        total: 0
      };
    });
    
    // Asignar scores
    (allScores || []).forEach(score => {
      const membershipId = score.membership_id;
      const userId = score.user_id;
      
      if (membershipId && memberScores[membershipId]) {
        const race = races.find(r => r.id === score.race_id);
        if (race) {
          memberScores[membershipId].scores[race.seq] = score.points_total || 0;
          memberScores[membershipId].total += score.points_total || 0;
        }
      } else if (userId) {
        const member = memberships.find(m => m.user_id === userId);
        if (member && memberScores[member.id]) {
          const race = races.find(r => r.id === score.race_id);
          if (race) {
            memberScores[member.id].scores[race.seq] = score.points_total || 0;
            memberScores[member.id].total += score.points_total || 0;
          }
        }
      }
    });
    
    // Ordenar y mostrar
    const sortedMembers = Object.values(memberScores)
      .sort((a, b) => b.total - a.total);
    
    sortedMembers.forEach((member, index) => {
      console.log(`${index + 1}. ${member.name} - TOTAL: ${member.total} pts`);
      console.log(`   Membership ID: ${member.membership_id.substring(0, 8)}...`);
      
      // Mostrar scores por carrera
      const seqs = Object.keys(member.scores).sort((a, b) => parseInt(a) - parseInt(b));
      if (seqs.length > 0) {
        const scoresLine = seqs.map(seq => `[${seq}]:${member.scores[seq]}`).join(' ');
        console.log(`   ${scoresLine}`);
      } else {
        console.log(`   (sin puntajes)`);
      }
      console.log('');
    });
  }

  process.exit(0);
})();
