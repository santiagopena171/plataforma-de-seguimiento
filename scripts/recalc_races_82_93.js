const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://jvsejwjvhhzjuxcrhunk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2c2Vqd2p2aGh6anV4Y3JodW5rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjgwOTQyNCwiZXhwIjoyMDc4Mzg1NDI0fQ.NBXdIsRUPrxdiO_t_aPUNhHJbOMqEPxlnA5VAQevEQ0'
);

async function recalculateRaces() {
  // Get penca
  const { data: penca } = await supabase
    .from('pencas')
    .select('*')
    .eq('slug', 'mensual-maronas')
    .single();

  console.log('Penca:', penca.name, '\n');

  // Get races 82-93
  const { data: races } = await supabase
    .from('races')
    .select('*')
    .eq('penca_id', penca.id)
    .gte('seq', 82)
    .lte('seq', 93)
    .order('seq');

  console.log(`Encontradas ${races.length} carreras (seq 82-93)\n`);

  for (const race of races) {
    console.log(`\n🔄 Recalculando carrera ${race.seq}...`);
    console.log(`   Race ID: ${race.id}`);
    console.log(`   Status: ${race.status}`);

    try {
      const { data, error } = await supabase.functions.invoke('recalculate-scores', {
        body: { race_id: race.id }
      });

      if (error) {
        console.error(`   ❌ Error: ${error.message}`);
      } else {
        console.log(`   ✅ Éxito`);
      }
    } catch (err) {
      console.error(`   ❌ Error:`, err.message);
    }

    // Wait a bit between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n✨ Proceso completado');
}

recalculateRaces().catch(console.error);
