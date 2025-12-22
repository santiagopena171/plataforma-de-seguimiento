const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://jvsejwjvhhzjuxcrhunk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2c2Vqd2p2aGh6anV4Y3JodW5rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjgwOTQyNCwiZXhwIjoyMDc4Mzg1NDI0fQ.NBXdIsRUPrxdiO_t_aPUNhHJbOMqEPxlnA5VAQevEQ0'
);

(async () => {
  const { data: race } = await supabase
    .from('races')
    .select('id, seq')
    .eq('seq', 90)
    .eq('penca_id', '4ab2cd97-d9b4-4f7b-8c7d-617e58d574b5')
    .single();
    
  console.log('Race #90:', race);
  
  const { data: result } = await supabase
    .from('race_results')
    .select('*')
    .eq('race_id', race.id)
    .single();
    
  console.log('\nRace Result:');
  console.log('- first_place:', result.first_place);
  console.log('- second_place:', result.second_place);
  console.log('- third_place:', result.third_place);
  console.log('- fourth_place:', result.fourth_place);
  console.log('- official_order:', result.official_order);
  
  if (result.official_order && result.official_order.length > 0) {
    const { data: entries } = await supabase
      .from('race_entries')
      .select('id, program_number, label')
      .in('id', result.official_order);
      
    console.log('\nEntries in official_order:');
    result.official_order.forEach((id, idx) => {
      const entry = entries.find(e => e.id === id);
      console.log(`  ${idx + 1}°: #${entry?.program_number} ${entry?.label || ''}`);
    });
  }
})();
