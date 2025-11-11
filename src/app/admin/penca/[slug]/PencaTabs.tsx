'use client';

import { useState } from 'react';
import Link from 'next/link';
import DeleteRaceButton from '@/components/DeleteRaceButton';

// Función para formatear la hora sin conversión de zona horaria
function formatRaceTime(isoString: string): string {
  // Extraer solo la parte HH:MM del ISO string
  const timeMatch = isoString.match(/T(\d{2}):(\d{2})/);
  if (!timeMatch) return isoString;
  
  const [_, hourStr, minuteStr] = timeMatch;
  const hour = parseInt(hourStr);
  const minute = parseInt(minuteStr);
  
  // Convertir de 24h a 12h
  let hour12 = hour % 12 || 12;
  const meridiem = hour >= 12 ? 'PM' : 'AM';
  
  return `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${meridiem}`;
}

interface Member {
  user_id: string;
  role: string;
  joined_at: string;
  profiles: {
    id: string;
    display_name: string;
    avatar_url?: string | null;
  };
}

interface Race {
  id: string;
  seq: number;
  venue: string;
  distance_m: number;
  start_at: string;
  status: string;
  race_entries: any[];
  predictions: any[];
}

interface Score {
  id: string;
  penca_id: string;
  race_id: string;
  user_id: string;
  points_total: number;
  breakdown: any;
  created_at: string;
  updated_at: string;
}

interface Prediction {
  id: string;
  race_id: string;
  user_id: string;
  winner_pick: string | null;
  exacta_pick: any;
  trifecta_pick: any;
  winner_entry?: {
    id: string;
    program_number: number;
    horse_name: string;
  };
}

interface RaceResult {
  id: string;
  race_id: string;
  official_order: string[]; // Array de entry IDs [1°, 2°, 3°]
  created_at: string;
}

interface PencaTabsProps {
  pencaSlug: string;
  races: Race[];
  memberships: Member[];
  scores: Score[];
  predictions: Prediction[];
  raceResults: RaceResult[];
  invitesCount: number;
}

export default function PencaTabs({ pencaSlug, races, memberships, scores, predictions, raceResults, invitesCount }: PencaTabsProps) {
  const [activeTab, setActiveTab] = useState<'races' | 'members' | 'leaderboard'>('races');
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [closingRace, setClosingRace] = useState<string | null>(null);

  const handleClosePredictions = async (raceId: string) => {
    try {
      setClosingRace(raceId);
      const response = await fetch(`/api/admin/races/${raceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed' }),
      });

      if (!response.ok) {
        throw new Error('Error al cerrar predicciones');
      }

      // Recargar la página para actualizar el estado
      window.location.reload();
    } catch (err) {
      console.error('Error:', err);
      alert('Error al cerrar predicciones');
    } finally {
      setClosingRace(null);
    }
  };

  const handleOpenPredictions = async (raceId: string) => {
    try {
      setClosingRace(raceId);
      const response = await fetch(`/api/admin/races/${raceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'scheduled' }),
      });

      if (!response.ok) {
        throw new Error('Error al abrir predicciones');
      }

      // Recargar la página para actualizar el estado
      window.location.reload();
    } catch (err) {
      console.error('Error:', err);
      alert('Error al abrir predicciones');
    } finally {
      setClosingRace(null);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Tabs Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('races')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'races'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Carreras ({races?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'members'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Miembros ({memberships?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'leaderboard'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Tabla de Posiciones
          </button>
          <Link
            href={`/admin/penca/${pencaSlug}/config`}
            className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm"
          >
            Configuración
          </Link>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {/* Races Tab */}
        {activeTab === 'races' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Carreras</h3>
              <Link
                href={`/admin/penca/${pencaSlug}/race/new`}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                + Agregar Carrera
              </Link>
            </div>

            {races && races.length > 0 ? (
              <div className="space-y-4">
                {races.map((race) => {
                  const raceResult = raceResults.find(r => r.race_id === race.id);
                  
                  return (
                  <div
                    key={race.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start">
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
                          <p>
                            📍 {race.venue} • 📏 {race.distance_m}m
                          </p>
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
                            <p className="text-sm font-bold text-yellow-900 mb-2">🏆 Resultado Oficial:</p>
                            <div className="space-y-1">
                              {raceResult.official_order.slice(0, 3).map((entryId: string, index: number) => {
                                const entry = race.race_entries?.find((e: any) => e.id === entryId);
                                return entry ? (
                                  <p key={entryId} className="text-sm text-yellow-900">
                                    {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'} {index + 1}°: <span className="font-bold">#{entry.program_number}</span> {entry.horse_name}
                                  </p>
                                ) : null;
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex space-x-2">
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
                        
                        {/* Botón para cerrar/abrir predicciones */}
                        {race.status === 'result_published' ? (
                          <span className="text-sm text-gray-400 font-medium cursor-not-allowed">
                            Resultado Publicado
                          </span>
                        ) : race.status === 'closed' ? (
                          <button
                            onClick={() => handleOpenPredictions(race.id)}
                            disabled={closingRace === race.id}
                            className="text-sm text-orange-600 hover:text-orange-800 font-medium disabled:opacity-50"
                          >
                            {closingRace === race.id ? 'Abriendo...' : 'Abrir Predicciones'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleClosePredictions(race.id)}
                            disabled={closingRace === race.id}
                            className="text-sm text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                          >
                            {closingRace === race.id ? 'Cerrando...' : 'Cerrar Predicciones'}
                          </button>
                        )}
                        
                        {/* Botón para publicar resultado */}
                        {race.status === 'result_published' ? (
                          <span className="text-sm text-gray-400 font-medium cursor-not-allowed">
                            Resultado Publicado
                          </span>
                        ) : (
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
              <div className="text-center py-12">
                <p className="text-gray-500">No hay carreras todavía</p>
              </div>
            )}
          </div>
        )}

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Miembros de la Penca</h3>
            </div>

            {memberships && memberships.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Jugador
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rol
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Se unió
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {memberships.map((member) => (
                      <tr key={member.user_id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {member.profiles.display_name}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              member.role === 'admin'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {member.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(member.joined_at).toLocaleDateString('es-UY', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">No hay miembros todavía</p>
              </div>
            )}
          </div>
        )}

        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Tabla de Posiciones</h3>
            {memberships && memberships.length > 0 ? (
              <div className="space-y-6">
                {memberships
                  .map((member) => {
                    // Calcular puntos totales del miembro desde scores
                    const memberScores = scores?.filter(s => s.user_id === member.user_id) || [];
                    const totalPoints = memberScores.reduce((sum, score) => sum + (score.points_total || 0), 0);
                    return { member, totalPoints };
                  })
                  .sort((a, b) => b.totalPoints - a.totalPoints)
                  .map(({ member, totalPoints }, index) => (
                    <div key={member.user_id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex items-center justify-center w-10 h-10">
                            {index === 0 && <span className="text-3xl">🥇</span>}
                            {index === 1 && <span className="text-3xl">🥈</span>}
                            {index === 2 && <span className="text-3xl">🥉</span>}
                            {index > 2 && (
                              <span className="text-lg font-bold text-gray-600">
                                #{index + 1}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{member.profiles?.display_name}</p>
                            <p className="text-sm text-gray-500">Se unió {new Date(member.joined_at).toLocaleDateString('es-UY')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-2xl font-bold text-indigo-600">{totalPoints} pts</p>
                          </div>
                          <button
                            onClick={() => setExpandedMember(expandedMember === member.user_id ? null : member.user_id)}
                            className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {expandedMember === member.user_id ? '▼ Ocultar' : '▶ Ver Predicciones'}
                          </button>
                        </div>
                      </div>

                      {/* Detalles de predicciones - expandible */}
                      {expandedMember === member.user_id && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <p className="text-xs font-semibold text-gray-600 uppercase mb-4">Predicciones Detalladas</p>
                          <div className="space-y-4">
                            {races.map((race) => {
                              // Obtener la predicción y el score del miembro para esta carrera
                              const memberRaceScore = scores.find(s => s.user_id === member.user_id && s.race_id === race.id);
                              const memberPrediction = predictions.find(p => p.user_id === member.user_id && p.race_id === race.id);
                              const raceResult = raceResults.find(r => r.race_id === race.id);
                              
                              return (
                                <div key={race.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                  <div className="flex justify-between items-start mb-2">
                                    <div>
                                      <p className="font-semibold text-gray-900">Carrera #{race.seq}</p>
                                      <p className="text-xs text-gray-600">{race.venue} • {race.distance_m}m</p>
                                    </div>
                                    <span className={`text-sm font-bold px-2 py-1 rounded ${
                                      memberRaceScore?.points_total 
                                        ? 'bg-green-100 text-green-700' 
                                        : race.status === 'result_published'
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-gray-200 text-gray-700'
                                    }`}>
                                      {memberRaceScore?.points_total || 0} pts
                                    </span>
                                  </div>

                                  {/* Resultado Oficial */}
                                  {raceResult && raceResult.official_order && raceResult.official_order.length > 0 && (
                                    <div className="mb-3 bg-yellow-50 border border-yellow-200 rounded p-2">
                                      <p className="text-xs font-bold text-yellow-900 mb-2">🏆 Resultado Oficial:</p>
                                      <div className="space-y-1">
                                        {raceResult.official_order.slice(0, 3).map((entryId: string, index: number) => {
                                          const entry = race.race_entries?.find((e: any) => e.id === entryId);
                                          return entry ? (
                                            <p key={entryId} className="text-xs text-yellow-900">
                                              {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'} {index + 1}°: <span className="font-bold">#{entry.program_number}</span> {entry.horse_name}
                                            </p>
                                          ) : null;
                                        })}
                                      </div>
                                      {memberRaceScore && memberRaceScore.breakdown && (
                                        <div className="mt-2 pt-2 border-t border-yellow-300">
                                          <p className="text-xs font-semibold text-yellow-900 mb-1">Puntos obtenidos:</p>
                                          <div className="space-y-0.5">
                                            {Object.entries(memberRaceScore.breakdown).map(([key, value]: [string, any]) => (
                                              <p key={key} className="text-xs text-yellow-800">
                                                {key === 'winner' ? '🎯 Ganador' : key === 'exacta' ? '🎯 Exacta' : key === 'trifecta' ? '🎯 Trifecta' : key}: <span className="font-bold">{value} pts</span>
                                              </p>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {memberPrediction ? (
                                    <div className="mt-2 space-y-2">
                                      {/* Winner Pick */}
                                      {memberPrediction.winner_entry && (
                                        <div className="bg-white rounded p-2 text-xs">
                                          <p className="text-gray-500 font-semibold mb-1">Ganador:</p>
                                          <p className="text-gray-900">
                                            <span className="font-bold">#{memberPrediction.winner_entry.program_number}</span> {memberPrediction.winner_entry.horse_name}
                                          </p>
                                        </div>
                                      )}
                                      
                                      {/* Exacta Pick */}
                                      {memberPrediction.exacta_pick && Array.isArray(memberPrediction.exacta_pick) && memberPrediction.exacta_pick.length > 0 && (
                                        <div className="bg-white rounded p-2 text-xs">
                                          <p className="text-gray-500 font-semibold mb-1">Exacta (1° y 2°):</p>
                                          <div className="space-y-1">
                                            {memberPrediction.exacta_pick.map((entryId: string, index: number) => {
                                              const entry = race.race_entries?.find((e: any) => e.id === entryId);
                                              return entry ? (
                                                <p key={entryId} className="text-gray-900">
                                                  {index + 1}°: <span className="font-bold">#{entry.program_number}</span> {entry.horse_name}
                                                </p>
                                              ) : null;
                                            })}
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* Trifecta Pick */}
                                      {memberPrediction.trifecta_pick && Array.isArray(memberPrediction.trifecta_pick) && memberPrediction.trifecta_pick.length > 0 && (
                                        <div className="bg-white rounded p-2 text-xs">
                                          <p className="text-gray-500 font-semibold mb-1">Trifecta (1°, 2° y 3°):</p>
                                          <div className="space-y-1">
                                            {memberPrediction.trifecta_pick.map((entryId: string, index: number) => {
                                              const entry = race.race_entries?.find((e: any) => e.id === entryId);
                                              return entry ? (
                                                <p key={entryId} className="text-gray-900">
                                                  {index + 1}°: <span className="font-bold">#{entry.program_number}</span> {entry.horse_name}
                                                </p>
                                              ) : null;
                                            })}
                                          </div>
                                        </div>
                                      )}

                                      {/* Status */}
                                      {race.status === 'result_published' ? (
                                        <div className="text-xs text-gray-600">
                                          <p className="text-green-600 font-semibold">✓ Resultado publicado</p>
                                        </div>
                                      ) : (
                                        <div className="text-xs text-gray-500">
                                          <p>⏳ Resultado pendiente</p>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="text-xs text-gray-400 mt-2">
                                      Sin predicción
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">No hay miembros en la penca</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
