const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://jvsejwjvhhzjuxcrhunk.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkPencaConfig() {
  const { data: penca } = await supabase
    .from('pencas')
    .select('*')
    .eq('slug', 'mensual-maronas')
    .single();

  console.log('Configuración de la penca mensual-maronas:\n');
  console.log('Scoring modality:', penca.scoring_modality);
  console.log('Points config:', JSON.stringify(penca.points_config, null, 2));
}

checkPencaConfig().catch(console.error);
