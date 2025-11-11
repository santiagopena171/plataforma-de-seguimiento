import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RecalculateScoresRequest {
  penca_id?: string
  race_id?: string
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

    const body: RecalculateScoresRequest = await req.json()

    let racesToRecalculate = []

    if (body.race_id) {
      // Recalculate single race
      const { data: race } = await supabaseClient
        .from('races')
        .select('*')
        .eq('id', body.race_id)
        .single()

      if (!race) {
        throw new Error('Race not found')
      }

      // Check admin
      const { data: isAdmin } = await supabaseClient
        .rpc('is_penca_admin', { penca_id_param: race.penca_id, user_id_param: user.id })

      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Only penca admins can recalculate scores' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      racesToRecalculate = [race]
    } else if (body.penca_id) {
      // Recalculate all races in penca
      const { data: isAdmin } = await supabaseClient
        .rpc('is_penca_admin', { penca_id_param: body.penca_id, user_id_param: user.id })

      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Only penca admins can recalculate scores' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: races } = await supabaseClient
        .from('races')
        .select('*')
        .eq('penca_id', body.penca_id)
        .eq('status', 'result_published')

      racesToRecalculate = races || []
    } else {
      throw new Error('Either race_id or penca_id must be provided')
    }

    let recalculatedCount = 0

    for (const race of racesToRecalculate) {
      // Get result
      const { data: result } = await supabaseClient
        .from('race_results')
        .select('official_order')
        .eq('race_id', race.id)
        .single()

      if (!result) {
        continue
      }

      // Delete existing scores
      await supabaseClient.from('scores').delete().eq('race_id', race.id)

      // Recalculate
      await calculateScores(
        supabaseClient,
        race.penca_id,
        race.id,
        result.official_order
      )

      recalculatedCount++
    }

    // Add audit log
    await supabaseClient.from('audit_log').insert({
      actor_id: user.id,
      action: 'recalculate_scores',
      target_table: 'scores',
      target_id: body.penca_id || body.race_id,
      diff: { races_count: recalculatedCount },
    })

    return new Response(
      JSON.stringify({ success: true, recalculated_count: recalculatedCount }),
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
  officialOrder: string[]
) {
  const { data: ruleset } = await supabaseClient
    .from('rulesets')
    .select('*')
    .eq('penca_id', pencaId)
    .eq('is_active', true)
    .single()

  if (!ruleset) {
    throw new Error('No active ruleset found')
  }

  const { data: predictions } = await supabaseClient
    .from('predictions')
    .select('*')
    .eq('race_id', raceId)

  if (!predictions || predictions.length === 0) {
    return
  }

  const pointsTop3 = ruleset.points_top3
  const modalities = ruleset.modalities_enabled

  for (const prediction of predictions) {
    let totalPoints = 0
    const breakdown: any = {}

    if (modalities.includes('winner') && prediction.winner_pick) {
      if (prediction.winner_pick === officialOrder[0]) {
        breakdown.winner = pointsTop3.first
        totalPoints += pointsTop3.first
      } else {
        breakdown.winner = 0
      }
    }

    if (modalities.includes('exacta') && prediction.exacta_pick) {
      const exactaPick = prediction.exacta_pick
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

    if (modalities.includes('trifecta') && prediction.trifecta_pick) {
      const trifectaPick = prediction.trifecta_pick
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

    await supabaseClient.from('scores').insert({
      penca_id: pencaId,
      race_id: raceId,
      user_id: prediction.user_id,
      points_total: totalPoints,
      breakdown,
    })
  }
}
