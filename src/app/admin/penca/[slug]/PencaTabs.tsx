'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DeleteRaceButton from '@/components/DeleteRaceButton';
import AddMemberModal from './AddMemberModal';

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
  id: string;
  user_id: string | null;
  guest_name?: string | null;
  role: string;
  joined_at: string;
  profiles?: {
    id: string;
    display_name: string;
    avatar_url?: string | null;
  } | null;
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
  numParticipants: number;
  scores: Score[];
  predictions: Prediction[];
  raceResults: RaceResult[];
  invitesCount: number;
}

export default function PencaTabs({ pencaSlug, races, memberships, numParticipants, scores, predictions, raceResults, invitesCount }: PencaTabsProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'races' | 'members' | 'leaderboard'>('races');
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [closingRace, setClosingRace] = useState<string | null>(null);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);

  // Filtrar solo miembros no-admin (jugadores reales)
  const actualMembers = memberships?.filter(m => m.role !== 'admin') || [];
  const adminMembers = memberships?.filter(m => m.role === 'admin') || [];

  const handleAddMember = async (guestName: string) => {
    try {
      const response = await fetch(`/api/admin/pencas/${pencaSlug}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestName }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al agregar miembro');
      }

      // Recargar la página para mostrar el nuevo miembro
      router.refresh();
    } catch (error: any) {
      throw error;
    }
  };

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
            Miembros ({actualMembers.length}/{numParticipants})
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
                  // Predicciones asociadas a esta carrera (todas las predicciones pasadas al componente)
                  const predsForRace = (predictions || []).filter((p: any) => p.race_id === race.id);
                  // Contar predicciones únicas por membership_id o user_id
                  const uniquePredKeys = new Set(predsForRace.map((p: any) => p.membership_id || p.user_id)).size;
                  
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
                                    {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'} {index + 1}°: <span className="font-bold">Caballo #{entry.program_number}</span>
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
                          // Si ya hay predicciones (para todos los miembros) mostrar etiqueta en vez de link
                          uniquePredKeys >= actualMembers.length ? (
                            <span className="text-sm text-gray-500 font-medium">Predicciones Creadas</span>
                          ) : (
                            // Enlace para que el admin cree/ingrese predicciones para todos los miembros
                            <Link
                              href={`/admin/penca/${pencaSlug}/race/${race.id}/predictions`}
                              className="text-sm text-red-600 hover:text-red-800 font-medium"
                            >
                              Crear Predicciones
                            </Link>
                          )
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
              <p className="text-sm text-gray-500">
                {actualMembers.length} de {numParticipants} espacios ocupados
              </p>
            </div>

            {actualMembers.length > 0 ? (
              <div className="space-y-4">
                {/* Miembros actuales */}
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
                      {actualMembers.map((member) => (
                        <tr key={member.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {member.guest_name || member.profiles?.display_name || 'Sin nombre'}
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

                {/* Espacios vacíos */}
                {numParticipants > actualMembers.length && (
                  <div className="mt-6">
                    <h4 className="text-md font-medium text-gray-700 mb-3">Espacios Disponibles</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Array(numParticipants - actualMembers.length)
                        .fill(null)
                        .map((_, i) => (
                          <div
                            key={`empty-${i}`}
                            className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
                          >
                            <svg
                              className="w-12 h-12 text-gray-400 mb-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                              />
                            </svg>
                            <p className="text-gray-400 text-center mb-2">Espacio disponible</p>
                            <button 
                              onClick={() => setIsAddMemberModalOpen(true)}
                              className="mt-2 px-4 py-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-300 rounded-md hover:bg-indigo-50 transition-colors"
                            >
                              + Agregar miembro
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No hay miembros todavía</p>
                <div className="mt-6">
                  <h4 className="text-md font-medium text-gray-700 mb-3">Espacios Disponibles ({numParticipants})</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array(numParticipants)
                      .fill(null)
                      .map((_, i) => (
                        <div
                          key={`empty-${i}`}
                          className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
                        >
                          <svg
                            className="w-12 h-12 text-gray-400 mb-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                          <p className="text-gray-400 text-center mb-2">Espacio disponible</p>
                          <button 
                            onClick={() => setIsAddMemberModalOpen(true)}
                            className="mt-2 px-4 py-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-300 rounded-md hover:bg-indigo-50 transition-colors"
                          >
                            + Agregar miembro
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Tabla de Posiciones</h3>
            {actualMembers.length > 0 ? (
              <div className="space-y-6">
                {actualMembers
                  .map((member) => {
                    // Calcular puntos totales del miembro desde scores
                    // Soportar tanto scores por user_id como por membership_id (invitados/guest)
                    const memberScores = scores?.filter((s: Score) => (s.user_id && s.user_id === member.user_id) || (s as any).membership_id === member.id) || [];
                    const totalPoints = memberScores.reduce((sum, score) => sum + (score.points_total || 0), 0);
                    return { member, totalPoints };
                  })
                  .sort((a, b) => b.totalPoints - a.totalPoints)
                  .map(({ member, totalPoints }, index) => (
                    <div key={member.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
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
                            <p className="font-semibold text-gray-900">
                              {member.guest_name || member.profiles?.display_name || 'Sin nombre'}
                            </p>
                            <p className="text-sm text-gray-500">Se unió {new Date(member.joined_at).toLocaleDateString('es-UY')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-2xl font-bold text-indigo-600">{totalPoints} pts</p>
                          </div>
                          <button
                            onClick={() => setExpandedMember(expandedMember === member.id ? null : member.id)}
                            className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {expandedMember === member.id ? '▼ Ocultar' : '▶ Ver Predicciones'}
                          </button>
                        </div>
                      </div>

                      {/* Detalles de predicciones - expandible */}
                      {expandedMember === member.id && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <p className="text-xs font-semibold text-gray-600 uppercase mb-4">Predicciones Detalladas</p>
                          <div className="space-y-4">
                            {races.map((race) => {
                              // Obtener la predicción y el score del miembro para esta carrera
                              // Encontrar score/ prediction por user_id o por membership_id (invitados)
                              const memberRaceScore = scores.find(s => ((s.user_id && s.user_id === member.user_id) || (s as any).membership_id === member.id) && s.race_id === race.id);
                              const memberPrediction = predictions.find(p => ((p.user_id && p.user_id === member.user_id) || (p as any).membership_id === member.id) && p.race_id === race.id);
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
                                              {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'} {index + 1}°: <span className="font-bold">Caballo #{entry.program_number}</span>
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

      {/* Modal para agregar miembro */}
      <AddMemberModal
        isOpen={isAddMemberModalOpen}
        onClose={() => setIsAddMemberModalOpen(false)}
        onAdd={handleAddMember}
        pencaSlug={pencaSlug}
      />
    </div>
  );
}
