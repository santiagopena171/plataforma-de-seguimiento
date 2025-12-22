const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read env file manually
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim();
  }
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkPublicAccess() {
  const pencaId = '4ab2cd97-d9b4-4f7b-8c7d-617e58d574b5';
  
  console.log('Testing public (anon) access to scores...\n');
  
  // Get a membership ID to test
  const { data: memberships } = await supabase
    .from('memberships')
    .select('id, guest_name')
    .eq('penca_id', pencaId)
    .limit(1);
    
  if (!memberships || memberships.length === 0) {
    console.log('No memberships found');
    return;
  }
  
  const testMembership = memberships[0];
  console.log(`Testing with membership: ${testMembership.guest_name || 'Unknown'} (${testMembership.id})\n`);
  
  // Try to get scores
  const { data: scores, error } = await supabase
    .from('scores')
    .select('points_total')
    .eq('membership_id', testMembership.id)
    .eq('penca_id', pencaId);
    
  console.log('Result:', {
    scoresCount: scores?.length || 0,
    error: error?.message || null
  });
  
  if (scores && scores.length > 0) {
    const totalPoints = scores.reduce((sum, s) => sum + (s.points_total || 0), 0);
    console.log(`Total points for this member: ${totalPoints}`);
  }
}

checkPublicAccess().catch(console.error);
