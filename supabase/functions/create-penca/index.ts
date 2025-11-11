import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreatePencaRequest {
  name: string
  description?: string
  slug: string
  initial_ruleset: {
    points_top3: { first: number; second: number; third: number }
    modalities_enabled: string[]
    tiebreakers_order: string[]
    lock_minutes_before_start: number
    sealed_predictions_until_close: boolean
  }
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

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)

    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || profile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Only admins can create pencas' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body: CreatePencaRequest = await req.json()

    // Validate required fields
    if (!body.name || !body.slug || !body.initial_ruleset) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Start transaction: create penca
    const { data: penca, error: pencaError } = await supabaseClient
      .from('pencas')
      .insert({
        name: body.name,
        description: body.description,
        slug: body.slug,
        status: 'draft',
        created_by: user.id,
      })
      .select()
      .single()

    if (pencaError) {
      throw pencaError
    }

    // Create initial ruleset (version 1)
    const { data: ruleset, error: rulesetError } = await supabaseClient
      .from('rulesets')
      .insert({
        penca_id: penca.id,
        version: 1,
        points_top3: body.initial_ruleset.points_top3,
        modalities_enabled: body.initial_ruleset.modalities_enabled,
        tiebreakers_order: body.initial_ruleset.tiebreakers_order,
        lock_minutes_before_start: body.initial_ruleset.lock_minutes_before_start,
        sealed_predictions_until_close: body.initial_ruleset.sealed_predictions_until_close,
        effective_from_race_seq: 1,
        is_active: true,
      })
      .select()
      .single()

    if (rulesetError) {
      // Rollback: delete penca
      await supabaseClient.from('pencas').delete().eq('id', penca.id)
      throw rulesetError
    }

    // Update penca with active ruleset version
    await supabaseClient
      .from('pencas')
      .update({ rules_version_active: 1 })
      .eq('id', penca.id)

    // Add creator as admin
    const { error: adminError } = await supabaseClient
      .from('penca_admins')
      .insert({
        penca_id: penca.id,
        user_id: user.id,
      })

    if (adminError) {
      // Rollback
      await supabaseClient.from('pencas').delete().eq('id', penca.id)
      throw adminError
    }

    // Add audit log
    await supabaseClient.from('audit_log').insert({
      actor_id: user.id,
      action: 'create_penca',
      target_table: 'pencas',
      target_id: penca.id,
      diff: { name: body.name, slug: body.slug },
    })

    return new Response(
      JSON.stringify({ penca, ruleset }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
