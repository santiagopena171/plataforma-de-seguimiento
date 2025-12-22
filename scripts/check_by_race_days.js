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

  console.log(`✅ Penca: ${penca.name}\n`);

  // Buscar race_days
  const { data: raceDays, error: raceDaysError } = await supabase
    .from('race_days')
    .select('*')
    .eq('penca_id', penca.id)
    .order('day_date', { ascending: true });

  if (raceDaysError) {
    console.error('Error al buscar race_days:', raceDaysError);
    process.exit(1);
  }

  console.log(`📅 Race Days encontrados: ${raceDays?.length || 0}\n`);
  
  if (raceDays && raceDays.length > 0) {
    for (const day of raceDays) {
      const date = new Date(day.day_date);
      const dayOfWeek = date.toLocaleDateString('es-ES', { weekday: 'long' });
      const dayNum = date.getDate();
      
      console.log(`\n${'='.repeat(80)}`);
      console.log(`${day.day_name || 'Sin label'} - ${day.day_date} (${dayOfWeek} ${dayNum})`);
      console.log(`Race Day ID: ${day.id}`);
      console.log(`${'='.repeat(80)}`);
      
      // Buscar carreras de este día
      const { data: races } = await supabase
        .from('races')
        .select('id, seq, status')
        .eq('race_day_id', day.id)
        .order('seq', { ascending: true });
      
      if (races && races.length > 0) {
        console.log(`\n  Carreras (${races.length}):`);
        races.forEach(r => {
          console.log(`    [seq ${r.seq}] ${r.id} - ${r.status}`);
        });
        
        // Obtener memberships
        const { data: memberships } = await supabase
          .from('memberships')
          .select('id, user_id, guest_name, profiles(display_name)')
          .eq('penca_id', penca.id);
        
        // Obtener scores de estas carreras
        const raceIds = races.map(r => r.id);
        const { data: scores } = await supabase
          .from('scores')
          .select('*')
          .in('race_id', raceIds)
          .eq('penca_id', penca.id);
        
        console.log(`\n  Scores totales: ${scores?.length || 0}`);
        
        // Agrupar por miembro
        const memberTotals = {};
        
        memberships?.forEach(member => {
          const name = member.profiles?.display_name || member.guest_name || 'Sin nombre';
          memberTotals[member.id] = {
            name,
            total: 0
          };
        });
        
        scores?.forEach(score => {
          const membershipId = score.membership_id;
          const userId = score.user_id;
          
          if (membershipId && memberTotals[membershipId]) {
            memberTotals[membershipId].total += score.points_total || 0;
          } else if (userId) {
            const member = memberships?.find(m => m.user_id === userId);
            if (member && memberTotals[member.id]) {
              memberTotals[member.id].total += score.points_total || 0;
            }
          }
        });
        
        // Ordenar y mostrar
        const sorted = Object.values(memberTotals)
          .filter(m => m.total > 0)
          .sort((a, b) => b.total - a.total);
        
        console.log(`\n  Puntajes del día:`);
        sorted.forEach(m => {
          console.log(`    ${m.name}: ${m.total} pts`);
        });
      } else {
        console.log('    Sin carreras');
      }
    }
  }

  process.exit(0);
})();
