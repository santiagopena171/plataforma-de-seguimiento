import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';

interface RaceEntry {
  id: string;
  program_number: number;
  horse_name: string;
  jockey: string;
}

interface Race {
  id: string;
  seq: number;
  venue: string;
  distance_m: number;
  start_at: string;
  status: string;
}

export default async function RacePreviewPage({
  params,
}: {
  params: {
    slug: string;
    raceId: string;
  };
}) {
  const supabase = createServerComponentClient({ cookies });

  // Obtener carrera
  const { data: race, error: raceError } = await supabase
    .from('races')
    .select('*')
    .eq('id', params.raceId)
    .single();

  if (raceError || !race) {
    notFound();
  }

  // Obtener caballos
  const { data: entries } = await supabase
    .from('race_entries')
    .select('*')
    .eq('race_id', params.raceId)
    .order('program_number', { ascending: true });

  const startAtDate = new Date(race.start_at);
  const formattedDate = startAtDate.toLocaleDateString('es-ES', {
    dateStyle: 'medium',
  });
  const formattedTime = startAtDate.toLocaleTimeString('es-ES', {
    timeStyle: 'short',
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link
                href={`/admin/penca/${params.slug}`}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Volver
              </Link>
              <span className="text-gray-400">/</span>
              <h1 className="text-2xl font-bold text-gray-900">
                Vista Previa - Carrera #{race.seq}
              </h1>
            </div>
            <div className="text-sm text-gray-600">
              (Esta es la vista que ven los participantes)
            </div>
          </div>
        </div>
      </header>

      {/* Preview Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Race Info Card */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-600">Hipódromo</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">{race.venue}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Distancia</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">{race.distance_m}m</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Fecha</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">{formattedDate}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Hora</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">{formattedTime}</p>
            </div>
          </div>
        </div>

        {/* Horses Section */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Participantes ({entries?.length || 0})
            </h2>
          </div>

          {entries && entries.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {entries.map((entry: RaceEntry) => (
                <div key={entry.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                          #{entry.program_number}
                        </span>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {entry.horse_name}
                        </h3>
                      </div>
                      <p className="text-sm text-gray-600 mt-2">
                        <strong>Jockey:</strong> {entry.jockey}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-6 py-8 text-center">
              <p className="text-gray-600">No hay caballos agregados</p>
            </div>
          )}
        </div>

        {/* Back button */}
        <div className="mt-8">
          <Link
            href={`/admin/penca/${params.slug}`}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            ← Volver a la gestión
          </Link>
        </div>
      </main>
    </div>
  );
}
