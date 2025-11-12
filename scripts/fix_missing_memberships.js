#!/usr/bin/env node
/**
 * Inspect scores for a penca and detect membership ids referenced by scores that
 * are missing in the memberships table. Optionally insert missing membership rows
 * with a default guest_name.
 *
 * Usage:
 *   node scripts/fix_missing_memberships.js --slug my-slug
 *   node scripts/fix_missing_memberships.js --penca-id <uuid> --apply
 */

const { createClient } = require('@supabase/supabase-js');
// Simple argv parser to avoid adding new deps
function parseArgv() {
  const out = {};
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const k = a.replace(/^--+/, '');
      const next = args[i + 1];
      if (!next || next.startsWith('--')) {
        out[k] = true;
      } else {
        out[k] = next;
        i++;
      }
    }
  }
  return out;
}
const argv = parseArgv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!url || !serviceKey) {
  console.error('Missing SUPABASE config. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

async function main() {
  const slug = argv.slug;
  const pencaId = argv['penca-id'] || argv['pencaId'];
  const apply = !!argv.apply;

  let penca;
  if (pencaId) {
    const { data, error } = await supabase.from('pencas').select('id, name, slug').eq('id', pencaId).limit(1).maybeSingle();
    if (error) throw error;
    penca = data;
  } else if (slug) {
    const { data, error } = await supabase.from('pencas').select('id, name, slug').eq('slug', slug).limit(1).maybeSingle();
    if (error) throw error;
    penca = data;
  } else {
    console.error('Provide --slug or --penca-id');
    process.exit(1);
  }

  if (!penca) {
    console.error('Penca not found');
    process.exit(1);
  }

  console.log('Penca:', penca);

  // Get distinct membership_ids referenced by scores for this penca
  const { data: scores, error: errScores } = await supabase
    .from('scores')
    .select('id, race_id, membership_id, user_id, points_total')
    .eq('penca_id', penca.id)
    .limit(1000);
  if (errScores) throw errScores;

  const membershipIds = Array.from(new Set((scores || []).map((s) => s.membership_id).filter(Boolean)));
  console.log('Scores found:', (scores || []).length, 'distinct membership ids referenced:', membershipIds.length);

  if (membershipIds.length === 0) {
    console.log('No membership_id referenced in scores for this penca. Exiting.');
    process.exit(0);
  }

  // Fetch existing memberships
  const { data: members, error: errMembers } = await supabase
    .from('memberships')
    .select('id, user_id, guest_name, created_at')
    .in('id', membershipIds)
    .limit(1000);
  if (errMembers) throw errMembers;

  const existingIds = new Set((members || []).map((m) => m.id));
  const missing = membershipIds.filter((id) => !existingIds.has(id));

  console.log('Existing memberships returned:', (members || []).length);
  console.log('Missing membership ids:', missing.length);
  if (missing.length > 0) {
    console.log('Sample missing ids:', missing.slice(0, 10));
  }

  // Print SQL statements to recreate missing memberships
  if (missing.length > 0) {
    console.log('\n-- SQL statements to create missing memberships (id, penca_id, guest_name)');
    missing.forEach((id, idx) => {
      const short = id.slice(0, 8);
      const guest = `Invitado ${short}`;
      const sql = `INSERT INTO memberships (id, penca_id, guest_name, created_at) VALUES ('${id}', '${penca.id}', '${guest}', now());`;
      console.log(sql);
    });

    if (apply) {
      console.log('\nApplying inserts...');
      for (const id of missing) {
        const short = id.slice(0, 8);
        const guest_name = `Invitado ${short}`;
        const { error: insertErr } = await supabase.from('memberships').insert([{ id, penca_id: penca.id, guest_name }]);
        if (insertErr) {
          console.error('Failed to insert membership', id, insertErr.message || insertErr);
        } else {
          console.log('Inserted membership', id);
        }
      }
      console.log('Done applying inserts.');
    } else {
      console.log('\nRun with --apply to actually insert the rows.');
    }
  }

  // Also show races count and sample scores
  const { data: races, error: errRaces } = await supabase.from('races').select('id, name, status').eq('penca_id', penca.id).limit(1000);
  if (errRaces) throw errRaces;
  console.log('\nRaces for penca:', (races || []).length);

  console.log('\nSample scores:');
  console.dir((scores || []).slice(0, 10), { depth: 3 });
}

main().catch((err) => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
