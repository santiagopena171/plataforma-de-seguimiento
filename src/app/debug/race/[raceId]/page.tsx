import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Link from 'next/link';

interface PageProps {
  params: {
    raceId: string;
  };
}

export default async function DebugRaceInspector({ params }: PageProps) {
  const supabase = createServerComponentClient({ cookies });

  const { data: race } = await supabase.from('races').select('*, penca_id').eq('id', params.raceId).maybeSingle();
  if (!race) return <div>Race not found</div>;

  const [{ data: entries }, { data: predictions }, { data: scores }, { data: raceResult }] = await Promise.all([
    supabase.from('race_entries').select('*').eq('race_id', params.raceId).order('program_number', { ascending: true }),
    supabase.from('predictions').select('*, memberships!predictions_membership_id_fkey(id, guest_name)').eq('race_id', params.raceId),
    supabase.from('scores').select('*, memberships!scores_membership_id_fkey(id, guest_name)').eq('race_id', params.raceId).order('points_total', { ascending: false }),
    supabase.from('race_results').select('*').eq('race_id', params.raceId).maybeSingle(),
  ]).catch(e => { console.error(e); return [{ data: [] }, { data: [] }, { data: [] }, { data: null }]; });

  const entriesMap: Record<string, any> = {};
  const entriesByNumber: Record<string, any> = {};
  (entries || []).forEach((entry: any) => {
    // Normalize alias `number` for compatibility
    entry.number = entry.program_number;
    entriesMap[entry.id] = entry;
    entriesByNumber[String(entry.program_number)] = entry;
  });

  // Build quick map of scores by membership_id for display
  const scoresByMembership: Record<string, any> = {};
  (scores || []).forEach((s: any) => { if (s.membership_id) scoresByMembership[s.membership_id] = s; });

  // Resolve predictions and prepare rows
  const rows = (predictions || []).map((p: any) => {
    const raw = p.winner_pick;
    let resolvedId: string | null = null;
    // If raw matches an entry id, keep it
    if (raw && entriesMap[raw]) resolvedId = raw;
    // If raw matches a program_number (e.g., '4' or 4), map to the corresponding id
    else if (raw && entriesByNumber[String(raw)]) resolvedId = entriesByNumber[String(raw)].id;

    const resolvedEntry = resolvedId ? entriesMap[resolvedId] : null;
    const displayNumber = resolvedEntry ? resolvedEntry.program_number : (entriesByNumber[String(raw)]?.program_number ?? '?');
    const displayLabel = resolvedEntry ? (resolvedEntry.label || resolvedEntry.horse_name || `#${displayNumber}`) : '?';
    const score = scoresByMembership[p.membership_id];
    const matchedWinner = raceResult && raceResult.first_place && resolvedId === raceResult.first_place;

    return {
      membership_id: p.membership_id,
      guest_name: p.memberships?.guest_name || 'usuario',
      raw_winner_pick: raw,
      resolved_id: resolvedId,
      display_number: displayNumber,
      display_label: displayLabel,
      points_total: score?.points_total ?? null,
      matchedWinner,
      predictionId: p.id,
    };
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Debug: Race Inspector</h1>
        <p className="text-sm text-gray-600 mb-6">Race id: {params.raceId}</p>

        <div className="bg-white rounded shadow p-4 mb-6">
          <h2 className="font-semibold">Entries</h2>
          <ul>
            {(entries || []).map((e: any) => (
              <li key={e.id}>#{e.program_number} — id: {e.id} — label: {e.label || e.horse_name || '—'}</li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded shadow p-4">
          <h2 className="font-semibold mb-2">Predictions & Scores</h2>
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="text-left">Jugador</th>
                <th className="text-left">raw winner_pick</th>
                <th className="text-left">resolved id</th>
                <th className="text-left">prog #</th>
                <th className="text-left">label</th>
                <th className="text-left">points</th>
                <th className="text-left">matchedWinner</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.predictionId} className="border-t">
                  <td className="py-2">{r.guest_name}</td>
                  <td className="py-2 font-mono text-sm">{String(r.raw_winner_pick)}</td>
                  <td className="py-2 font-mono text-sm">{r.resolved_id || '—'}</td>
                  <td className="py-2">{r.display_number}</td>
                  <td className="py-2">{r.display_label}</td>
                  <td className="py-2">{r.points_total ?? '—'}</td>
                  <td className="py-2">{r.matchedWinner ? 'yes' : 'no'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6">
          <Link href="/">← Volver</Link>
        </div>
      </div>
    </div>
  );
}
