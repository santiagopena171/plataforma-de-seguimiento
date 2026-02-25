const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
    const { data: penca } = await supabase.from('pencas').select('id').eq('slug', 'prueba').single();
    const { data: race } = await supabase.from('races').select('id').eq('penca_id', penca.id).eq('seq', 14).single();

    // Get all entries for this race
    const { data: entries } = await supabase
        .from('race_entries')
        .select('id, program_number')
        .eq('race_id', race.id)
        .order('program_number', { ascending: true });

    console.log('--- Inscritos Carrera #14 ---');
    entries.forEach(e => {
        console.log(`#${e.program_number}: ${e.id}`);
    });

    const scratchedIds = [entries.find(e => e.program_number === 11).id];
    console.log('\nRetirados detectados: #11 (' + scratchedIds[0] + ')');

    // Logic from Edge Function
    const scratchedIndex = entries.findIndex((e) => e.program_number === 11);
    let currentIndex = (scratchedIndex + 1) % entries.length;
    let substituteEntry = entries[currentIndex];

    console.log('\nSustituto calculado: #' + substituteEntry.program_number + ' (' + substituteEntry.id + ')');
}

check();
