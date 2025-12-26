const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://jvsejwjvhhzjuxcrhunk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2c2Vqd2p2aGh6anV4Y3JodW5rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjgwOTQyNCwiZXhwIjoyMDc4Mzg1NDI0fQ.NBXdIsRUPrxdiO_t_aPUNhHJbOMqEPxlnA5VAQevEQ0'
);

async function checkPredictions() {
  try {
    console.log('Buscando carreras 94 y 97...\n');
    
    // Buscar carreras con seq 94 y 97
    const { data: races, error: racesError } = await supabase
      .from('races')
      .select('id, seq, penca_id')
      .in('seq', [94, 97])
      .order('seq');
    
    if (racesError) {
      console.error('Error al buscar carreras:', racesError);
      return;
    }
    
    console.log('Carreras encontradas:', races);
    
    for (const race of races) {
      console.log(`\n\n=== CARRERA #${race.seq} (ID: ${race.id}) ===`);
      
      // Obtener predicciones para esta carrera
      const { data: predictions, error: predsError } = await supabase
        .from('predictions')
        .select('*')
        .eq('race_id', race.id);
      
      if (predsError) {
        console.error('Error al buscar predicciones:', predsError);
        continue;
      }
      
      console.log(`\nTotal de predicciones: ${predictions.length}`);
      
      // Contar predicciones válidas (con winner_pick)
      const validPreds = predictions.filter(p => p.winner_pick);
      console.log(`Predicciones con winner_pick válido: ${validPreds.length}`);
      
      // Mostrar detalles de cada predicción
      predictions.forEach((pred, index) => {
        console.log(`\nPredicción #${index + 1}:`);
        console.log(`  - ID: ${pred.id}`);
        console.log(`  - membership_id: ${pred.membership_id}`);
        console.log(`  - user_id: ${pred.user_id}`);
        console.log(`  - winner_pick: ${pred.winner_pick}`);
        console.log(`  - entered_by_admin: ${pred.entered_by_admin}`);
        console.log(`  - is_locked: ${pred.is_locked}`);
      });
      
      // Obtener memberships de la penca
      const { data: memberships, error: membershipsError } = await supabase
        .from('memberships')
        .select('id, user_id, guest_name, role')
        .eq('penca_id', race.penca_id)
        .neq('role', 'admin');
      
      if (membershipsError) {
        console.error('Error al buscar memberships:', membershipsError);
        continue;
      }
      
      console.log(`\n\nJugadores de la penca (sin admin): ${memberships.length}`);
      memberships.forEach(m => {
        const hasPrediction = predictions.some(p => 
          p.membership_id === m.id || p.user_id === m.user_id
        );
        const hasValidPrediction = validPreds.some(p => 
          (p.membership_id === m.id || p.user_id === m.user_id) && p.winner_pick
        );
        console.log(`  - ${m.guest_name || m.user_id} (ID: ${m.id}): ${hasValidPrediction ? '✓ Predicción válida' : hasPrediction ? '✗ Predicción sin winner_pick' : '✗ Sin predicción'}`);
      });
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkPredictions();
