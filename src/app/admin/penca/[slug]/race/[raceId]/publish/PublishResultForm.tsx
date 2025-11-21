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

  // Estado para los 4 primeros lugares
  const [topFour, setTopFour] = useState<[string | null, string | null, string | null, string | null]>([null, null, null, null]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ordenar caballos por número de programa
  const sortedEntries = [...entries].sort((a, b) => a.program_number - b.program_number);

  const handlePositionChange = (position: number, entryId: string | null) => {
    const newTopFour: [string | null, string | null, string | null, string | null] = [...topFour] as any;
    newTopFour[position] = entryId;
    setTopFour(newTopFour);
  };

  const getAvailableEntries = (currentPosition: number) => {
    const selectedIds = topFour.filter((id, idx) => idx !== currentPosition && id !== null);
    return sortedEntries.filter(entry => !selectedIds.includes(entry.id));
  };

  const validateSelection = () => {
    // Verificar que todos los 4 lugares estén seleccionados
    if (topFour.some(id => id === null)) {
      return 'Debes seleccionar los 4 primeros lugares';
    }

    // Verificar que no haya duplicados (por si acaso)
    const uniqueIds = new Set(topFour);
    if (uniqueIds.size !== 4) {
      return 'No puede haber caballos duplicados';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validateSelection();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      // Convertir array a objeto positions para el API
      const positions: Record<string, number> = {};
      topFour.forEach((entryId, index) => {
        if (entryId) {
          positions[entryId] = index + 1;
        }
      });

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

  const getEntryById = (id: string | null) => {
    if (!id) return null;
    return sortedEntries.find(e => e.id === id);
  };

  const positionLabels = ['1° Lugar', '2° Lugar', '3° Lugar', '4° Lugar'];
  const medals = ['🥇', '🥈', '🥉', '4°'];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Selecciona los 4 primeros lugares
        </h3>
        <p className="text-sm text-gray-600">
          Selecciona los caballos que terminaron en las primeras 4 posiciones, en orden.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((position) => {
            const selectedEntry = getEntryById(topFour[position]);
            const availableEntries = getAvailableEntries(position);
            const points = position === 0 ? activeRuleset?.points_top3.first :
              position === 1 ? activeRuleset?.points_top3.second :
                position === 2 ? activeRuleset?.points_top3.third :
                  activeRuleset?.points_top3.fourth || 0;

            return (
              <div key={position} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{medals[position]}</span>
                    <label className="text-sm font-medium text-gray-700">
                      {positionLabels[position]}
                    </label>
                  </div>
                  {points > 0 && (
                    <span className="text-sm font-semibold text-indigo-600">
                      {points} pts
                    </span>
                  )}
                </div>

                <select
                  value={topFour[position] || ''}
                  onChange={(e) => handlePositionChange(position, e.target.value || null)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                >
                  <option value="">Seleccionar caballo...</option>
                  {availableEntries.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      #{entry.program_number} - {entry.horse_name}
                    </option>
                  ))}
                  {selectedEntry && !availableEntries.find(e => e.id === selectedEntry.id) && (
                    <option value={selectedEntry.id}>
                      #{selectedEntry.program_number} - {selectedEntry.horse_name}
                    </option>
                  )}
                </select>
              </div>
            );
          })}
        </div>
      </div>

      {/* Resumen */}
      {topFour.some(id => id !== null) && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-3">Resumen del Resultado</h4>
          <div className="space-y-2">
            {topFour.map((entryId, index) => {
              const entry = getEntryById(entryId);
              if (!entry) return null;

              const points = index === 0 ? activeRuleset?.points_top3.first :
                index === 1 ? activeRuleset?.points_top3.second :
                  index === 2 ? activeRuleset?.points_top3.third :
                    activeRuleset?.points_top3.fourth || 0;

              return (
                <div key={index} className="flex justify-between items-center text-sm">
                  <span className="text-gray-700">
                    {medals[index]} - #{entry.program_number} {entry.horse_name}
                  </span>
                  {points > 0 && (
                    <span className="font-semibold text-indigo-600">
                      {points} puntos
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
          disabled={loading || topFour.some(id => id === null)}
          className="px-6 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Publicando...' : 'Publicar Resultado'}
        </button>
      </div>
    </form>
  );
}
