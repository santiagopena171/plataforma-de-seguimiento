import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RaceInput {
  seq: number
  venue: string
  distance_m: number
  track_condition?: string
  start_at: string
  entries?: Array<{
    program_number: number
    horse_name: string
    jockey?: string
    trainer?: string
    stud?: string
    notes?: string
  }>
}

interface AddRaceBatchRequest {
  penca_id: string
  races: RaceInput[]
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

    const body: AddRaceBatchRequest = await req.json()

    // Check if user is admin of the penca
    const { data: isAdmin, error: adminError } = await supabaseClient
      .rpc('is_penca_admin', { penca_id_param: body.penca_id, user_id_param: user.id })

    if (adminError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Only penca admins can add races' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const insertedRaces = []

    // Insert races
    for (const raceInput of body.races) {
      const { data: race, error: raceError } = await supabaseClient
        .from('races')
        .insert({
          penca_id: body.penca_id,
          seq: raceInput.seq,
          venue: raceInput.venue,
          distance_m: raceInput.distance_m,
          track_condition: raceInput.track_condition,
          start_at: raceInput.start_at,
          status: 'scheduled',
        })
        .select()
        .single()

      if (raceError) {
        throw raceError
      }

      insertedRaces.push(race)

      // Insert entries if provided
      if (raceInput.entries && raceInput.entries.length > 0) {
        const entriesToInsert = raceInput.entries.map(entry => ({
          race_id: race.id,
          ...entry,
        }))

        const { error: entriesError } = await supabaseClient
          .from('race_entries')
          .insert(entriesToInsert)

        if (entriesError) {
          throw entriesError
        }
      }
    }

    // Add audit log
    await supabaseClient.from('audit_log').insert({
      actor_id: user.id,
      action: 'add_races',
      target_table: 'races',
      target_id: body.penca_id,
      diff: { races_count: body.races.length },
    })

    return new Response(
      JSON.stringify({ races: insertedRaces }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
