'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface SimplifiedRaceFormProps {
  pencaSlug: string;
  pencaId: string;
  numParticipants: number; // Viene de la configuración de la penca
}

export default function SimplifiedRaceForm({ pencaSlug, pencaId, numParticipants }: SimplifiedRaceFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    venue: '',
    distance_m: '',
    start_date: '',
    start_time: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Crear la carrera
      const raceResponse = await fetch(`/api/admin/pencas/${pencaSlug}/races`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          penca_id: pencaId,
          venue: formData.venue,
          distance_m: parseInt(formData.distance_m),
          start_at: `${formData.start_date}T${formData.start_time}:00`,
        }),
      });

      if (!raceResponse.ok) {
        throw new Error('Error al crear la carrera');
      }

      const newRace = await raceResponse.json();

      // No crear participantes autom�ticos; redirigir a la pantalla de edici�n
      router.push(`/admin/penca/${pencaSlug}/race/${newRace.id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Nueva Carrera (Simplificada)</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Venue */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Hipódromo
          </label>
          <input
            type="text"
            value={formData.venue}
            onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="Ej: Maroñas, Las Piedras"
            required
          />
        </div>

        {/* Distance */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Distancia (metros)
          </label>
          <input
            type="number"
            value={formData.distance_m}
            onChange={(e) => setFormData({ ...formData, distance_m: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="Ej: 1200"
            required
          />
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Fecha
          </label>
          <input
            type="date"
            value={formData.start_date}
            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            required
          />
        </div>

        {/* Time */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Hora
          </label>
          <input
            type="time"
            value={formData.start_time}
            onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            required
          />
        </div>

        {/* Info: Number of participants */}
        <div className="hidden">
          <p className="text-sm text-blue-800">
            ℹ️ Esta carrera tendrá <strong>{numParticipants} caballos</strong> (configurado en la penca).
            Los caballos se numerarán del 1 al {numParticipants}.
          </p>
        </div>

        {/* Submit */}
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400"
          >
            {loading ? 'Creando...' : 'Crear Carrera →'}
          </button>
        </div>
      </form>
    </div>
  );
}


