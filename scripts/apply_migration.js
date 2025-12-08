const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('Reading migration file...');
  const sql = fs.readFileSync('supabase/migrations/20250115000000_fix_predictions_unique_constraint.sql', 'utf8');
  
  console.log('SQL to execute:');
  console.log(sql);
  console.log('\nApplying migration...');

  // Since Supabase doesn't have an exec_sql RPC by default, we'll execute each statement separately
  const statements = sql.split(';').filter(s => s.trim());
  
  for (const statement of statements) {
    if (!statement.trim()) continue;
    
    console.log('\nExecuting:', statement.trim().substring(0, 80) + '...');
    
    try {
      // Try to execute via a custom query - this might not work
      const { data, error } = await supabase.rpc('exec_sql', { sql: statement });
      
      if (error) {
        console.error('Error:', error);
      } else {
        console.log('✓ Success');
      }
    } catch (err) {
      console.error('Exception:', err.message);
    }
  }
}

applyMigration().catch(console.error);
