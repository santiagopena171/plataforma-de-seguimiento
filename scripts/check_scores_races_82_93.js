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
  
  // Intentar leer de .env primero
  const dotEnvPath = path.join(repoRoot, '.env');
  if (fs.existsSync(dotEnvPath)) {
    const env = parseEnv(dotEnvPath);
    SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
    SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY;
  }
  
  // Si no, intentar .env.local
  if ((!SUPABASE_URL || !SERVICE_ROLE) && fs.existsSync(envPath)) {
    const env = parseEnv(envPath);
    SUPABASE_URL = SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
    SERVICE_ROLE = SERVICE_ROLE || env.SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY;
  }
  
  // Variables de entorno del sistema
  if (!SUPABASE_URL) {
    SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  }
  if (!SERVICE_ROLE) {
    SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
  }
  
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error('❌ No se encontraron credenciales de Supabase');
    process.exit(1);
  }
  
  console.log(`📡 Conectando a: ${SUPABASE_URL}\n`);
  
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { 
    auth: { persistSession: false, autoRefreshToken: false } 
  });

  console.log('🔍 Buscando pencas disponibles...\n');

  // Primero listar todas las pencas
  const { data: allPencas } = await supabase
    .from('pencas')
    .select('id, name, slug');

  console.log(`📋 Pencas disponibles (${allPencas?.length || 0}):`);
  (allPencas || []).forEach(p => {
    console.log(`  - ${p.name} (slug: ${p.slug})`);
  });
  console.log('');

  // 1. Buscar la penca con diferentes variantes
  let penca = null;
  const searchTerms = ['mensual-maronas', 'mensual-maroñas', 'mensual maronas', 'mensual maroñas'];
  
  for (const term of searchTerms) {
    const { data } = await supabase
      .from('pencas')
      .select('id, name, slug')
      .or(`slug.ilike.%${term}%,name.ilike.%${term}%`)
      .limit(1)
      .single();
    
    if (data) {
      penca = data;
      console.log(`✅ Penca encontrada con término: "${term}"`);
      break;
    }
  }

  if (!penca) {
    console.error('❌ No se encontró la penca mensual-maronas/maroñas');
    console.error('Por favor verifica el slug correcto en la lista de arriba');
    process.exit(1);
  }

  console.log(`✅ Penca: ${penca.name} (${penca.id})\n`);

  // 2. Obtener las carreras 82 a 93
  const { data: races } = await supabase
    .from('races')
    .select('id, name, seq, race_date, status')
    .eq('penca_id', penca.id)
    .gte('seq', 82)
    .lte('seq', 93)
    .order('seq', { ascending: true });

  if (!races || races.length === 0) {
    console.error('❌ No se encontraron carreras entre seq 82 y 93');
    process.exit(1);
  }

  console.log(`📋 Carreras encontradas (${races.length}):\n`);
  races.forEach(r => {
    console.log(`  [${r.seq}] ${r.name} - ${r.race_date} - ${r.status}`);
  });
  console.log('');

  const raceIds = races.map(r => r.id);

  // 3. Obtener todos los memberships
  const { data: memberships } = await supabase
    .from('memberships')
    .select('id, user_id, guest_name, profiles(display_name)')
    .eq('penca_id', penca.id);

  if (!memberships || memberships.length === 0) {
    console.error('❌ No se encontraron memberships');
    process.exit(1);
  }

  console.log(`👥 Miembros encontrados: ${memberships.length}\n`);

  // 4. Obtener todos los scores de esas carreras
  const { data: allScores } = await supabase
    .from('scores')
    .select('*')
    .in('race_id', raceIds)
    .eq('penca_id', penca.id);

  console.log(`📊 Total scores encontrados: ${allScores?.length || 0}\n`);
  console.log('='.repeat(100));
  console.log('PUNTAJES POR MIEMBRO (Carreras 82-93)');
  console.log('='.repeat(100));
  console.log('');

  // 5. Agrupar scores por miembro
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

  // Asignar scores a cada miembro
  (allScores || []).forEach(score => {
    const membershipId = score.membership_id;
    const userId = score.user_id;

    // Buscar por membership_id primero
    if (membershipId && memberScores[membershipId]) {
      const race = races.find(r => r.id === score.race_id);
      if (race) {
        memberScores[membershipId].scores[race.seq] = score.points_total || 0;
        memberScores[membershipId].total += score.points_total || 0;
      }
    } else if (userId) {
      // Buscar membership por user_id
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

  // 6. Ordenar por total descendente
  const sortedMembers = Object.values(memberScores)
    .sort((a, b) => b.total - a.total);

  // 7. Mostrar resultados
  sortedMembers.forEach((member, index) => {
    console.log(`${index + 1}. ${member.name}`);
    console.log(`   Membership ID: ${member.membership_id}`);
    console.log(`   User ID: ${member.user_id || 'null'}`);
    console.log(`   TOTAL: ${member.total} puntos`);
    console.log('');
    console.log('   Puntajes por carrera:');
    
    // Mostrar scores de cada carrera
    races.forEach(race => {
      const points = member.scores[race.seq] || 0;
      console.log(`     [Carrera ${race.seq}]: ${points} pts`);
    });
    
    console.log('');
    console.log('-'.repeat(100));
    console.log('');
  });

  console.log('='.repeat(100));
  console.log('RESUMEN');
  console.log('='.repeat(100));
  console.log(`Total de miembros: ${sortedMembers.length}`);
  console.log(`Total de carreras: ${races.length}`);
  console.log(`Total de scores: ${allScores?.length || 0}`);
  console.log('');

  // Verificar si hay miembros sin scores
  const membersWithoutScores = sortedMembers.filter(m => m.total === 0);
  if (membersWithoutScores.length > 0) {
    console.log(`⚠️  ${membersWithoutScores.length} miembros sin puntajes:`);
    membersWithoutScores.forEach(m => {
      console.log(`   - ${m.name}`);
    });
  }

  process.exit(0);
})();
