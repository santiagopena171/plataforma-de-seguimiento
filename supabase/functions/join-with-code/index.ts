import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface JoinWithCodeRequest {
  code: string
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

    const body: JoinWithCodeRequest = await req.json()

    // Find invite
    const { data: invite, error: inviteError } = await supabaseClient
      .from('invites')
      .select('*')
      .eq('code', body.code)
      .single()

    if (inviteError || !invite) {
      return new Response(
        JSON.stringify({ error: 'Invalid invite code' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if expired
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Invite code has expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if max uses reached
    if (invite.max_uses && invite.uses >= invite.max_uses) {
      return new Response(
        JSON.stringify({ error: 'Invite code has reached maximum uses' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if already member
    const { data: existingMembership } = await supabaseClient
      .from('memberships')
      .select('*')
      .eq('penca_id', invite.penca_id)
      .eq('user_id', user.id)
      .single()

    if (existingMembership) {
      return new Response(
        JSON.stringify({ error: 'You are already a member of this penca' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create membership
    const { error: membershipError } = await supabaseClient
      .from('memberships')
      .insert({
        penca_id: invite.penca_id,
        user_id: user.id,
        role: 'player',
      })

    if (membershipError) {
      throw membershipError
    }

    // Increment invite uses
    await supabaseClient
      .from('invites')
      .update({ uses: invite.uses + 1 })
      .eq('id', invite.id)

    // Get penca details
    const { data: penca } = await supabaseClient
      .from('pencas')
      .select('*')
      .eq('id', invite.penca_id)
      .single()

    return new Response(
      JSON.stringify({ success: true, penca }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
