const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://jvsejwjvhhzjuxcrhunk.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function recalcDomingo21() {
  console.log('=== RECALCULANDO DOMINGO 21 ===\n');

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

  console.log(`Recalculando ${races.length} carreras (82-93)...\n`);

  let successCount = 0;
  for (const race of races) {
    try {
      console.log(`Carrera #${race.seq}...`);
      
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
        const result = await response.json();
        successCount++;
        console.log(`✓ Carrera #${race.seq} recalculada (${result.scoresUpdated} scores)`);
      } else {
        const error = await response.text();
        console.log(`✗ Error: ${error}`);
      }
    } catch (error) {
      console.log(`✗ Error: ${error.message}`);
    }
  }

  console.log(`\n${successCount}/${races.length} carreras recalculadas\n`);

  // Verificar totales
  console.log('Nuevos totales:\n');
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

recalcDomingo21().catch(console.error);
