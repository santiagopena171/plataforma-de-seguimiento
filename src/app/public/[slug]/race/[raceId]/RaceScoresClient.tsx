'use client';

import { useEffect, useState } from 'react';

interface ScoreRow {
  membershipId: string | null;
  name: string;
  winner: string;
  exacta: string | null;
  trifecta: string | null;
  points: number;
  breakdown: Record<string, number> | null;
}

interface RaceScoresClientProps {
  raceId: string;
}

export default function RaceScoresClient({ raceId }: RaceScoresClientProps) {
  const [rows, setRows] = useState<ScoreRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchScores = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/public/races/${raceId}/scores`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) {
          setRows(data.rows || []);
          setError(null);
        }
      } catch (err) {
        console.error('Failed to load race scores', err);
        if (!cancelled) {
          setError('No se pudieron cargar las puntuaciones.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchScores();
    return () => {
      cancelled = true;
    };
  }, [raceId]);

  if (loading) {
    return (
      <div className="px-6 py-8 text-center text-gray-500">
        Cargando puntuaciones...
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-6 py-8 text-center text-red-500">
        {error}
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="px-6 py-8 text-center text-gray-500">
        No hay predicciones registradas para esta carrera.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Posición
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Jugador
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Predicción
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Puntos
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {rows.map((row, index) => (
            <tr key={row.membershipId || `${row.name}-${index}`}>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {index === 0 && '🥇'}
                {index === 1 && '🥈'}
                {index === 2 && '🥉'}
                {index > 2 && `${index + 1}°`}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {row.name}
              </td>
              <td className="px-6 py-4 text-sm text-gray-700">
                <div className="space-y-2">
                  <div>
                    <span className="text-xs uppercase text-gray-500">
                      Ganador
                    </span>
                    <span className="ml-2 font-semibold text-gray-900">
                      {row.winner}
                    </span>
                  </div>
                  {row.exacta && (
                    <div>
                      <span className="text-xs uppercase text-gray-500">
                        Exacta
                      </span>
                      <span className="ml-2 text-gray-900">{row.exacta}</span>
                    </div>
                  )}
                  {row.trifecta && (
                    <div>
                      <span className="text-xs uppercase text-gray-500">
                        Trifecta
                      </span>
                      <span className="ml-2 text-gray-900">{row.trifecta}</span>
                    </div>
                  )}
                  {!row.exacta && !row.trifecta && row.winner === 'Sin predicción' && (
                    <p className="text-gray-400">Sin selección enviada.</p>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-center">
                <div className="text-lg">{row.points ?? 0} pts</div>
                {row.breakdown && (
                  <div className="mt-2 flex flex-wrap gap-2 justify-center text-xs text-gray-500">
                    {Object.entries(row.breakdown).map(([key, value]) => (
                      <span
                        key={key}
                        className="px-2 py-0.5 bg-gray-100 rounded-full"
                      >
                        {key}: {value}
                      </span>
                    ))}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
