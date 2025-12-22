const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://jvsejwjvhhzjuxcrhunk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2c2Vqd2p2aGh6anV4Y3JodW5rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjgwOTQyNCwiZXhwIjoyMDc4Mzg1NDI0fQ.NBXdIsRUPrxdiO_t_aPUNhHJbOMqEPxlnA5VAQevEQ0'
);

async function checkScoresCount() {
  const { data: penca } = await supabase
    .from('pencas')
    .select('*')
    .eq('slug', 'mensual-maronas')
    .single();

  console.log('Penca:', penca.name);
  console.log('Penca ID:', penca.id, '\n');

  // Get all scores for this penca
  const { data: allScores, error } = await supabase
    .from('scores')
    .select('*')
    .eq('penca_id', penca.id);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Total scores en DB:', allScores.length);
  console.log('Sample score:', allScores[0], '\n');

  // Get domingo 21 race_day
  const { data: raceDays } = await supabase
    .from('race_days')
    .select('*')
    .eq('penca_id', penca.id);

  const domingo21 = raceDays.find(d => d.day_name === 'domingo 21');
  
  // Get domingo 21 races
  const { data: races } = await supabase
    .from('races')
    .select('*')
    .eq('race_day_id', domingo21.id)
    .eq('status', 'result_published');

  const domingo21RaceIds = races.map(r => r.id);
  console.log('Domingo 21 races:', races.length);
  console.log('Seq:', races.map(r => r.seq).join(', '), '\n');

  // Count scores for domingo 21
  const domingo21Scores = allScores.filter(s => domingo21RaceIds.includes(s.race_id));
  console.log('Total scores para domingo 21:', domingo21Scores.length);
  console.log('Debería ser:', races.length * 12, '(12 miembros × ' + races.length + ' carreras)\n');

  // Group by membership_id
  const byMembership = {};
  domingo21Scores.forEach(s => {
    if (!byMembership[s.membership_id]) {
      byMembership[s.membership_id] = [];
    }
    byMembership[s.membership_id].push(s);
  });

  console.log('Scores por membership:');
  Object.entries(byMembership).forEach(([memId, scores]) => {
    console.log(`  ${memId}: ${scores.length} scores`);
  });
}

checkScoresCount().catch(console.error);
