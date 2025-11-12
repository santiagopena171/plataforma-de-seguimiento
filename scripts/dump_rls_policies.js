const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function parseEnv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const env = {};
  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

(async function(){
  const repoRoot = path.resolve(__dirname, '..');
  const envPath = path.join(repoRoot, '.env.local');
  if (!fs.existsSync(envPath)) { console.error('.env.local missing'); process.exit(1); }
  const env = parseEnv(envPath);
  const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE) { console.error('Missing service role'); process.exit(1); }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  console.log('Connected to Supabase as service_role');

  const tables = ['predictions','scores','race_results','race_entries','memberships'];
  for (const t of tables) {
    try {
      const { data, error } = await supabase.rpc('pg_read_policies', { tbl: t }).catch(()=>({ error: 'rpc missing' }));
      // fallback: query pg_catalog
      if (error || !data) {
        const q = `SELECT polname, polcmd, polroles::text, polqual::text, polwithcheck::text FROM pg_policy WHERE polrelid = (SELECT oid FROM pg_class WHERE relname = '${t}' AND relnamespace = 'public'::regnamespace);`;
        const resp = await supabase.rpc('sql', { q }).catch(()=>null);
      }
    } catch (e) {
      console.error('err listing policies for', t, e.message || e);
    }
  }

  // Try direct query to pg_policies view
  try {
    const { data } = await supabase.rpc('sql', { q: `SELECT * FROM pg_policies WHERE schemaname='public' AND tablename IN ('predictions','scores','race_results','memberships')` }).catch(()=>({ data: null }));
    console.log('pg_policies:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('error querying pg_policies', e.message || e);
  }

  process.exit(0);
})();
