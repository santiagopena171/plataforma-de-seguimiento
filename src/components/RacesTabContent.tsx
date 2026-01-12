'use client';

import Link from 'next/link';
import DeleteRaceButton from '@/components/DeleteRaceButton';

interface Race {
  id: string;
  seq: number;
  venue: string;
  distance_m: number;
  start_at: string;
  status: string;
  race_day_id?: string | null;
  race_entries: any[];
  predictions: any[];
}

interface RaceDay {
  id: string;
  penca_id: string;
  day_number: number;
  day_name: string;
  day_date: string | null;
}

interface RaceResult {
  id: string;
  race_id: string;
  official_order: string[];
  first_place_tie?: boolean;
}

interface RacesTabContentProps {
  pencaSlug: string;
  races: Race[];
  raceDays: RaceDay[];
  predictions: any[];
  raceResults: RaceResult[];
  actualMembers: any[];
  generatingImage: string | null;
  closingRace: string | null;
  deletingDay: string | null;
  onDeleteDay: (dayId: string) => void;
  onDownloadPredictions: (raceId: string) => void;
  onDownloadResults: (raceId: string) => void;
  onOpenPredictions: (raceId: string) => void;
  formatRaceTime: (isoString: string) => string;
}

export default function RacesTabContent({
  pencaSlug,
  races,
  raceDays,
  predictions,
  raceResults,
  actualMembers,
  generatingImage,
  closingRace,
  deletingDay,
  onDeleteDay,
  onDownloadPredictions,
  onDownloadResults,
  onOpenPredictions,
  formatRaceTime,
}: RacesTabContentProps) {
  // Carreras sin día asignado
  const racesWithoutDay = races.filter((race) => !race.race_day_id);

  return (
    <>
      {/* Lista de Días */}
      {raceDays && raceDays.length > 0 && raceDays.map((day) => {
        const dayRaces = races.filter((race) => race.race_day_id === day.id);
        
        return (
          <div key={day.id} className="border border-gray-300 rounded-lg p-4 bg-gray-50 mb-6">
            {/* Header del Día */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h4 className="text-lg font-semibold text-indigo-700">
                  📅 {day.day_name}
                </h4>
                {day.day_date && (
                  <span className="text-sm text-gray-600">
                    {new Date(day.day_date).toLocaleDateString('es-UY', { 
                      dateStyle: 'medium' 
                    })}
                  </span>
                )}
                <span className="text-sm text-gray-500">
                  ({dayRaces.length} carrera{dayRaces.length !== 1 ? 's' : ''})
                </span>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/admin/penca/${pencaSlug}/race/new?dayId=${day.id}`}
                  className="text-sm px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                >
                  + Agregar Carrera
                </Link>
                <button
                  onClick={() => onDeleteDay(day.id)}
                  disabled={deletingDay === day.id}
                  className="text-sm px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                >
                  {deletingDay === day.id ? 'Eliminando...' : 'Eliminar Día'}
                </button>
              </div>
            </div>

            {/* Carreras del Día */}
            {dayRaces.length > 0 ? (
              <div className="space-y-3">
                {dayRaces.map((race) => {
                  const raceResult = raceResults.find(r => r.race_id === race.id);
                  const predsForRace = predictions.filter((p: any) => p.race_id === race.id);
                  const uniquePredKeys = new Set(predsForRace.map((p: any) => p.membership_id || p.user_id)).size;

                  return (
                    <div
                      key={race.id}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <span className="text-lg font-bold text-gray-900">
                              Carrera #{race.seq}
                            </span>
                            <span
                              className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                race.status === 'scheduled'
                                  ? 'bg-blue-100 text-blue-800'
                                  : race.status === 'closed'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-purple-100 text-purple-800'
                              }`}
                            >
                              {race.status}
                            </span>
                          </div>
                          <div className="mt-2 space-y-1 text-sm text-gray-600">
                            <p>📍 {race.venue} • 📏 {race.distance_m}m</p>
                            <p>
                              🕐{' '}
                              {new Date(race.start_at).toLocaleDateString('es-UY', {
                                dateStyle: 'medium',
                              })}, {formatRaceTime(race.start_at)}
                            </p>
                            <p>🐴 {race.race_entries?.length || 0} caballos</p>
                          </div>

                          {/* Resultado Oficial */}
                          {raceResult && raceResult.official_order && raceResult.official_order.length > 0 && (
                            <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                              <p className="text-sm font-bold text-yellow-900 mb-2">
                                🏆 Resultado Oficial:
                                {raceResult.first_place_tie && (
                                  <span className="ml-2 text-xs bg-yellow-200 text-yellow-900 px-2 py-0.5 rounded">
                                    Empate 1°
                                  </span>
                                )}
                              </p>
                              <div className="space-y-1">
                                {raceResult.official_order.slice(0, 3).map((entryId: string, index: number) => {
                                  const entry = race.race_entries?.find((e: any) => e.id === entryId);
                                  const isTie = raceResult.first_place_tie;
                                  
                                  let position = index + 1;
                                  let medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
                                  
                                  if (isTie) {
                                    if (index === 0 || index === 1) {
                                      position = 1;
                                      medal = '🥇';
                                    } else if (index === 2) {
                                      position = 3;
                                      medal = '🥉';
                                    }
                                  }
                                  
                                  return entry ? (
                                    <p key={entryId} className="text-sm text-yellow-900">
                                      {medal} {position}°: <span className="font-bold">Caballo #{entry.program_number}</span>
                                    </p>
                                  ) : null;
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/admin/penca/${pencaSlug}/race/${race.id}/preview`}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Ver
                          </Link>
                          <Link
                            href={`/admin/penca/${pencaSlug}/race/${race.id}/edit`}
                            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            Editar
                          </Link>

                          {/* Botones de acción según estado */}
                          {race.status === 'result_published' ? (
                            <button
                              onClick={() => onDownloadResults(race.id)}
                              disabled={generatingImage === race.id}
                              className="text-sm text-green-600 hover:text-green-800 font-medium disabled:opacity-50"
                            >
                              {generatingImage === race.id ? 'Generando...' : 'Resultado Publicado'}
                            </button>
                          ) : race.status === 'closed' ? (
                            <button
                              onClick={() => onOpenPredictions(race.id)}
                              disabled={closingRace === race.id}
                              className="text-sm text-orange-600 hover:text-orange-800 font-medium disabled:opacity-50"
                            >
                              {closingRace === race.id ? 'Abriendo...' : 'Abrir Predicciones'}
                            </button>
                          ) : (
                            uniquePredKeys >= actualMembers.length ? (
                              <button
                                onClick={() => onDownloadPredictions(race.id)}
                                disabled={generatingImage === race.id}
                                className="text-sm text-gray-600 hover:text-gray-800 font-medium disabled:opacity-50"
                              >
                                {generatingImage === race.id ? 'Generando...' : 'Predicciones Creadas'}
                              </button>
                            ) : (
                              <Link
                                href={`/admin/penca/${pencaSlug}/race/${race.id}/predictions`}
                                className="text-sm text-red-600 hover:text-red-800 font-medium"
                              >
                                Crear Predicciones
                              </Link>
                            )
                          )}

                          {race.status !== 'result_published' && (
                            <Link
                              href={`/admin/penca/${pencaSlug}/race/${race.id}/publish`}
                              className="text-sm text-green-600 hover:text-green-800 font-medium"
                            >
                              Publicar Resultado
                            </Link>
                          )}
                          <DeleteRaceButton raceId={race.id} slug={pencaSlug} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500 bg-white rounded">
                No hay carreras en este día. Haz clic en "Agregar Carrera" para comenzar.
              </div>
            )}
          </div>
        );
      })}

      {/* Carreras sin día asignado */}
      {racesWithoutDay.length > 0 && (
        <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
          <div className="flex items-center gap-3 mb-4">
            <h4 className="text-lg font-semibold text-gray-700">📋 Sin día asignado</h4>
            <span className="text-sm text-gray-500">({racesWithoutDay.length} carrera{racesWithoutDay.length !== 1 ? 's' : ''})</span>
          </div>
          <div className="space-y-3">
            {racesWithoutDay.map((race) => {
              const raceResult = raceResults.find(r => r.race_id === race.id);
              const predsForRace = predictions.filter((p: any) => p.race_id === race.id);
              const uniquePredKeys = new Set(predsForRace.map((p: any) => p.membership_id || p.user_id)).size;

              return (
                <div
                  key={race.id}
                  className="bg-white border border-gray-200 rounded-lg p-4"
                >
                  {/* Similar content as above */}
                  <div className="text-sm text-gray-600">
                    Carrera #{race.seq} - {race.venue}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mensaje si no hay ni días ni carreras */}
      {raceDays.length === 0 && races.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No hay días ni carreras todavía</p>
          <p className="text-sm text-gray-400">Comienza agregando un día para organizar tus carreras</p>
        </div>
      )}
    </>
  );
}
