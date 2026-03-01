// @ts-ignore
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PublishResultRequest {
  race_id: string
  official_order: string[] // [entry_id_1, entry_id_2, entry_id_3, entry_id_4]
  notes?: string
  first_place_tie?: boolean
  scratched_entries?: string[] // entries that didn't run
  winner_dividend?: number // payout for 1st place
}
serve(async (req: any) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let pubBy: any = 'not_started';

  try {
    // @ts-ignore
    const Deno = globalThis.Deno || { env: { get: () => '' } };

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const token = authHeader.replace('Bearer ', '').trim()
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    // Reconocer Service Role de forma fiable: comparación directa con la key de la función
    // (el JWT del Service Role a veces no tiene role==='service_role' en todos los entornos)
    const isServiceRoleByKey = !!serviceRoleKey && token.length > 0 && token === serviceRoleKey
    const decodedPayload = parseJwt(token)
    const isServiceRoleByJwt = !!decodedPayload && decodedPayload.role === 'service_role'
    const isServiceRole = isServiceRoleByKey || isServiceRoleByJwt

    let userId = null;

    if (!isServiceRole) {
      const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)

      if (userError || !user) {
        throw new Error('Unauthorized')
      }
      userId = user.id;
    }

    const body: PublishResultRequest = await req.json()
    if (isServiceRole) {
      // Fetch a valid admin ID dynamically to avoid hardcoding issues
      const { data: admins } = await supabaseClient.from('profiles').select('id').eq('role', 'admin').limit(1);
      if (admins && admins.length > 0) {
        pubBy = admins[0].id;
      } else {
        throw new Error('No administrator found in the system for automation');
      }
    } else {
      pubBy = userId;
    }

    // Get race and check admin permissions
    const { data: race, error: raceError } = await supabaseClient
      .from('races')
      .select('penca_id, status')
      .eq('id', body.race_id)
      .single()

    if (raceError || !race) {
      throw new Error('Race not found')
    }

    if (!isServiceRole) {
      const { data: isAdmin } = await supabaseClient
        .rpc('is_penca_admin', { penca_id_param: race.penca_id, user_id_param: userId })

      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Only penca admins can publish results' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Insert or update result
    const { error: resultError } = await supabaseClient
      .from('race_results')
      .upsert({
        race_id: body.race_id,
        official_order: body.official_order,
        first_place_tie: body.first_place_tie || false,
        notes: body.notes,
        published_by: pubBy,
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
    await calculateScores(
      supabaseClient,
      race.penca_id,
      body.race_id,
      body.official_order,
      body.first_place_tie || false,
      body.scratched_entries || [],
      body.winner_dividend || 0
    )

    // Add audit log
    await supabaseClient.from('audit_log').insert({
      actor_id: pubBy,
      action: 'publish_result',
      target_table: 'race_results',
      target_id: body.race_id,
      diff: {
        official_order: body.official_order,
        scratched_entries: body.scratched_entries,
        winner_dividend: body.winner_dividend
      },
    })

    return new Response(
      JSON.stringify({ success: true, race_id: body.race_id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function parseJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

async function calculateScores(
  supabaseClient: any,
  pencaId: string,
  raceId: string,
  officialOrder: string[],
  firstPlaceTie: boolean = false,
  scratchedEntries: string[] = [],
  winnerDividend: number = 0
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

  // Get race entries to handle scratched entries replacement (cycle to next program_number)
  const { data: allEntries } = await supabaseClient
    .from('race_entries')
    .select('id, program_number')
    .eq('race_id', raceId)
    .order('program_number', { ascending: true })

  // Detect the real number of horses in this race by finding the max program_number
  // among entries that actually participated (appear in official_order or scratched list).
  // Races may have 15 placeholder entries in the DB but only 10 real horses — cycling
  // must wrap within the real field only (e.g. if #10 is scratched → cycle to #1, not #11).
  const realEntryIds = new Set([...officialOrder, ...scratchedEntries]);
  const realMaxProgramNumber = allEntries
    ? allEntries
        .filter((e: any) => realEntryIds.has(e.id))
        .reduce((max: number, e: any) => Math.max(max, e.program_number), 0)
    : 0;

  // Only use entries within the real field for the substitution cycle
  const entries = allEntries
    ? (realMaxProgramNumber > 0
        ? allEntries.filter((e: any) => e.program_number <= realMaxProgramNumber)
        : allEntries)
    : [];

  const getActiveEntry = (entryId: string) => {
    if (!entryId || !scratchedEntries.includes(entryId) || !entries || entries.length === 0) return entryId;

    const scratchedIndex = entries.findIndex((e: any) => e.id === entryId);
    if (scratchedIndex === -1) return entryId;

    let currentIndex = (scratchedIndex + 1) % entries.length;
    let fallbackEntryId = entries[currentIndex].id;
    let loopGuard = 0;

    while (scratchedEntries.includes(fallbackEntryId) && loopGuard < entries.length) {
      currentIndex = (currentIndex + 1) % entries.length;
      fallbackEntryId = entries[currentIndex].id;
      loopGuard++;
    }

    return fallbackEntryId;
  };

  const processedPredictions = predictions.map((p: any) => ({
    ...p,
    resolved_winner_pick: p.winner_pick ? getActiveEntry(p.winner_pick) : null,
    resolved_exacta_pick: p.exacta_pick ? p.exacta_pick.map((e: string) => getActiveEntry(e)) : null,
    resolved_trifecta_pick: p.trifecta_pick ? p.trifecta_pick.map((e: string) => getActiveEntry(e)) : null,
  }));

  const pointsTop3 = ruleset.points_top3

  // Normalize modality names (support Spanish names like 'lugar', 'ganador')
  const rawModalities: any[] = ruleset.modalities_enabled || []
  const modalities: string[] = rawModalities.map((m: any) => {
    if (!m) return m
    const mm = m.toString().toLowerCase()
    if (mm === 'lugar' || mm === 'place') return 'place'
    if (mm === 'ganador' || mm === 'winner') return 'winner'
    if (mm === 'top3' || mm === 'top_3' || mm === 'top-three') return 'top3'
    if (mm === 'exacta') return 'exacta'
    if (mm === 'trifecta') return 'trifecta'
    return mm
  })

  // Step 1: Pre-calculate who got the winner to handle exclusive & batacazo
  let exactWinnerGuesserCount = 0;
  for (const p of processedPredictions) {
    const picks = [
      p.resolved_winner_pick,
      ...(p.resolved_exacta_pick || []),
      ...(p.resolved_trifecta_pick || []),
    ].filter((val: any, i: any, arr: any) => val && arr.indexOf(val) === i)

    const guessedWinner = firstPlaceTie
      ? (picks.includes(officialOrder[0]) || picks.includes(officialOrder[1]))
      : picks.includes(officialOrder[0]);

    if (guessedWinner) exactWinnerGuesserCount++;
  }

  const isExclusive = exactWinnerGuesserCount === 1;
  let firstPlacePoints = pointsTop3.first;
  let batacazoApplied = false;

  if (isExclusive && (ruleset.exclusive_winner_points || pointsTop3.exclusive_winner)) {
    firstPlacePoints = ruleset.exclusive_winner_points || pointsTop3.exclusive_winner;
  } else if (!isExclusive && winnerDividend >= 8) {
    firstPlacePoints += 7; // Batacazo
    batacazoApplied = true;
  }

  // Calculate scores for each prediction
  for (const prediction of processedPredictions) {
    let totalPoints = 0
    const breakdown: any = {}
    if (batacazoApplied && prediction.resolved_winner_pick) {
      breakdown.batacazo = true;
    }

    // Winner points
    if (modalities.includes('winner') && prediction.resolved_winner_pick) {
      const isWinner = firstPlaceTie
        ? (prediction.resolved_winner_pick === officialOrder[0] || prediction.resolved_winner_pick === officialOrder[1])
        : (prediction.resolved_winner_pick === officialOrder[0]);

      if (isWinner) {
        breakdown.winner = firstPlacePoints
        totalPoints += firstPlacePoints
      } else {
        breakdown.winner = 0
        delete breakdown.batacazo;
      }
    }

    // Exacta points
    if (modalities.includes('exacta') && prediction.resolved_exacta_pick) {
      const exactaPick = prediction.resolved_exacta_pick
      if (firstPlaceTie) {
        breakdown.exacta = 0
      } else {
        if (
          exactaPick.length === 2 &&
          exactaPick[0] === officialOrder[0] &&
          exactaPick[1] === officialOrder[1]
        ) {
          breakdown.exacta = firstPlacePoints + pointsTop3.second
          totalPoints += firstPlacePoints + pointsTop3.second
        } else {
          breakdown.exacta = 0
        }
      }
    }

    // Trifecta points
    if (modalities.includes('trifecta') && prediction.resolved_trifecta_pick) {
      const trifectaPick = prediction.resolved_trifecta_pick
      if (firstPlaceTie) {
        breakdown.trifecta = 0
      } else {
        if (
          trifectaPick.length === 3 &&
          trifectaPick[0] === officialOrder[0] &&
          trifectaPick[1] === officialOrder[1] &&
          trifectaPick[2] === officialOrder[2]
        ) {
          breakdown.trifecta = firstPlacePoints + pointsTop3.second + pointsTop3.third
          totalPoints += firstPlacePoints + pointsTop3.second + pointsTop3.third
        } else {
          breakdown.trifecta = 0
        }
      }
    }

    // Place points (Top 4)
    if (modalities.includes('place') || modalities.includes('top3')) {
      breakdown.place = []
      const picks = [
        prediction.resolved_winner_pick,
        ...(prediction.resolved_exacta_pick || []),
        ...(prediction.resolved_trifecta_pick || []),
      ].filter((p: any, i: any, arr: any) => p && arr.indexOf(p) === i)

      for (const pick of picks) {
        if (firstPlaceTie) {
          if (pick === officialOrder[0] || pick === officialOrder[1]) {
            breakdown.place.push(firstPlacePoints)
            totalPoints += firstPlacePoints
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
          // No tie
          if (pick === officialOrder[0]) {
            breakdown.place.push(firstPlacePoints)
            totalPoints += firstPlacePoints
          } else if (pick === officialOrder[1]) {
            breakdown.place.push(pointsTop3.second)
            totalPoints += pointsTop3.second
          } else if (pick === officialOrder[2]) {
            breakdown.place.push(pointsTop3.third)
            totalPoints += pointsTop3.third
          } else if (officialOrder[3] && pick === officialOrder[3]) {
            breakdown.place.push(pointsTop3.fourth || 0)
            totalPoints += pointsTop3.fourth || 0
          } else {
            breakdown.place.push(0)
          }
        }
      }
    }

    // Prevent duplicates by deleting existing score for this race/member combination
    if (prediction.membership_id) {
      await supabaseClient.from('scores').delete().eq('race_id', raceId).eq('membership_id', prediction.membership_id);
    } else if (prediction.user_id) {
      await supabaseClient.from('scores').delete().eq('race_id', raceId).eq('user_id', prediction.user_id);
    }

    // Upsert score
    const { error: scoreError } = await supabaseClient.from('scores').upsert({
      penca_id: pencaId,
      race_id: raceId,
      user_id: prediction.user_id,
      membership_id: prediction.membership_id,
      points_total: totalPoints,
      breakdown,
    })

    if (scoreError) {
      console.error(`Error saving score for prediction ${prediction.id}:`, scoreError);
    }
  }
}
