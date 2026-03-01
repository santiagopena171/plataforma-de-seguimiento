const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const raw = fs.readFileSync('.env.local', 'utf8');
const env = {};
raw.split(/\r?\n/).forEach(l => { const eq = l.indexOf('='); if (eq > 0) env[l.slice(0, eq).trim()] = l.slice(eq + 1).trim().replace(/^['"]|['"]$/g, ''); });
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { error } = await sb.from('pencas').update({ last_sync_at: null }).eq('slug', 'florida-automatico');
  if (error) console.error('Error:', error.message);
  else console.log('last_sync_at reseteado a null — listo para probar');
  process.exit(0);
})();
