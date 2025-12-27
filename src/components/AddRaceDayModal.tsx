'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface AddRaceDayModalProps {
  pencaSlug: string;
  pencaId: string;
  onClose: () => void;
  existingDays: Array<{ day_number: number; day_name: string }>;
}

export default function AddRaceDayModal({ pencaSlug, pencaId, onClose, existingDays }: AddRaceDayModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    dayName: '',
    numRaces: 1,
  });

  // Calcular el próximo número de día
  const nextDayNumber = existingDays.length > 0 
    ? Math.max(...existingDays.map(d => d.day_number)) + 1 
    : 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/pencas/${pencaSlug}/race-days`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day_number: nextDayNumber,
          day_name: formData.dayName,
          num_races: formData.numRaces,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear el día');
      }

      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Agregar Día</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Número de Día
            </label>
            <input
              type="text"
              value={`Día ${nextDayNumber}`}
              disabled
              className="w-full rounded-md border border-gray-300 px-3 py-2 bg-gray-50 text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre del Día *
            </label>
            <input
              type="text"
              value={formData.dayName}
              onChange={(e) => setFormData({ ...formData, dayName: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="ej: Sábado, Clásicos, Jornada 1"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cantidad de Carreras *
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={formData.numRaces}
              onChange={(e) => setFormData({ ...formData, numRaces: parseInt(e.target.value) || 1 })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Se crearán las carreras automáticamente con 15 caballos cada una
            </p>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400"
            >
              {loading ? 'Creando...' : 'Crear Día'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
