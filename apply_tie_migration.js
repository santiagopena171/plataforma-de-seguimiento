const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Leer .env.local manualmente
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY deben estar configurados en .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function applyMigration() {
  console.log('🔄 Aplicando migración: agregar columna first_place_tie...\n');

  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE race_results 
      ADD COLUMN IF NOT EXISTS first_place_tie BOOLEAN DEFAULT FALSE;
    `
  });

  if (error) {
    // Intentar con query directo si no existe la función exec_sql
    console.log('⚠️  Función exec_sql no disponible, intentando método alternativo...\n');
    
    // Ejecutar directamente usando la REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql: `
          ALTER TABLE race_results 
          ADD COLUMN IF NOT EXISTS first_place_tie BOOLEAN DEFAULT FALSE;
        `
      })
    });

    if (!response.ok) {
      console.error('❌ Error aplicando migración:', error);
      console.log('\n📝 Por favor, ejecuta este SQL manualmente en Supabase Dashboard > SQL Editor:\n');
      console.log('ALTER TABLE race_results');
      console.log('ADD COLUMN first_place_tie BOOLEAN DEFAULT FALSE;\n');
      process.exit(1);
    }
  }

  console.log('✅ Migración aplicada exitosamente!');
  console.log('✅ Columna first_place_tie agregada a race_results\n');
  console.log('🎉 Ya puedes usar la funcionalidad de empates en primer lugar');
}

applyMigration();
