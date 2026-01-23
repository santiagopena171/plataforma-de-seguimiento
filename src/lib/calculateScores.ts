export async function calculateScores(
  supabaseClient: any,
  pencaId: string,
  raceId: string,
  officialOrder: string[],
  firstPlaceTie: boolean = false,
  bonusWinnerPoints: number = 0
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

  // Pre-calculate winner counts to determine exclusive winners
  const winnerCounts: Record<string, number> = {}
  const placeWinnerCounts: Record<string, number> = {}

  // Always calculate counts if we have predictions
  for (const prediction of predictions) {
    // For Winner Modality
    if (prediction.winner_pick) {
      winnerCounts[prediction.winner_pick] = (winnerCounts[prediction.winner_pick] || 0) + 1
    }

    // For Place Modality: count how many people picked the winner in their set of picks
    if (modalities.includes('place') || modalities.includes('top3')) {
      const picks = [
        prediction.winner_pick,
        ...(prediction.exacta_pick || []),
        ...(prediction.trifecta_pick || []),
      ].filter((p: any, i: number, arr: any[]) => p && arr.indexOf(p) === i)

      if (picks.includes(officialOrder[0])) {
        placeWinnerCounts[officialOrder[0]] = (placeWinnerCounts[officialOrder[0]] || 0) + 1
      }
    }
  }

  for (const prediction of predictions) {
    let totalPoints = 0
    const breakdown: any = {}

    if (modalities.includes('winner') && prediction.winner_pick) {
      // Cuando hay empate en primer lugar, tanto officialOrder[0] como [1] son ganadores
      const isWinner = firstPlaceTie 
        ? (prediction.winner_pick === officialOrder[0] || prediction.winner_pick === officialOrder[1])
        : (prediction.winner_pick === officialOrder[0]);

      if (isWinner) {
        // Si hay empate, ambos ganadores obtienen puntos de primer lugar
        // Check if this is an exclusive winner (only 1 person picked it)
        const isExclusiveWinner = winnerCounts[prediction.winner_pick] === 1
        let points = isExclusiveWinner ? ruleset.exclusive_winner_points : pointsTop3.first
        
        // Agregar bonus si el jugador acertó el ganador real (no empate secundario)
        if (prediction.winner_pick === officialOrder[0] && bonusWinnerPoints > 0) {
          points += bonusWinnerPoints
        }

        breakdown.winner = points
        totalPoints += points
      } else {
        breakdown.winner = 0
      }
    }

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

    if (modalities.includes('place') || modalities.includes('top3')) {
      breakdown.place = []
      const picks = [
        prediction.winner_pick,
        ...(prediction.exacta_pick || []),
        ...(prediction.trifecta_pick || []),
      ].filter((p: any, i: number, arr: any[]) => p && arr.indexOf(p) === i)

      for (const pick of picks) {
        if (firstPlaceTie) {
          // Con empate: posiciones 0 y 1 reciben puntos de primero, posición 2 es tercero, posición 3 es cuarto
          if (pick === officialOrder[0] || pick === officialOrder[1]) {
            // Ambos son ganadores
            const isExclusiveWinner = placeWinnerCounts[pick] === 1
            let points = isExclusiveWinner ? ruleset.exclusive_winner_points : pointsTop3.first
            
            // Agregar bonus solo al primer lugar real
            if (pick === officialOrder[0] && bonusWinnerPoints > 0) {
              points += bonusWinnerPoints
            }
            
            breakdown.place.push(points)
            totalPoints += points
          } else if (pick === officialOrder[2]) {
            // Este es el tercero real (no hay segundo)
            breakdown.place.push(pointsTop3.third)
            totalPoints += pointsTop3.third
          } else if (officialOrder[3] && pick === officialOrder[3]) {
            // Este es el cuarto
            breakdown.place.push(pointsTop3.fourth || 0)
            totalPoints += pointsTop3.fourth || 0
          } else {
            breakdown.place.push(0)
          }
        } else {
          // Sin empate: lógica normal
          if (pick === officialOrder[0]) {
            // Check if this is an exclusive winner (only 1 person picked it in place mode)
            const isExclusiveWinner = placeWinnerCounts[officialOrder[0]] === 1
            let points = isExclusiveWinner ? ruleset.exclusive_winner_points : pointsTop3.first
            
            // Agregar bonus al ganador
            if (bonusWinnerPoints > 0) {
              points += bonusWinnerPoints
            }

            breakdown.place.push(points)
            totalPoints += points
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

    // Persist scores: prefer updating existing row by membership_id (for guests) or user_id.
    // Using update-then-insert avoids creating duplicates when user_id is NULL (unique constraints allow multiple NULLs).
    const scoreRow = {
      penca_id: pencaId,
      race_id: raceId,
      user_id: prediction.user_id,
      membership_id: prediction.membership_id || null,
      points_total: totalPoints,
      breakdown,
    };

    if (prediction.membership_id) {
      const { data: updated, error: updateError } = await supabaseClient
        .from('scores')
        .update(scoreRow)
        .eq('race_id', raceId)
        .eq('membership_id', prediction.membership_id)
        .select();

      if (updateError) {
        // try insert as fallback
        await supabaseClient.from('scores').insert(scoreRow);
      } else if (!updated || updated.length === 0) {
        await supabaseClient.from('scores').insert(scoreRow);
      }
    } else {
      // fallback to user_id-based matching
      const { data: updated, error: updateError } = await supabaseClient
        .from('scores')
        .update(scoreRow)
        .eq('race_id', raceId)
        .eq('user_id', prediction.user_id)
        .select();

      if (updateError) {
        await supabaseClient.from('scores').insert(scoreRow);
      } else if (!updated || updated.length === 0) {
        await supabaseClient.from('scores').insert(scoreRow);
      }
    }
  }
}

export default calculateScores
