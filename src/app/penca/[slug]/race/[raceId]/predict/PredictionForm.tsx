'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Horse {
  id: string;
  program_number: number;
  horse_name: string;
  jockey?: string;
  trainer?: string;
}

interface PredictionFormProps {
  raceId: string;
  userId: string;
  horses: Horse[];
  modalities: string[];
  existingPrediction?: any;
  isClosed: boolean;
  pencaSlug: string;
}

export default function PredictionForm({
  raceId,
  userId,
  horses,
  modalities,
  existingPrediction,
  isClosed,
  pencaSlug,
}: PredictionFormProps) {
  const router = useRouter();

  const [prediction, setPrediction] = useState({
    winner_pick: existingPrediction?.winner_pick || null,
    exacta_first: existingPrediction?.exacta_pick?.[0] || null,
    exacta_second: existingPrediction?.exacta_pick?.[1] || null,
    trifecta_first: existingPrediction?.trifecta_pick?.[0] || null,
    trifecta_second: existingPrediction?.trifecta_pick?.[1] || null,
    trifecta_third: existingPrediction?.trifecta_pick?.[2] || null,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasWinner = modalities.includes('winner');
  const hasExacta = modalities.includes('exacta');
  const hasTrifecta = modalities.includes('trifecta');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validaciones
    if (hasWinner && !prediction.winner_pick) {
      setError('Debes seleccionar un ganador');
      setLoading(false);
      return;
    }

    if (hasExacta && (!prediction.exacta_first || !prediction.exacta_second)) {
      setError('Debes seleccionar 1° y 2° para exacta');
      setLoading(false);
      return;
    }

    if (hasExacta && prediction.exacta_first === prediction.exacta_second) {
      setError('Los caballos de exacta deben ser diferentes');
      setLoading(false);
      return;
    }

    if (hasTrifecta && (!prediction.trifecta_first || !prediction.trifecta_second || !prediction.trifecta_third)) {
      setError('Debes seleccionar 1°, 2° y 3° para trifecta');
      setLoading(false);
      return;
    }

    if (hasTrifecta) {
      const trifectaSet = new Set([prediction.trifecta_first, prediction.trifecta_second, prediction.trifecta_third]);
      if (trifectaSet.size !== 3) {
        setError('Los caballos de trifecta deben ser diferentes');
        setLoading(false);
        return;
      }
    }

    try {
      const response = await fetch('/api/predictions', {
        method: existingPrediction ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          race_id: raceId,
          user_id: userId,
          ...prediction,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al guardar la predicción');
      }

      router.push(`/penca/${pencaSlug}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const getHorseName = (entryId: string | null) => {
    if (!entryId) return '';
    const horse = horses.find(h => h.id === entryId);
    return horse ? `#${horse.program_number} ${horse.horse_name}` : '';
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Winner */}
      {hasWinner && (
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            🏆 Winner (Ganador)
          </label>
          <select
            value={prediction.winner_pick || ''}
            onChange={(e) => setPrediction({ ...prediction, winner_pick: e.target.value || null })}
            disabled={isClosed}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
          >
            <option value="">Selecciona el ganador</option>
            {horses.map((horse) => (
              <option key={horse.id} value={horse.id}>
                #{horse.program_number} - {horse.horse_name} {horse.jockey ? `(${horse.jockey})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Exacta */}
      {hasExacta && (
        <div className="border-t pt-6">
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            🥇🥈 Exacta (1° y 2° en orden)
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">1° Puesto</label>
              <select
                value={prediction.exacta_first || ''}
                onChange={(e) => setPrediction({ ...prediction, exacta_first: e.target.value || null })}
                disabled={isClosed}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
              >
                <option value="">Selecciona 1°</option>
                {horses.map((horse) => (
                  <option key={horse.id} value={horse.id}>
                    #{horse.program_number} - {horse.horse_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">2° Puesto</label>
              <select
                value={prediction.exacta_second || ''}
                onChange={(e) => setPrediction({ ...prediction, exacta_second: e.target.value || null })}
                disabled={isClosed}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
              >
                <option value="">Selecciona 2°</option>
                {horses.map((horse) => (
                  <option key={horse.id} value={horse.id}>
                    #{horse.program_number} - {horse.horse_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Trifecta */}
      {hasTrifecta && (
        <div className="border-t pt-6">
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            🥇🥈🥉 Trifecta (1°, 2° y 3° en orden)
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">1° Puesto</label>
              <select
                value={prediction.trifecta_first || ''}
                onChange={(e) => setPrediction({ ...prediction, trifecta_first: e.target.value || null })}
                disabled={isClosed}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
              >
                <option value="">Selecciona 1°</option>
                {horses.map((horse) => (
                  <option key={horse.id} value={horse.id}>
                    #{horse.program_number} - {horse.horse_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">2° Puesto</label>
              <select
                value={prediction.trifecta_second || ''}
                onChange={(e) => setPrediction({ ...prediction, trifecta_second: e.target.value || null })}
                disabled={isClosed}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
              >
                <option value="">Selecciona 2°</option>
                {horses.map((horse) => (
                  <option key={horse.id} value={horse.id}>
                    #{horse.program_number} - {horse.horse_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">3° Puesto</label>
              <select
                value={prediction.trifecta_third || ''}
                onChange={(e) => setPrediction({ ...prediction, trifecta_third: e.target.value || null })}
                disabled={isClosed}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
              >
                <option value="">Selecciona 3°</option>
                {horses.map((horse) => (
                  <option key={horse.id} value={horse.id}>
                    #{horse.program_number} - {horse.horse_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="flex justify-end space-x-3 pt-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Cancelar
        </button>
        {!isClosed && (
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400"
          >
            {loading ? 'Guardando...' : existingPrediction ? 'Actualizar Predicción' : 'Guardar Predicción'}
          </button>
        )}
      </div>
    </form>
  );
}
