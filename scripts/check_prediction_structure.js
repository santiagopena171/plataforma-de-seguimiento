const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://jvsejwjvhhzjuxcrhunk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2c2Vqd2p2aGh6anV4Y3JodW5rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjgwOTQyNCwiZXhwIjoyMDc4Mzg1NDI0fQ.NBXdIsRUPrxdiO_t_aPUNhHJbOMqEPxlnA5VAQevEQ0'
);

async function checkPredictionStructure() {
  // Get a race from domingo 21
  const { data: races } = await supabase
    .from('races')
    .select('*')
    .eq('seq', 82)
    .single();

  console.log('Race 82 ID:', races.id);

  // Get one prediction for this race
  const { data: predictions } = await supabase
    .from('predictions')
    .select('*')
    .eq('race_id', races.id)
    .limit(3);

  console.log('\nSample predictions:');
  predictions.forEach((p, i) => {
    console.log(`\nPredicción ${i+1}:`);
    console.log('Fields:', Object.keys(p));
    console.log('Data:', JSON.stringify(p, null, 2));
  });
}

checkPredictionStructure().catch(console.error);
