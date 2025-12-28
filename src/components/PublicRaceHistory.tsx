'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Race {
  id: string;
  seq: number;
  venue: string;
  distance_m: number;
  start_at: string;
  status: string;
  race_day_id: string | null;
}

interface RaceDay {
  id: string;
  penca_id: string;
  day_number: number;
  day_name: string;
  day_date: string | null;
}

interface RaceResult {
  race_id: string;
  first_place: string;
  second_place: string;
  third_place: string;
  fourth_place: string;
}

interface PublicRaceHistoryProps {
  races: Race[];
  raceDays: RaceDay[];
  resultsMap: Record<string, RaceResult>;
  entriesByRace: Record<string, Record<string, any>>;
  pencaSlug: string;
}

export default function PublicRaceHistory({
  races,
  raceDays,
  resultsMap,
  entriesByRace,
  pencaSlug,
}: PublicRaceHistoryProps) {
  const [selectedDayId, setSelectedDayId] = useState<string | 'all'>('all');

  // Filtrar carreras según el día seleccionado
  const filteredRaces = selectedDayId === 'all'
    ? races
    : races.filter(race => race.race_day_id === selectedDayId);

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-xl font-semibold text-gray-900">
            📋 Historial de Carreras
          </h2>

          {raceDays && raceDays.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="day-select" className="text-sm text-gray-600">
                Filtrar por día:
              </label>
              <select
                id="day-select"
                value={selectedDayId}
                onChange={(e) => setSelectedDayId(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Todos los días</option>
                {raceDays.map((day) => (
                  <option key={day.id} value={day.id}>
                    {day.day_name}
                    {day.day_date && ` - ${new Date(day.day_date).toLocaleDateString('es-UY', { dateStyle: 'medium' })}`}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {filteredRaces.length === 0 ? (
        <div className="px-4 sm:px-6 py-8 text-center text-gray-500">
          {selectedDayId === 'all' 
            ? 'No hay carreras todavía.' 
            : 'No hay carreras para el día seleccionado.'}
        </div>
      ) : (
        <div className="divide-y divide-gray-200">
          {filteredRaces.map((race) => {
            const result = resultsMap[race.id];

            return (
              <div key={race.id} className="px-4 sm:px-6 py-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      Carrera {race.seq} - {race.venue}
                    </h3>

                    {result && (
                      <div className="mt-3 flex flex-wrap gap-4 text-sm">
                        <span className="text-gray-700">
                          🥇 <span className="font-medium">#{(entriesByRace[race.id] && entriesByRace[race.id][result.first_place]?.program_number) || '?'}</span>
                        </span>
                        <span className="text-gray-700">
                          🥈 <span className="font-medium">#{(entriesByRace[race.id] && entriesByRace[race.id][result.second_place]?.program_number) || '?'}</span>
                        </span>
                        <span className="text-gray-700">
                          🥉 <span className="font-medium">#{(entriesByRace[race.id] && entriesByRace[race.id][result.third_place]?.program_number) || '?'}</span>
                        </span>
                        <span className="text-gray-700">
                          <span className="font-semibold">4°</span> <span className="font-medium">#{(entriesByRace[race.id] && entriesByRace[race.id][result.fourth_place]?.program_number) || '?'}</span>
                        </span>
                      </div>
                    )}
                  </div>

                  {race.status === 'result_published' ? (
                    <Link
                      href={`/public/${pencaSlug}/race/${race.id}`}
                      className="px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-md transition-colors"
                    >
                      Ver Predicciones
                    </Link>
                  ) : (
                    <span className="text-sm text-gray-400">
                      Resultados pendientes
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
