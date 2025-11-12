#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!url || !serviceKey) {
  console.error('Missing SUPABASE config in env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

async function main() {
  const patterns = ['%penca%', '%member%', '%score%', '%race%'];
  const results = [];
  for (const p of patterns) {
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_schema, table_name')
      .ilike('table_name', p)
      .order('table_schema', { ascending: true });
    if (error) {
      console.error('Error querying information_schema.tables:', error.message || error);
      process.exit(1);
    }
    if ((data || []).length > 0) {
      results.push({ pattern: p, rows: data });
    }
  }

  if (results.length === 0) {
    console.log('No matching tables found for patterns:', patterns.join(', '));
    // Also list all non-system tables as fallback
    const { data: all, error: errAll } = await supabase
      .from('information_schema.tables')
      .select('table_schema, table_name')
      .where('table_schema', 'not in', ['pg_catalog','information_schema']);
    if (errAll) {
      // Fallback: try select without filters
      console.error('Also failed to list tables:', errAll.message || errAll);
      process.exit(1);
    }
    console.log('Sample of non-system tables:', (all || []).slice(0, 50));
    process.exit(0);
  }

  console.log('Matching tables:');
  for (const r of results) {
    console.log('Pattern:', r.pattern);
    r.rows.forEach((row) => console.log(`  - ${row.table_schema}.${row.table_name}`));
  }
}

main().catch((err) => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
