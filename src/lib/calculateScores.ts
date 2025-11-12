export async function calculateScores(
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

    if (modalities.includes('place') || modalities.includes('top3')) {
      breakdown.place = []
      const picks = [
        prediction.winner_pick,
        ...(prediction.exacta_pick || []),
        ...(prediction.trifecta_pick || []),
      ].filter((p: any, i: number, arr: any[]) => p && arr.indexOf(p) === i)

      for (const pick of picks) {
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
          breakdown.place.push(pointsTop3.fourth || 0)
          totalPoints += pointsTop3.fourth || 0
        } else {
          breakdown.place.push(0)
        }
      }
    }

    // Use upsert to preserve compatibility, but the DB unique key is (race_id, user_id)
    await supabaseClient.from('scores').upsert({
      penca_id: pencaId,
      race_id: raceId,
      user_id: prediction.user_id,
      membership_id: prediction.membership_id || null,
      points_total: totalPoints,
      breakdown,
    }, {
      onConflict: 'race_id,user_id'
    })
  }
}

export default calculateScores
