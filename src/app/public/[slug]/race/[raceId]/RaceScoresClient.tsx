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
      <div className="px-4 sm:px-6 py-8 text-center text-gray-500">
        No hay predicciones registradas para esta carrera.
      </div>
    );
  }

  return (
    <>
      <div className="hidden sm:block overflow-x-auto">
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
                    <div className="font-semibold text-gray-900">
                      {row.winner}
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

      <div className="sm:hidden space-y-4 px-4">
        {rows.map((row, index) => (
          <div
            key={row.membershipId || `${row.name}-${index}`}
            className="border border-gray-200 rounded-lg p-4 bg-white"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 flex items-center justify-center">
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
                <p className="font-semibold text-gray-900">{row.name}</p>
                <p className="text-sm text-gray-500">{row.winner}</p>
              </div>
            </div>
            {row.exacta && (
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Exacta:</span> {row.exacta}
              </p>
            )}
            {row.trifecta && (
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Trifecta:</span> {row.trifecta}
              </p>
            )}
            {!row.exacta && !row.trifecta && row.winner === 'Sin predicción' && (
              <p className="text-sm text-gray-400">Sin selección enviada.</p>
            )}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-lg font-bold text-indigo-600">
                {row.points ?? 0} pts
              </span>
              {row.breakdown && (
                <div className="text-xs text-gray-500 text-right">
                  {Object.entries(row.breakdown).map(([key, value]) => (
                    <div key={key}>
                      {key}: {value}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
