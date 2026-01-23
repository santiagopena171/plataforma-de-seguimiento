import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import PredictionForm from './PredictionForm';

interface PredictPageProps {
  params: {
    slug: string;
    raceId: string;
  };
}

export default async function PredictRacePage({ params }: PredictPageProps) {
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  // Obtener datos de la carrera
  const { data: race } = await supabase
    .from('races')
    .select(`
      *,
      pencas (
        id,
        name,
        slug
      ),
      race_entries (
        id,
        program_number,
        horse_name:label
      )
    `)
    .eq('id', params.raceId)
    .single();

  if (!race) {
    redirect(`/penca/${params.slug}`);
  }

  // Verificar que el usuario es miembro de la penca
  const { data: membership } = await supabase
    .from('memberships')
    .select('role')
    .eq('penca_id', race.pencas.id)
    .eq('user_id', session.user.id)
    .single();

  if (!membership) {
    redirect('/dashboard');
  }

  // Obtener las reglas activas de la penca
  const { data: ruleset } = await supabase
    .from('rulesets')
    .select('*')
    .eq('penca_id', race.pencas.id)
    .eq('is_active', true)
    .single();

  if (!ruleset) {
    redirect(`/penca/${params.slug}`);
  }

  // Obtener predicción existente si hay
  const { data: existingPrediction } = await supabase
    .from('predictions')
    .select('*')
    .eq('race_id', params.raceId)
    .eq('user_id', session.user.id)
    .single();

  // Verificar si la carrera ya está cerrada
  const raceDate = new Date(race.start_at);
  const now = new Date();
  const lockTime = new Date(raceDate.getTime() - ruleset.lock_minutes_before_start * 60000);
  const isLocked = now >= lockTime || race.status === 'closed' || race.status === 'result_published';

  if (isLocked && !existingPrediction) {
    redirect(`/penca/${params.slug}`);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link
            href={`/penca/${params.slug}`}
            className="text-gray-600 hover:text-gray-900"
          >
            ← Volver a {race.pencas.name}
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {existingPrediction ? 'Modificar Predicción' : 'Hacer Predicción'} - Carrera #{race.seq}
            </h1>
            <div className="space-y-1 text-sm text-gray-600">
              <p>📍 {race.venue}</p>
              <p>📏 {race.distance_m}m</p>
              <p>🕐 {new Date(race.start_at).toLocaleString('es-UY', {
                dateStyle: 'medium',
                timeStyle: 'short'
              })}</p>
              {!isLocked && (
                <p className="text-amber-600 mt-2">
                  ⏰ Cierra {ruleset.lock_minutes_before_start} minutos antes de la largada
                </p>
              )}
            </div>
          </div>

          {isLocked && existingPrediction ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-800">
                ⚠️ Esta carrera ya está cerrada. Solo puedes ver tu predicción.
              </p>
            </div>
          ) : null}

          <PredictionForm
            raceId={params.raceId}
            userId={session.user.id}
            horses={race.race_entries.sort((a: any, b: any) => a.program_number - b.program_number)}
            modalities={ruleset.modalities_enabled as string[]}
            existingPrediction={existingPrediction}
            isClosed={isLocked}
            pencaSlug={params.slug}
          />

          {/* Instructions */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-3">
              ℹ️ Instrucciones y Puntos
            </h3>
            
            {/* Points System */}
            <div className="mb-4 p-3 bg-white rounded border border-blue-300">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">Sistema de Puntos:</h4>
              <div className="text-sm text-blue-800 space-y-1">
                <p>🥇 1° Puesto: <strong>{(ruleset.points_top3 as any).first || 5} puntos</strong></p>
                <p>🥈 2° Puesto: <strong>{(ruleset.points_top3 as any).second || 3} puntos</strong></p>
                <p>🥉 3° Puesto: <strong>{(ruleset.points_top3 as any).third || 1} punto</strong></p>
                {(ruleset.points_top3 as any).fourth !== undefined && (
                  <p>4° Puesto: <strong>{(ruleset.points_top3 as any).fourth} puntos</strong></p>
                )}
                {ruleset.exclusive_winner_points && ruleset.exclusive_winner_points !== (ruleset.points_top3 as any).first && (
                  <p className="text-amber-700 font-semibold mt-2">
                    ✨ Ganador Exclusivo: <strong>{ruleset.exclusive_winner_points} puntos</strong>
                    <span className="block text-xs font-normal mt-1">
                      (Cuando solo tú aciertas el ganador)
                    </span>
                  </p>
                )}
              </div>
            </div>

            {/* Modalities */}
            <h4 className="text-sm font-semibold text-blue-900 mb-2">Modalidades:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              {(ruleset.modalities_enabled as string[]).includes('winner') && (
                <li>• <strong>Winner:</strong> Aciertas el ganador → ganas los puntos de 1° puesto ({(ruleset.points_top3 as any).first} pts)</li>
              )}
              {(ruleset.modalities_enabled as string[]).includes('exacta') && (
                <li>• <strong>Exacta:</strong> Aciertas 1° y 2° en orden → ganas puntos de 1° y 2° ({(ruleset.points_top3 as any).first + (ruleset.points_top3 as any).second} pts)</li>
              )}
              {(ruleset.modalities_enabled as string[]).includes('trifecta') && (
                <li>• <strong>Trifecta:</strong> Aciertas 1°, 2° y 3° en orden → ganas todos los puntos ({(ruleset.points_top3 as any).first + (ruleset.points_top3 as any).second + (ruleset.points_top3 as any).third} pts)</li>
              )}
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
