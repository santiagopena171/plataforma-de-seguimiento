'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface PencaSettingsFormProps {
  slug: string;
  currentNumParticipants: number;
}

export default function PencaSettingsForm({ 
  slug, 
  currentNumParticipants 
}: PencaSettingsFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [numParticipants, setNumParticipants] = useState(currentNumParticipants);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`/api/admin/pencas/${slug}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ num_participants: numParticipants }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al actualizar');
      }

      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-800">✅ Configuración guardada correctamente</p>
        </div>
      )}

      <div>
        <label htmlFor="num_participants" className="block text-sm font-medium text-gray-900 mb-2">
          Cantidad de Miembros/Jugadores
        </label>
        <input
          type="number"
          id="num_participants"
          min="3"
          value={numParticipants}
          onChange={(e) => setNumParticipants(parseInt(e.target.value))}
          className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <p className="text-sm text-gray-500 mt-2">
          Define cuantos miembros/jugadores puede tener esta penca (minimo 3, sin maximo).
          Se mostraran estos espacios en la seccion de Miembros para agregar personas.
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Guardando...' : 'Guardar Configuración'}
        </button>
      </div>
    </form>
  );
}
