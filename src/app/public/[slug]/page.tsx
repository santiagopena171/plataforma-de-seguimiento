import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import PublicRaceHistory from '@/components/PublicRaceHistory';

interface PageProps {
  params: {
    slug: string;
  };
}

const getRaceStartDate = (race?: any) => {
  if (!race) return null;
  const candidates = [
    race.start_at,
    race.date && race.time ? `${race.date}T${race.time}` : race.date,
    race.created_at,
  ];

  for (const raw of candidates) {
    if (!raw) continue;
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
};

const formatRaceDate = (
  race: any,
  options?: Intl.DateTimeFormatOptions
) => {
  const date = getRaceStartDate(race);
  return date ? date.toLocaleDateString('es-UY', options) : null;
};

const formatRaceTime = (race: any) => {
  const date = getRaceStartDate(race);
  return date
    ? date.toLocaleTimeString('es-UY', {
      hour: '2-digit',
      minute: '2-digit',
    })
    : null;
};

export default async function PublicPencaPage({ params }: PageProps) {
  const supabase = createServerComponentClient({ cookies });

  // Obtener la penca (pública)
  const { data: penca } = await supabase
    .from('pencas')
    .select('*')
    .eq('slug', params.slug)
    .single();

  if (!penca) {
    notFound();
  }

  // Crear cliente admin (service role) en servidor para obtener datos que pueden estar sujetos a RLS
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase environment variables for server-side read');
  }

  const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Obtener días de carreras
  const { data: raceDays } = await supabaseAdmin
    .from('race_days')
    .select('*')
    .eq('penca_id', penca.id)
    .order('day_number', { ascending: true });

  // Obtener todas las carreras de la penca (para listar historial y estados)
  const { data: races, error: racesError } = await supabaseAdmin
    .from('races')
    .select(`
      id,
      seq,
      venue,
      distance_m,
      start_at,
      status,
      race_day_id
    `)
    .eq('penca_id', penca.id)
    .order('seq', { ascending: true });

  // Obtener resultados de las carreras
  const raceIds = races?.map((r: any) => r.id) || [];

  const { data: raceResults } = await supabaseAdmin
    .from('race_results')
    .select('*')
    .in('race_id', raceIds);

  const raceIdsWithResults = new Set(
    (raceResults || []).map((result: any) => result.race_id)
  );

  const publishedRaces = (races || [])
    .filter(
      (race: any) =>
        race.status === 'result_published' || raceIdsWithResults.has(race.id)
    )
    .sort((a: any, b: any) => {
      const end = getRaceStartDate(b)?.getTime() || 0;
      const start = getRaceStartDate(a)?.getTime() || 0;
      return end - start;
    });

  console.log('PUBLIC PUBLIC RACES', {
    racesCount: races?.length || 0,
    racesError,
    statuses: (races || []).map((r: any) => ({
      id: r.id,
      seq: r.seq,
      status: r.status,
      start_at: r.start_at,
    })),
    publishedCount: publishedRaces.length,
  });

  // Obtener entradas para todas las carreras listadas (para mostrar número de programa)
  const { data: allEntries } = await supabaseAdmin
    .from('race_entries')
    .select('id, program_number, race_id')
    .in('race_id', raceIds);

  const entriesByRace: Record<string, Record<string, any>> = {};
  (allEntries || []).forEach((e: any) => {
    if (!entriesByRace[e.race_id]) entriesByRace[e.race_id] = {};
    entriesByRace[e.race_id][e.id] = e;
  });

  // Mapear resultados por race_id
  const resultsMap: Record<string, any> = {};
  raceResults?.forEach((result: any) => {
    resultsMap[result.race_id] = result;
  });

  // Obtener scores y miembros usando admin client para computation del leaderboard
  const { data: scores } = await supabaseAdmin
    .from('scores')
    .select('*')
    .eq('penca_id', penca.id);

  const { data: memberships } = await supabaseAdmin
    .from('memberships')
    .select(`
      *,
      profiles:user_id (
        display_name
      )
    `)
    .eq('penca_id', penca.id);

  const baseMemberships = memberships || [];
  const membershipUserIds = new Set(
    baseMemberships.map((m: any) => m.user_id).filter(Boolean)
  );

  const scoreUserIds = Array.from(
    new Set((scores || []).map((s: any) => s.user_id).filter(Boolean))
  );

  const missingProfileIds = scoreUserIds.filter((id) => !membershipUserIds.has(id));

  let extraProfiles: any[] = [];
  if (missingProfileIds.length > 0) {
    const { data: fetchedProfiles } = await supabaseAdmin
      .from('profiles')
      .select('id, display_name')
      .in('id', missingProfileIds);
    extraProfiles = fetchedProfiles || [];
  }

  const referencedMembershipIds = Array.from(
    new Set((scores || []).map((s: any) => s.membership_id).filter(Boolean))
  );
  const existingMembershipIds = new Set(baseMemberships.map((m: any) => m.id));
  const missingMembershipIds = referencedMembershipIds.filter(
    (id) => id && !existingMembershipIds.has(id)
  );

  let extraMemberships: any[] = [];
  if (missingMembershipIds.length > 0) {
    const { data: fetchedMemberships } = await supabaseAdmin
      .from('memberships')
      .select(`
        *,
        profiles:user_id (
          display_name
        )
      `)
      .in('id', missingMembershipIds);
    extraMemberships = fetchedMemberships || [];
  }

  const allMemberships = [
    ...baseMemberships,
    ...extraMemberships.filter((m: any) => !existingMembershipIds.has(m.id)),
  ];

  allMemberships.forEach((m: any) => {
    if (m.user_id) {
      membershipUserIds.add(m.user_id);
    }
  });

  const adminMemberships = allMemberships.filter((m: any) => m.role === 'admin');
  const adminMembershipIds = new Set(adminMemberships.map((m: any) => m.id));
  const adminUserIds = new Set(
    adminMemberships.map((m: any) => m.user_id).filter(Boolean)
  );
  const playerMemberships = allMemberships.filter((m: any) => m.role !== 'admin');

  const profilesMap = new Map<string, any>();
  allMemberships.forEach((m: any) => {
    if (m.user_id && m.profiles) {
      profilesMap.set(m.user_id, m.profiles);
    }
  });
  extraProfiles.forEach((profile: any) => {
    profilesMap.set(profile.id, profile);
  });

  const getProfileName = (profile?: any) => profile?.display_name || null;

  const getBestName = (membership?: any, userId?: string | null) =>
    membership?.guest_name ||
    getProfileName(membership?.profiles) ||
    (userId ? getProfileName(profilesMap.get(userId)) : null);

  // Agrupar scores por miembro/usuario y calcular puntos totales
  const playerScores: Record<string, {
    name: string;
    totalPoints: number;
    races: number;
    userId?: string | null;
  }> = {};

  // Inicializar con memberships (asegurar aparecen aunque no tengan scores)
  playerMemberships.forEach((m: any) => {
    const id = m.id;
    const name = getBestName(m, m.user_id) || 'Sin nombre';
    playerScores[id] = { name, totalPoints: 0, races: 0, userId: m.user_id };
  });

  (scores || []).forEach((score: any) => {
    const membershipId = score.membership_id;
    const userId = score.user_id;

    if (membershipId) {
      if (adminMembershipIds.has(membershipId)) {
        return;
      }
      // Si no tenemos el membership en playerScores (p. ej. memberships vacías), crear un fallback
      if (!playerScores[membershipId]) {
        const short = typeof membershipId === 'string' ? membershipId.slice(0, 6) : membershipId;
        const profileName = userId ? getProfileName(profilesMap.get(userId)) : null;
        playerScores[membershipId] = {
          name: profileName || `Miembro ${short}`,
          totalPoints: 0,
          races: 0,
          userId: userId || null,
        };
      }
      playerScores[membershipId].totalPoints += score.points_total || 0;
      playerScores[membershipId].races += 1;
      if (!playerScores[membershipId].userId && userId) {
        playerScores[membershipId].userId = userId;
      }
    } else if (userId) {
      if (adminUserIds.has(userId)) {
        return;
      }
      // intentar encontrar membership by user_id
      const mem = playerMemberships.find((m: any) => m.user_id === userId);
      if (mem) {
        playerScores[mem.id].totalPoints += score.points_total || 0;
        playerScores[mem.id].races += 1;
      } else {
        // fallback: utilizar userId como key
        if (!playerScores[userId]) {
          const profileName = getProfileName(profilesMap.get(userId));
          const short = typeof userId === 'string' ? userId.slice(0, 6) : userId;
          playerScores[userId] = {
            name: profileName || `Jugador ${short}`,
            totalPoints: 0,
            races: 0,
            userId,
          };
        }
        playerScores[userId].totalPoints += score.points_total || 0;
        playerScores[userId].races += 1;
      }
    }
  });

  const leaderboard = Object.entries(playerScores)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.totalPoints - a.totalPoints);

  // If we have memberships data, prefer the assigned guest_name/display_name
  const membershipsMap = new Map(playerMemberships.map((m: any) => [m.id, m]));

  const leaderboardCards = leaderboard.map((p, index) => {
    const mem = membershipsMap.get(p.id);
    const fallbackProfile = p.userId ? profilesMap.get(p.userId) : null;
    const fallbackMembership =
      !mem && p.userId
        ? playerMemberships.find((m: any) => m.user_id === p.userId)
        : null;
    const resolvedName = mem
      ? getBestName(mem, mem.user_id)
      : getProfileName(fallbackProfile) || p.name;
    const joinedLabel = mem?.joined_at
      ? `Se unió ${new Date(mem.joined_at).toLocaleDateString('es-UY')}`
      : fallbackMembership?.joined_at
        ? `Se unió ${new Date(fallbackMembership.joined_at).toLocaleDateString('es-UY')}`
        : p.userId
          ? 'Participante registrado'
          : 'Invitado';
    const membershipId = mem?.id || fallbackMembership?.id || null;

    return {
      ...p,
      name: resolvedName || 'Sin nombre',
      rank: index + 1,
      joinedLabel,
      membershipId,
    };
  });

  // Diagnostics: print key counts and some ids to server console for debugging
  try {
    // eslint-disable-next-line no-console
    console.log('PUBLIC PENCA DIAGNOSTICS', {
      pencaId: penca?.id,
      racesCount: races?.length || 0,
      raceIds: raceIds || [],
      membershipsCount: playerMemberships.length,
      membershipIds: playerMemberships.slice(0, 5).map((m: any) => m.id),
      scoresCount: (scores || []).length,
      scoreSample: (scores || []).slice(0, 5).map((s: any) => ({ id: s.id, race_id: s.race_id, membership_id: s.membership_id, user_id: s.user_id })),
    });
  } catch (err) {
    // ignore logging errors
  }

  // Debugging logs
  console.log('Memberships:', memberships);
  console.log('Scores:', scores);
  console.log('Leaderboard:', leaderboardCards);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{penca.name}</h1>
              {penca.description && (
                <p className="mt-1 text-sm text-gray-600">{penca.description}</p>
              )}
            </div>
            <Link
              href="/"
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Salir
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Quick diagnostics */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-sm text-gray-500">Miembros</p>
            <p className="text-2xl font-bold text-gray-900">{playerMemberships.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-sm text-gray-500">Carreras</p>
            <p className="text-2xl font-bold text-gray-900">{(races || []).length}</p>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              🏆 Tabla de Posiciones
            </h2>
          </div>

          {leaderboardCards.length === 0 ? (
            <div className="px-4 sm:px-6 py-8 text-center text-gray-500">
              {(!memberships || memberships.length === 0) ? (
                'No hay miembros en esta penca aún.'
              ) : (
                'No hay resultados publicados aún.'
              )}
            </div>
          ) : (
            <div className="px-4 sm:px-6 py-6 space-y-6">
              {leaderboardCards.map((player) => (
                <div
                  key={player.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex items-center justify-center w-12 h-12">
                        {player.rank === 1 && <span className="text-3xl">🥇</span>}
                        {player.rank === 2 && <span className="text-3xl">🥈</span>}
                        {player.rank === 3 && <span className="text-3xl">🥉</span>}
                        {player.rank > 3 && (
                          <span className="text-lg font-bold text-gray-600">
                            #{player.rank}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{player.name}</p>
                        <p className="text-sm text-gray-500">{player.joinedLabel}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-2xl font-bold text-indigo-600 text-left sm:text-right">
                          {player.totalPoints} pts
                        </p>
                        <p className="text-xs text-gray-500">{player.races} carreras</p>
                      </div>
                      <div className="text-right">
                        {player.membershipId ? (
                          <Link
                            href={`/public/${params.slug}/player/${player.membershipId}`}
                            className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1 border border-blue-100 rounded-md"
                          >
                            <span aria-hidden="true">▶</span>
                            Abrir Predicciones
                          </Link>
                        ) : (
                          <span className="text-sm text-gray-400">Predicciones no disponibles</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Races History */}
        <PublicRaceHistory
          races={races || []}
          raceDays={raceDays || []}
          resultsMap={resultsMap}
          entriesByRace={entriesByRace}
          pencaSlug={params.slug}
        />
      </main>

      {/* Footer */}
      <footer className="mt-12 bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-gray-500">
            Plataforma de Seguimiento - {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
