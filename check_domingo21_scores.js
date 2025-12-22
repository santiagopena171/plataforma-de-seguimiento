const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://jvsejwjvhhzjuxcrhunk.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkDomingo21Scores() {
  console.log('Verificando puntajes del domingo 21...\n');

  // Get domingo 21
  const { data: raceDay } = await supabase
    .from('race_days')
    .select('*')
    .eq('id', 'ea868d1e-5f97-402c-b4ac-60bad2058481')
    .single();

  console.log('Race Day:', raceDay.name);

  // Get races del domingo 21 (82-93)
  const { data: races } = await supabase
    .from('races')
    .select('id, seq')
    .eq('race_day_id', raceDay.id)
    .order('seq');

  console.log('Carreras:', races.map(r => r.seq).join(', '));

  const raceIds = races.map(r => r.id);

  // Get scores para estas carreras
  const { data: scores } = await supabase
    .from('scores')
    .select('*, memberships!inner(guest_name, profiles(display_name))')
    .in('race_id', raceIds)
    .order('points_total', { ascending: false });

  console.log(`\nTotal scores encontrados: ${scores.length}`);
  console.log('Esperados: 12 carreras x 12 jugadores = 144 scores\n');

  // Agrupar por jugador
  const byPlayer = {};
  scores.forEach(score => {
    const name = score.memberships.guest_name || score.memberships.profiles?.display_name || 'Sin nombre';
    if (!byPlayer[name]) {
      byPlayer[name] = { total: 0, scores: [] };
    }
    byPlayer[name].total += score.points_total;
    byPlayer[name].scores.push({
      race: races.find(r => r.id === score.race_id)?.seq,
      points: score.points_total,
      breakdown: score.breakdown
    });
  });

  console.log('Puntajes totales por jugador:');
  Object.entries(byPlayer)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([name, data]) => {
      console.log(`${name}: ${data.total} pts`);
    });

  // Mostrar detalle de Darsenero
  console.log('\n\nDetalle de Darsenero (debería sumar 89):');
  const darsenero = byPlayer['Darsenero'];
  if (darsenero) {
    darsenero.scores
      .sort((a, b) => a.race - b.race)
      .forEach(s => {
        console.log(`Carrera #${s.race}: ${s.points} pts - ${JSON.stringify(s.breakdown)}`);
      });
  }

  // Verificar carrera #82 específicamente
  console.log('\n\nCarrera #82 - Todos los scores:');
  const race82 = races.find(r => r.seq === 82);
  const scores82 = scores.filter(s => s.race_id === race82.id);
  scores82.forEach(s => {
    const name = s.memberships.guest_name || s.memberships.profiles?.display_name;
    console.log(`${name}: ${s.points_total} pts - breakdown: ${JSON.stringify(s.breakdown)}`);
  });
}

checkDomingo21Scores().catch(console.error);
