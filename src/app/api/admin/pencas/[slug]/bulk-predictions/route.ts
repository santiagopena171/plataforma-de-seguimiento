import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { predictions, dayId } = await request.json();
    
    if (!Array.isArray(predictions) || predictions.length === 0) {
      return NextResponse.json({ error: 'Predictions array is required' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get penca
    const { data: penca } = await supabaseAdmin
      .from('pencas')
      .select('id')
      .eq('slug', params.slug)
      .single();

    if (!penca) {
      return NextResponse.json({ error: 'Penca not found' }, { status: 404 });
    }

    // FASE 1: Identificar y crear miembros únicos que faltan
    const uniqueMemberNames = new Set<string>();
    const memberIdMap = new Map<string, string>(); // memberName -> memberId

    // Recopilar nombres únicos que necesitan ser creados
    for (const pred of predictions) {
      const { memberId, memberName } = pred;
      if (!memberId && memberName) {
        uniqueMemberNames.add(memberName.trim());
      }
    }

    console.log(`\n=== FASE 1: Crear miembros ===`);
    console.log(`Miembros únicos a crear: ${uniqueMemberNames.size}`);

    let createdCount = 0;
    for (const memberName of uniqueMemberNames) {
      console.log(`Creating guest member: ${memberName}`);
      
      const { data: newMembership, error: membershipError } = await supabaseAdmin
        .from('memberships')
        .insert({
          penca_id: penca.id,
          user_id: null, // Guest member
          guest_name: memberName,
          role: 'player',
        })
        .select()
        .single();

      if (membershipError) {
        console.error(`  ✗ Error creating membership:`, membershipError);
      } else {
        memberIdMap.set(memberName, newMembership.id);
        createdCount++;
        console.log(`  ✓ Created with ID: ${newMembership.id}`);
      }
    }

    console.log(`\n=== FASE 2: Asignar predicciones ===`);
    
    // Process predictions
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
      created: createdCount,
    };

    for (const pred of predictions) {
      let { memberId, raceId, prediction, memberName, raceSeq } = pred;

      console.log(`Processing: ${memberName} - Race ${raceSeq} - Horse ${prediction}`);

      // Si no hay memberId, buscar en el mapa de miembros recién creados
      if (!memberId && memberName) {
        memberId = memberIdMap.get(memberName.trim());
      }

      console.log(`  memberId: ${memberId}, raceId: ${raceId}`);

      if (!memberId || !raceId) {
        results.failed++;
        results.errors.push(`Skipped: ${memberName} - Race ${raceSeq} (no match found - memberId: ${memberId}, raceId: ${raceId})`);
        console.log(`  ✗ Skipped - no match`);
        continue;
      }

      // Get the race_entry UUID for the predicted horse number
      const { data: entry } = await supabaseAdmin
        .from('race_entries')
        .select('id')
        .eq('race_id', raceId)
        .eq('program_number', prediction)
        .single();

      if (!entry) {
        results.failed++;
        results.errors.push(`Error: ${pred.memberName} - Race ${pred.raceSeq}: Horse #${prediction} not found`);
        continue;
      }

      // Check if prediction already exists
      const { data: existing } = await supabaseAdmin
        .from('predictions')
        .select('id')
        .eq('membership_id', memberId)
        .eq('race_id', raceId)
        .maybeSingle();

      let error;
      if (existing) {
        // Update existing prediction
        const { error: updateError } = await supabaseAdmin
          .from('predictions')
          .update({
            winner_pick: entry.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        error = updateError;
      } else {
        // Insert new prediction
        const { data: inserted, error: insertError } = await supabaseAdmin
          .from('predictions')
          .insert({
            membership_id: memberId,
            race_id: raceId,
            winner_pick: entry.id,
          })
          .select();
        error = insertError;
        
        if (!error && inserted) {
          console.log(`  ✓ Inserted with ID: ${inserted[0].id}`);
        }
      }

      if (error) {
        results.failed++;
        results.errors.push(`Error: ${memberName} - Race ${raceSeq}: ${error.message}`);
        console.log(`  ✗ Error:`, error);
      } else {
        results.success++;
        console.log(`  ✓ Success`);
      }
    }

    console.log(`\nFinal results: ${results.success} success, ${results.failed} failed, ${results.created} members created`);

    return NextResponse.json({ 
      message: `Uploaded ${results.success} predictions, ${results.failed} failed, ${results.created} members created`,
      results,
    });
  } catch (error) {
    console.error('Bulk predictions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
