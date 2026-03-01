/**
 * recalc_florida_auto.js
 * Recalcula todas las carreras publicadas de florida-automatico con la lógica
 * corregida de retirados: cicla solo dentro de los caballos reales de la carrera
 * (no más allá del mayor nro de programa que efectivamente corrió).
 */
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const raw = fs.readFileSync('.env.local', 'utf8');
const env = {};
raw.split(/\r?\n/).forEach(l => {
  const eq = l.indexOf('=');
  if (eq > 0) env[l.slice(0, eq).trim()] = l.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
});
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

function normalizeModalities(raw) {
  return (raw || []).map(m => {
    if (!m) return m;
    const mm = m.toString().toLowerCase();
    if (mm === 'lugar' || mm === 'place') return 'place';
    if (mm === 'ganador' || mm === 'winner') return 'winner';
    if (mm === 'top3' || mm === 'top_3' || mm === 'top-three') return 'top3';
    if (mm === 'exacta') return 'exacta';
    if (mm === 'trifecta') return 'trifecta';
    return mm;
  });
}

/**
 * Determina el entry activo para un pick, sustituyendo los retirados.
 * Solo cicla dentro de los caballos reales de la carrera (hasta realMaxProgNum).
 */
function getActiveEntry(entryId, scratchedEntries, realEntries) {
  if (!entryId || !scratchedEntries.includes(entryId) || !realEntries.length) return entryId;

  const idx = realEntries.findIndex(e => e.id === entryId);
  if (idx === -1) return entryId;

  let curr = (idx + 1) % realEntries.length;
  let fallback = realEntries[curr].id;
  let guard = 0;
  while (scratchedEntries.includes(fallback) && guard < realEntries.length) {
    curr = (curr + 1) % realEntries.length;
    fallback = realEntries[curr].id;
    guard++;
  }
  return fallback;
}

async function recalcRace(pencaId, raceId, raceSeq, ruleset) {
  const modalities = normalizeModalities(ruleset.modalities_enabled);
  const pointsTop3 = ruleset.points_top3;

  // Resultado
  const { data: result } = await sb.from('race_results')
    .select('official_order, first_place_tie')
    .eq('race_id', raceId)
    .single();
  if (!result) { console.log(`  ⚠️  Sin resultado para carrera #${raceSeq}`); return; }

  const { official_order: officialOrder, first_place_tie: firstPlaceTie } = result;

  // Obtener TODOS los retirados del resultado audit para esta carrera
  // (Los scratched_entries se guardan en el audit_log o en race_results; verificar ambos)
  const { data: auditLog } = await sb.from('audit_log')
    .select('diff')
    .eq('target_id', raceId)
    .eq('action', 'publish_result')
    .order('created_at', { ascending: false })
    .limit(1);

  const scratchedEntries = (auditLog?.[0]?.diff?.scratched_entries) || [];

  // Todas las entradas de la carrera ordenadas por nro de programa
  const { data: allEntries } = await sb.from('race_entries')
    .select('id, program_number, label')
    .eq('race_id', raceId)
    .order('program_number', { ascending: true });

  // Detectar máximo nro de programa real (solo lo que efectivamente participó)
  const realIds = new Set([...officialOrder, ...scratchedEntries]);
  const realMax = allEntries
    .filter(e => realIds.has(e.id))
    .reduce((m, e) => Math.max(m, e.program_number), 0);

  const realEntries = realMax > 0
    ? allEntries.filter(e => e.program_number <= realMax)
    : allEntries;

  const idToNum = {};
  allEntries.forEach(e => idToNum[e.id] = e.program_number);

  console.log(`  Total entries en DB: ${allEntries.length} | Caballos reales detectados: ${realEntries.length} (hasta #${realMax})`);
  if (scratchedEntries.length > 0) {
    console.log(`  Retirados: ${scratchedEntries.map(id => '#' + (idToNum[id] || '?')).join(', ')}`);
  }

  // Predicciones
  const { data: predictions } = await sb.from('predictions').select('*').eq('race_id', raceId);
  if (!predictions || !predictions.length) { console.log(`  ⚠️  Sin predicciones`); return; }

  // Aplicar sustitución de retirados
  const processed = predictions.map(p => ({
    ...p,
    resolved_winner_pick: p.winner_pick ? getActiveEntry(p.winner_pick, scratchedEntries, realEntries) : null,
    resolved_exacta_pick: p.exacta_pick ? p.exacta_pick.map(e => getActiveEntry(e, scratchedEntries, realEntries)) : null,
    resolved_trifecta_pick: p.trifecta_pick ? p.trifecta_pick.map(e => getActiveEntry(e, scratchedEntries, realEntries)) : null,
  }));

  // Contar ganadores únicos
  let winnerCount = 0;
  for (const p of processed) {
    const picks = [p.resolved_winner_pick, ...(p.resolved_exacta_pick||[]), ...(p.resolved_trifecta_pick||[])]
      .filter((v, i, a) => v && a.indexOf(v) === i);
    const won = firstPlaceTie
      ? (picks.includes(officialOrder[0]) || picks.includes(officialOrder[1]))
      : picks.includes(officialOrder[0]);
    if (won) winnerCount++;
  }

  const isExclusive = winnerCount === 1;
  let firstPlacePoints = pointsTop3.first;
  if (isExclusive && ruleset.exclusive_winner_points) {
    firstPlacePoints = ruleset.exclusive_winner_points;
    console.log(`  🏆 Ganador exclusivo → ${firstPlacePoints} pts`);
  }

  let saved = 0;
  for (const prediction of processed) {
    let totalPoints = 0;
    const breakdown = {};

    if (modalities.includes('winner') && prediction.resolved_winner_pick) {
      const isWinner = firstPlaceTie
        ? (prediction.resolved_winner_pick === officialOrder[0] || prediction.resolved_winner_pick === officialOrder[1])
        : prediction.resolved_winner_pick === officialOrder[0];
      breakdown.winner = isWinner ? firstPlacePoints : 0;
      if (isWinner) totalPoints += firstPlacePoints;
    }

    if (modalities.includes('exacta') && prediction.resolved_exacta_pick) {
      if (!firstPlaceTie && prediction.resolved_exacta_pick.length === 2 &&
          prediction.resolved_exacta_pick[0] === officialOrder[0] &&
          prediction.resolved_exacta_pick[1] === officialOrder[1]) {
        breakdown.exacta = firstPlacePoints + pointsTop3.second;
        totalPoints += firstPlacePoints + pointsTop3.second;
      } else { breakdown.exacta = 0; }
    }

    if (modalities.includes('trifecta') && prediction.resolved_trifecta_pick) {
      if (!firstPlaceTie && prediction.resolved_trifecta_pick.length === 3 &&
          prediction.resolved_trifecta_pick[0] === officialOrder[0] &&
          prediction.resolved_trifecta_pick[1] === officialOrder[1] &&
          prediction.resolved_trifecta_pick[2] === officialOrder[2]) {
        breakdown.trifecta = firstPlacePoints + pointsTop3.second + pointsTop3.third;
        totalPoints += firstPlacePoints + pointsTop3.second + pointsTop3.third;
      } else { breakdown.trifecta = 0; }
    }

    if (modalities.includes('place') || modalities.includes('top3')) {
      breakdown.place = [];
      const picks = [prediction.resolved_winner_pick, ...(prediction.resolved_exacta_pick||[]), ...(prediction.resolved_trifecta_pick||[])]
        .filter((v, i, a) => v && a.indexOf(v) === i);

      for (const pick of picks) {
        if (firstPlaceTie) {
          if (pick === officialOrder[0] || pick === officialOrder[1]) { breakdown.place.push(firstPlacePoints); totalPoints += firstPlacePoints; }
          else if (pick === officialOrder[2]) { breakdown.place.push(pointsTop3.third); totalPoints += pointsTop3.third; }
          else if (officialOrder[3] && pick === officialOrder[3]) { breakdown.place.push(pointsTop3.fourth||0); totalPoints += pointsTop3.fourth||0; }
          else { breakdown.place.push(0); }
        } else {
          if (pick === officialOrder[0]) { breakdown.place.push(firstPlacePoints); totalPoints += firstPlacePoints; }
          else if (pick === officialOrder[1]) { breakdown.place.push(pointsTop3.second); totalPoints += pointsTop3.second; }
          else if (pick === officialOrder[2]) { breakdown.place.push(pointsTop3.third); totalPoints += pointsTop3.third; }
          else if (officialOrder[3] && pick === officialOrder[3]) { breakdown.place.push(pointsTop3.fourth||0); totalPoints += pointsTop3.fourth||0; }
          else { breakdown.place.push(0); }
        }
      }
    }

    const origPick = '#' + (idToNum[prediction.winner_pick] || '?');
    const resolvedPick = '#' + (idToNum[prediction.resolved_winner_pick] || '?');
    const wasSubstituted = prediction.winner_pick !== prediction.resolved_winner_pick;

    // Borrar score anterior e insertar nuevo
    if (prediction.membership_id) {
      await sb.from('scores').delete().eq('race_id', raceId).eq('membership_id', prediction.membership_id);
    } else if (prediction.user_id) {
      await sb.from('scores').delete().eq('race_id', raceId).eq('user_id', prediction.user_id);
    }

    const { error } = await sb.from('scores').insert({
      penca_id: pencaId,
      race_id: raceId,
      user_id: prediction.user_id,
      membership_id: prediction.membership_id || null,
      points_total: totalPoints,
      breakdown,
    });

    if (error) {
      console.error(`  ❌ Error guardando score:`, error.message);
    } else {
      saved++;
      const subNote = wasSubstituted ? ` (${origPick}→${resolvedPick} retirado)` : '';
      if (totalPoints > 0 || wasSubstituted) {
        console.log(`  ${totalPoints > 0 ? '✅' : '◯'} ${prediction.membership_id || prediction.user_id}: pick=${origPick}${subNote} → ${totalPoints} pts`);
      }
    }
  }

  console.log(`  📊 Carrera #${raceSeq}: ${saved} scores guardados`);
}

(async () => {
  const PENCA_SLUG = 'florida-automatico';

  const { data: penca } = await sb.from('pencas').select('id').eq('slug', PENCA_SLUG).single();
  if (!penca) { console.error('Penca no encontrada'); process.exit(1); }

  const { data: ruleset } = await sb.from('rulesets').select('*').eq('penca_id', penca.id).eq('is_active', true).single();
  if (!ruleset) { console.error('Sin ruleset activo'); process.exit(1); }

  console.log(`Ruleset: modalidades raw=${JSON.stringify(ruleset.modalities_enabled)} → normalizadas=${JSON.stringify(normalizeModalities(ruleset.modalities_enabled))}`);
  console.log(`Puntos: 1ro=${ruleset.points_top3.first} 2do=${ruleset.points_top3.second} 3ro=${ruleset.points_top3.third} 4to=${ruleset.points_top3.fourth} exclusivo=${ruleset.exclusive_winner_points}`);

  const { data: races } = await sb.from('races').select('id, seq, status')
    .eq('penca_id', penca.id).eq('status', 'result_published').order('seq');

  if (!races || !races.length) { console.log('No hay carreras publicadas.'); process.exit(0); }

  console.log(`\nRecalculando ${races.length} carrera(s)...\n`);

  for (const race of races) {
    console.log(`Carrera #${race.seq} (${race.id})`);
    await recalcRace(penca.id, race.id, race.seq, ruleset);
    console.log('');
  }

  console.log('✅ Recálculo completo!');
  process.exit(0);
})();
