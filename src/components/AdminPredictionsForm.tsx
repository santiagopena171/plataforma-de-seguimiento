'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Player {
  membership_id: string;
  user_id: string | null;
  name: string;
  is_guest: boolean;
}

interface Entry {
  id: string;
  number: number;
  label: string;
}

interface AdminPredictionsProps {
  raceId: string;
  pencaSlug: string;
  players: Player[];
  entries: Entry[];
  existingPredictions?: Record<string, {
    winner_pick: string;
    exacta_pick: string[];
    trifecta_pick: string[];
  }>;
}

export default function AdminPredictionsForm({
  raceId,
  pencaSlug,
  players,
  entries,
  existingPredictions = {},
}: AdminPredictionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Estado: predicciones por jugador
  const [predictions, setPredictions] = useState<Record<string, {
    winner: string;
  }>>({});

  // Inicializar predicciones (vacías o con existentes)
  useEffect(() => {
    const initial: Record<string, any> = {};
    players.forEach((player) => {
      const key = player.membership_id;
      const existing = existingPredictions[key];

      initial[key] = {
        winner: existing?.winner_pick || '',
      };
    });
    setPredictions(initial);
  }, [players, existingPredictions]);

  const handlePredictionChange = (
    membershipId: string,
    value: string
  ) => {
    setPredictions({
      ...predictions,
      [membershipId]: {
        ...predictions[membershipId],
        winner: value,
      },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Validar que todas las predicciones tengan ganador
      for (const player of players) {
        const pred = predictions[player.membership_id];
        if (!pred?.winner || pred.winner.trim() === '') {
          throw new Error(`Falta seleccionar el ganador para ${player.name}`);
        }
      }

      // Enviar predicciones al servidor (solo las que tienen valores válidos)
      const validPredictions = Object.entries(predictions)
        .filter(([_, pred]) => pred.winner && pred.winner.trim() !== '')
        .map(([membershipId, pred]) => {
          const player = players.find(p => p.membership_id === membershipId);
          return {
            membership_id: membershipId,
            user_id: player?.user_id || null,
            winner_pick: pred.winner,
            exacta_pick: null,
            trifecta_pick: null,
            entered_by_admin: true,
          };
        });

      if (validPredictions.length === 0) {
        throw new Error('No hay predicciones válidas para guardar');
      }

      const response = await fetch(`/api/admin/races/${raceId}/batch-predictions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          predictions: validPredictions,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al guardar las predicciones');
      }

      setSuccess(true);
      setTimeout(() => {
        // Forzar recarga completa para que se actualicen los datos
        window.location.href = `/admin/penca/${pencaSlug}`;
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Ingresar Predicciones</h2>
        <p className="text-sm text-gray-600 mt-1">
          Ingresa las predicciones de cada jugador para esta carrera
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-green-800">✅ Predicciones guardadas correctamente</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {players.map((player) => (
          <div key={player.membership_id} className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-4">
              {player.name}
              {player.is_guest && (
                <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  Guest
                </span>
              )}
            </h3>

            <div className="grid grid-cols-1 gap-4">
              {/* Winner (only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  � Seleccionar Ganador
                </label>
                <select
                  value={predictions[player.membership_id]?.winner || ''}
                  onChange={(e) => handlePredictionChange(player.membership_id, e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                >
                  <option value="">Seleccionar...</option>
                  {entries.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ))}

        {/* Submit */}
        <div className="flex gap-4">
          <Link
            href={`/admin/penca/${pencaSlug}`}
            className="flex-1 px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-50 text-center"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400"
          >
            {loading ? 'Guardando...' : 'Guardar Predicciones'}
          </button>
        </div>
      </form>
    </div>
  );
}
