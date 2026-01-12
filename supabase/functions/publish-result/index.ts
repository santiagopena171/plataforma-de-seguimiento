import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PublishResultRequest {
  race_id: string
  official_order: string[] // [entry_id_1, entry_id_2, entry_id_3]
  notes?: string
  first_place_tie?: boolean
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)

    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    const body: PublishResultRequest = await req.json()

    // Get race and check admin permissions
    const { data: race, error: raceError } = await supabaseClient
      .from('races')
      .select('penca_id, status')
      .eq('id', body.race_id)
      .single()

    if (raceError || !race) {
      throw new Error('Race not found')
    }

    const { data: isAdmin } = await supabaseClient
      .rpc('is_penca_admin', { penca_id_param: race.penca_id, user_id_param: user.id })

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Only penca admins can publish results' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Insert or update result
    const { error: resultError } = await supabaseClient
      .from('race_results')
      .upsert({
        race_id: body.race_id,
        official_order: body.official_order,
        first_place_tie: body.first_place_tie || false,
        notes: body.notes,
        published_by: user.id,
        published_at: new Date().toISOString(),
      })

    if (resultError) {
      throw resultError
    }

    // Update race status
    await supabaseClient
      .from('races')
      .update({ status: 'result_published' })
      .eq('id', body.race_id)

    // Calculate scores
    await calculateScores(supabaseClient, race.penca_id, body.race_id, body.official_order, body.first_place_tie || false)

    // Add audit log
    await supabaseClient.from('audit_log').insert({
      actor_id: user.id,
      action: 'publish_result',
      target_table: 'race_results',
      target_id: body.race_id,
      diff: { official_order: body.official_order },
    })

    return new Response(
      JSON.stringify({ success: true, race_id: body.race_id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function calculateScores(
  supabaseClient: any,
  pencaId: string,
  raceId: string,
  officialOrder: string[],
  firstPlaceTie: boolean = false
) {
  // Get active ruleset
  const { data: ruleset } = await supabaseClient
    .from('rulesets')
    .select('*')
    .eq('penca_id', pencaId)
    .eq('is_active', true)
    .single()

  if (!ruleset) {
    throw new Error('No active ruleset found')
  }

  // Get all predictions for this race
  const { data: predictions } = await supabaseClient
    .from('predictions')
    .select('*')
    .eq('race_id', raceId)

  if (!predictions || predictions.length === 0) {
    return
  }

  const pointsTop3 = ruleset.points_top3
  const modalities = ruleset.modalities_enabled

  // Calculate scores for each prediction
  for (const prediction of predictions) {
    let totalPoints = 0
    const breakdown: any = {}

    // Winner points
    if (modalities.includes('winner') && prediction.winner_pick) {
      const isWinner = firstPlaceTie 
        ? (prediction.winner_pick === officialOrder[0] || prediction.winner_pick === officialOrder[1])
        : (prediction.winner_pick === officialOrder[0]);

      if (isWinner) {
        breakdown.winner = pointsTop3.first
        totalPoints += pointsTop3.first
      } else {
        breakdown.winner = 0
      }
    }

    // Exacta points (first two in correct order)
    if (modalities.includes('exacta') && prediction.exacta_pick) {
      const exactaPick = prediction.exacta_pick
      
      // Con empate, no se puede acertar exacta tradicional
      if (firstPlaceTie) {
        breakdown.exacta = 0
      } else {
        if (
          exactaPick.length === 2 &&
          exactaPick[0] === officialOrder[0] &&
          exactaPick[1] === officialOrder[1]
        ) {
          breakdown.exacta = pointsTop3.first + pointsTop3.second
          totalPoints += pointsTop3.first + pointsTop3.second
        } else {
          breakdown.exacta = 0
        }
      }
    }

    // Trifecta points (first three in correct order)
    if (modalities.includes('trifecta') && prediction.trifecta_pick) {
      const trifectaPick = prediction.trifecta_pick
      
      // Con empate, no se puede acertar trifecta tradicional
      if (firstPlaceTie) {
        breakdown.trifecta = 0
      } else {
        if (
          trifectaPick.length === 3 &&
          trifectaPick[0] === officialOrder[0] &&
          trifectaPick[1] === officialOrder[1] &&
          trifectaPick[2] === officialOrder[2]
        ) {
          breakdown.trifecta = pointsTop3.first + pointsTop3.second + pointsTop3.third
          totalPoints += pointsTop3.first + pointsTop3.second + pointsTop3.third
        } else {
          breakdown.trifecta = 0
        }
      }
    }

    // Place points (Top 4) — award points depending on finishing position of picked horses
    // Support legacy 'top3' flag too for backwards compatibility
    if (modalities.includes('place') || modalities.includes('top3')) {
      breakdown.place = []
      const picks = [
        prediction.winner_pick,
        ...(prediction.exacta_pick || []),
        ...(prediction.trifecta_pick || []),
      ].filter((p, i, arr) => p && arr.indexOf(p) === i) // unique picks

      for (const pick of picks) {
        if (firstPlaceTie) {
          // Con empate: posiciones 0 y 1 reciben puntos de primero, posición 2 es tercero, posición 3 es cuarto
          if (pick === officialOrder[0] || pick === officialOrder[1]) {
            breakdown.place.push(pointsTop3.first)
            totalPoints += pointsTop3.first
          } else if (pick === officialOrder[2]) {
            breakdown.place.push(pointsTop3.third)
            totalPoints += pointsTop3.third
          } else if (officialOrder[3] && pick === officialOrder[3]) {
            breakdown.place.push(pointsTop3.fourth || 0)
            totalPoints += pointsTop3.fourth || 0
          } else {
            breakdown.place.push(0)
          }
        } else {
          // Sin empate: lógica normal
          if (pick === officialOrder[0]) {
            breakdown.place.push(pointsTop3.first)
            totalPoints += pointsTop3.first
          } else if (pick === officialOrder[1]) {
            breakdown.place.push(pointsTop3.second)
            totalPoints += pointsTop3.second
          } else if (pick === officialOrder[2]) {
            breakdown.place.push(pointsTop3.third)
            totalPoints += pointsTop3.third
          } else if (officialOrder[3] && pick === officialOrder[3]) {
            // fourth place (if ruleset defines it)
            breakdown.place.push(pointsTop3.fourth || 0)
            totalPoints += pointsTop3.fourth || 0
          } else {
            breakdown.place.push(0)
          }
        }
      }
    }

    // Upsert score
    await supabaseClient.from('scores').upsert({
      penca_id: pencaId,
      race_id: raceId,
      user_id: prediction.user_id,
      points_total: totalPoints,
      breakdown,
    })
  }
}
