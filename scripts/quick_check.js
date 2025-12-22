const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://jvsejwjvhhzjuxcrhunk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2c2Vqd2p2aGh6anV4Y3JodW5rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjgwOTQyNCwiZXhwIjoyMDc4Mzg1NDI0fQ.NBXdIsRUPrxdiO_t_aPUNhHJbOMqEPxlnA5VAQevEQ0'
);

async function quickCheck() {
  const { data: penca } = await supabase.from('pencas').select('*').eq('slug', 'mensual-maronas').single();
  const { data: raceDays } = await supabase.from('race_days').select('*').eq('penca_id', penca.id);
  const domingo21 = raceDays.find(d => d.day_name === 'domingo 21');
  const { data: races } = await supabase.from('races').select('*').eq('race_day_id', domingo21.id);
  const raceIds = races.map(r => r.id);
  const { data: scores } = await supabase.from('scores').select('*').in('race_id', raceIds);
  const { data: memberships } = await supabase.from('memberships').select('id, guest_name, profiles:user_id(display_name)').eq('penca_id', penca.id);

  console.log('DOMINGO 21 - Scores en DB:\n');
  memberships.forEach(m => {
    const name = m.profiles?.display_name || m.guest_name || 'Unknown';
    const memberScores = scores.filter(s => s.membership_id === m.id);
    const total = memberScores.reduce((sum, s) => sum + (s.points_total || 0), 0);
    console.log(`${name.padEnd(20)} ${total} pts`);
  });
}

quickCheck().catch(console.error);
