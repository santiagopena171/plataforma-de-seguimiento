import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // 1. Buscar la penca
    const { data: penca } = await supabase
      .from('pencas')
      .select('id, name, slug')
      .ilike('slug', '%mensual-maronas%')
      .single();

    if (!penca) {
      return NextResponse.json({ error: 'Penca no encontrada' }, { status: 404 });
    }

    // 2. Obtener las carreras 82 a 93
    const { data: races } = await supabase
      .from('races')
      .select('id, name, seq, race_date, status, official_result')
      .eq('penca_id', penca.id)
      .gte('seq', 82)
      .lte('seq', 93)
      .order('seq', { ascending: true });

    if (!races || races.length === 0) {
      return NextResponse.json({ error: 'No se encontraron carreras' }, { status: 404 });
    }

    const raceIds = races.map(r => r.id);

    // 3. Obtener todos los memberships
    const { data: memberships } = await supabase
      .from('memberships')
      .select('id, user_id, guest_name, profiles(display_name)')
      .eq('penca_id', penca.id);

    // 4. Obtener todos los scores de esas carreras
    const { data: allScores } = await supabase
      .from('scores')
      .select('*')
      .in('race_id', raceIds)
      .eq('penca_id', penca.id);

    // 5. Agrupar scores por miembro
    const memberScores: Record<string, any> = {};
    
    (memberships || []).forEach((member: any) => {
      const name = member.profiles?.display_name || member.guest_name || 'Sin nombre';
      memberScores[member.id] = {
        name,
        membership_id: member.id,
        user_id: member.user_id,
        scores: {},
        total: 0
      };
    });

    // Asignar scores a cada miembro
    (allScores || []).forEach((score: any) => {
      const membershipId = score.membership_id;
      const userId = score.user_id;

      // Buscar por membership_id primero
      if (membershipId && memberScores[membershipId]) {
        const race = races.find(r => r.id === score.race_id);
        if (race) {
          memberScores[membershipId].scores[race.seq] = {
            points: score.points_total || 0,
            breakdown: score.breakdown
          };
          memberScores[membershipId].total += score.points_total || 0;
        }
      } else if (userId) {
        // Buscar membership por user_id
        const member = memberships?.find((m: any) => m.user_id === userId);
        if (member && memberScores[member.id]) {
          const race = races.find(r => r.id === score.race_id);
          if (race) {
            memberScores[member.id].scores[race.seq] = {
              points: score.points_total || 0,
              breakdown: score.breakdown
            };
            memberScores[member.id].total += score.points_total || 0;
          }
        }
      }
    });

    // 6. Ordenar por total descendente
    const sortedMembers = Object.values(memberScores)
      .sort((a: any, b: any) => b.total - a.total);

    return NextResponse.json({
      penca: {
        id: penca.id,
        name: penca.name,
        slug: penca.slug
      },
      races: races.map(r => ({
        seq: r.seq,
        name: r.name,
        date: r.race_date,
        status: r.status,
        hasResult: !!r.official_result
      })),
      members: sortedMembers,
      stats: {
        totalMembers: sortedMembers.length,
        totalRaces: races.length,
        totalScores: allScores?.length || 0,
        membersWithoutScores: sortedMembers.filter((m: any) => m.total === 0).length
      }
    });

  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
