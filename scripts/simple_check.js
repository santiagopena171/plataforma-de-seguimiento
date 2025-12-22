const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://jvsejwjvhhzjuxcrhunk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2c2Vqd2p2aGh6anV4Y3JodW5rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjgwOTQyNCwiZXhwIjoyMDc4Mzg1NDI0fQ.NBXdIsRUPrxdiO_t_aPUNhHJbOMqEPxlnA5VAQevEQ0'
);

async function checkScoresForDomingo21() {
  // Get penca
  const { data: penca } = await supabase
    .from('pencas')
    .select('*')
    .eq('slug', 'mensual-maronas')
    .single();

  console.log('Penca:', penca.name, '\n');

  // Get race_day for domingo 21
  const { data: raceDays } = await supabase
    .from('race_days')
    .select('*')
    .eq('penca_id', penca.id);

  const domingo21 = raceDays.find(d => d.day_name === 'domingo 21');
  console.log('Domingo 21 race_day_id:', domingo21.id, '\n');

  // Get races for domingo 21
  const { data: races } = await supabase
    .from('races')
    .select('*')
    .eq('race_day_id', domingo21.id)
    .eq('status', 'result_published')
    .order('seq');

  const raceIds = races.map(r => r.id);
  console.log(`Carreras del domingo 21: ${races.length} carreras`);
  console.log(`Seq numbers: ${races.map(r => r.seq).join(', ')}`);
  console.log(`Race IDs:`, raceIds, '\n');

  // Get ALL scores for these races
  const { data: allScores } = await supabase
    .from('scores')
    .select('*')
    .in('race_id', raceIds);

  console.log(`Total scores para estas carreras: ${allScores.length}\n`);

  // Group by membership_id
  const byMembership = {};
  allScores.forEach(score => {
    const key = score.membership_id || score.user_id || 'unknown';
    if (!byMembership[key]) {
      byMembership[key] = [];
    }
    byMembership[key].push(score);
  });

  console.log('Scores agrupados por membership_id:\n');
  
  // Get memberships to get names
  const { data: memberships } = await supabase
    .from('memberships')
    .select(`
      id,
      user_id,
      guest_name,
      profiles:user_id (display_name)
    `)
    .eq('penca_id', penca.id);

  for (const member of memberships) {
    const name = member.profiles?.display_name || member.guest_name || 'Unknown';
    const membershipScores = byMembership[member.id] || [];
    const totalPoints = membershipScores.reduce((sum, s) => sum + (s.points_total || 0), 0);
    
    console.log(`${name.padEnd(20)} (membership_id: ${member.id})`);
    console.log(`  Scores encontrados: ${membershipScores.length}`);
    console.log(`  Total puntos: ${totalPoints}`);
    console.log(`  Race IDs con scores:`, membershipScores.map(s => races.find(r => r.id === s.race_id)?.seq || '?').join(', '));
    console.log();
  }
}

checkScoresForDomingo21().catch(console.error);
