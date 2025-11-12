const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
function parseEnv(filePath){
  const raw = fs.readFileSync(filePath,'utf8');
  const lines = raw.split(/\r?\n/);
  const env = {};
  for (let line of lines){ line = line.trim(); if(!line||line.startsWith('#')) continue; const eq=line.indexOf('='); if(eq===-1) continue; const key=line.slice(0,eq).trim(); let val=line.slice(eq+1).trim(); if((val.startsWith('"')&&val.endsWith('"'))||(val.startsWith("'")&&val.endsWith("'"))){val=val.slice(1,-1);} env[key]=val; }
  return env;
}
(async()=>{
  const repoRoot = path.resolve(__dirname,'..');
  const envPath = path.join(repoRoot,'.env.local');
  const env = parseEnv(envPath);
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false,autoRefreshToken:false} });
  const raceId = process.argv[2]; if(!raceId){ console.error('usage: node scripts/list_scores.js <raceId>'); process.exit(1);} 
  const { data } = await supabase.from('scores').select('*').eq('race_id', raceId).order('membership_id', {ascending:true});
  console.log(JSON.stringify(data, null, 2));
})();