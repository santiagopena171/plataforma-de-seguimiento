'use client';

import { useState } from 'react';
import Link from 'next/link';
import DeleteRaceButton from '@/components/DeleteRaceButton';

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

interface PencaTabsProps {
  pencaSlug: string;
  races: Race[];
  memberships: Member[];
  invitesCount: number;
}

export default function PencaTabs({ pencaSlug, races, memberships, invitesCount }: PencaTabsProps) {
  const [activeTab, setActiveTab] = useState<'races' | 'members' | 'invites'>('races');

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
            onClick={() => setActiveTab('invites')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'invites'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Invitaciones ({invitesCount})
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
                {races.map((race) => (
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
                            {new Date(race.start_at).toLocaleString('es-UY', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </p>
                          <p>🐴 {race.race_entries?.length || 0} caballos</p>
                        </div>
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
                        <Link
                          href={`/admin/penca/${pencaSlug}/race/${race.id}/publish`}
                          className="text-sm text-green-600 hover:text-green-800 font-medium"
                        >
                          Publicar Resultado
                        </Link>
                            <DeleteRaceButton raceId={race.id} slug={pencaSlug} />
                      </div>
                    </div>
                  </div>
                ))}
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

        {/* Invites Tab */}
        {activeTab === 'invites' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Invitaciones</h3>
            </div>
            <div className="text-center py-12">
              <p className="text-gray-500">
                Funcionalidad de invitaciones próximamente
              </p>
              <p className="text-sm text-gray-400 mt-2">
                Por ahora los usuarios pueden unirse usando el código: <span className="font-mono font-bold">{pencaSlug}</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
