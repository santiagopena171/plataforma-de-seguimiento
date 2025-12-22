const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://jvsejwjvhhzjuxcrhunk.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkRuleset() {
  const { data: penca } = await supabase
    .from('pencas')
    .select('id')
    .eq('slug', 'mensual-maronas')
    .single();

  const { data: ruleset } = await supabase
    .from('rulesets')
    .select('*')
    .eq('penca_id', penca.id)
    .eq('is_active', true)
    .single();

  console.log('Ruleset actual:');
  console.log(JSON.stringify(ruleset, null, 2));
}

checkRuleset().catch(console.error);
