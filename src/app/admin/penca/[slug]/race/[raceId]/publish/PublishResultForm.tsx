'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface PublishResultFormProps {
  race: any;
  entries: any[];
  slug: string;
  activeRuleset: any;
}

export default function PublishResultForm({ race, entries, slug, activeRuleset }: PublishResultFormProps) {
  const router = useRouter();
  
  // Estado para las posiciones de cada caballo
  const [positions, setPositions] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePositionChange = (entryId: string, position: string) => {
    const pos = parseInt(position);
    if (position === '' || isNaN(pos)) {
      const newPositions = { ...positions };
      delete newPositions[entryId];
      setPositions(newPositions);
    } else {
      setPositions({
        ...positions,
        [entryId]: pos,
      });
    }
  };

  const validatePositions = () => {
    const positionValues = Object.values(positions);
    
    // Debe haber al menos los 3 primeros lugares
    if (positionValues.length < 3) {
      return 'Debes ingresar al menos los primeros 3 lugares';
    }

    // Verificar que hay un 1°, 2° y 3°
    if (!positionValues.includes(1)) return 'Falta el 1° lugar';
    if (!positionValues.includes(2)) return 'Falta el 2° lugar';
    if (!positionValues.includes(3)) return 'Falta el 3° lugar';

    // Verificar que no hay posiciones duplicadas
    const uniquePositions = new Set(positionValues);
    if (uniquePositions.size !== positionValues.length) {
      return 'No puede haber posiciones duplicadas';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validatePositions();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/admin/races/${race.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          positions,
          raceId: race.id,
          pencaId: race.penca_id,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al publicar resultado');
      }

      // Esperar un momento para que la base de datos se actualice
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Redirigir de vuelta a la penca
      router.push(`/admin/penca/${slug}`);
      
      // Forzar un reload completo para obtener los datos actualizados
      window.location.href = `/admin/penca/${slug}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setLoading(false);
    }
  };

  // Ordenar caballos por número de programa
  const sortedEntries = [...entries].sort((a, b) => a.program_number - b.program_number);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Ingresa la posición final de cada caballo
        </h3>
        <p className="text-sm text-gray-600">
          Ingresa al menos los primeros 3 lugares. Puedes dejar en blanco los caballos que no terminaron o no clasificaron.
        </p>

        <div className="space-y-3">
          {sortedEntries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <div className="flex-shrink-0 w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                <span className="text-lg font-bold text-indigo-700">
                  {entry.program_number}
                </span>
              </div>
              
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{entry.horse_name}</p>
                <p className="text-sm text-gray-600">Jockey: {entry.jockey}</p>
              </div>

              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">
                  Posición:
                </label>
                <input
                  type="number"
                  min="1"
                  value={positions[entry.id] || ''}
                  onChange={(e) => handlePositionChange(entry.id, e.target.value)}
                  placeholder="-"
                  className="w-20 rounded-md border border-gray-300 px-3 py-2 text-center focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {positions[entry.id] && positions[entry.id] <= 3 && (
                <div className="flex-shrink-0">
                  {positions[entry.id] === 1 && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-yellow-100 text-yellow-800">
                      🥇 {activeRuleset?.points_top3.first || 0} pts
                    </span>
                  )}
                  {positions[entry.id] === 2 && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-gray-100 text-gray-800">
                      🥈 {activeRuleset?.points_top3.second || 0} pts
                    </span>
                  )}
                  {positions[entry.id] === 3 && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-orange-100 text-orange-800">
                      🥉 {activeRuleset?.points_top3.third || 0} pts
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      {Object.keys(positions).length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-3">Resumen del Resultado</h4>
          <div className="space-y-2">
            {Object.entries(positions)
              .sort(([, a], [, b]) => a - b)
              .map(([entryId, position]) => {
                const entry = entries.find((e) => e.id === entryId);
                return (
                  <div key={entryId} className="flex justify-between items-center text-sm">
                    <span className="text-gray-700">
                      {position}° - #{entry.program_number} {entry.horse_name}
                    </span>
                    {position <= 3 && activeRuleset && (
                      <span className="font-semibold text-indigo-600">
                        {position === 1 && `${activeRuleset.points_top3.first} puntos`}
                        {position === 2 && `${activeRuleset.points_top3.second} puntos`}
                        {position === 3 && `${activeRuleset.points_top3.third} puntos`}
                      </span>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="flex justify-end space-x-3">
        <Link
          href={`/admin/penca/${slug}`}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={loading || Object.keys(positions).length < 3}
          className="px-6 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Publicando...' : 'Publicar Resultado'}
        </button>
      </div>
    </form>
  );
}
