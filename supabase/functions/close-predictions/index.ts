import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ClosePredictionsRequest {
  race_id: string
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

    const body: ClosePredictionsRequest = await req.json()

    // Get race and check admin permissions
    const { data: race, error: raceError } = await supabaseClient
      .from('races')
      .select('penca_id, status')
      .eq('id', body.race_id)
      .single()

    if (raceError || !race) {
      throw new Error('Race not found')
    }

    const { data: isAdmin, error: adminError } = await supabaseClient
      .rpc('is_penca_admin', { penca_id_param: race.penca_id, user_id_param: user.id })

    if (adminError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Only penca admins can close predictions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update race status to closed
    const { error: updateRaceError } = await supabaseClient
      .from('races')
      .update({ status: 'closed' })
      .eq('id', body.race_id)

    if (updateRaceError) {
      throw updateRaceError
    }

    // Lock all predictions for this race
    const { error: lockError } = await supabaseClient
      .from('predictions')
      .update({ is_locked: true })
      .eq('race_id', body.race_id)

    if (lockError) {
      throw lockError
    }

    // Add audit log
    await supabaseClient.from('audit_log').insert({
      actor_id: user.id,
      action: 'close_predictions',
      target_table: 'races',
      target_id: body.race_id,
      diff: { status: 'closed' },
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
