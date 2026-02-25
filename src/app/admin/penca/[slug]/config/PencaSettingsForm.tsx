'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface PencaSettingsFormProps {
  slug: string;
  currentNumParticipants: number;
  currentExternalResultsUrl?: string;
  currentSyncInterval?: number;
  lastSyncAt?: string;
}

export default function PencaSettingsForm({
  slug,
  currentNumParticipants,
  currentExternalResultsUrl = '',
  currentSyncInterval = 0,
  lastSyncAt
}: PencaSettingsFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [numParticipants, setNumParticipants] = useState(currentNumParticipants);
  const [externalResultsUrl, setExternalResultsUrl] = useState(currentExternalResultsUrl);
  const [syncInterval, setSyncInterval] = useState(currentSyncInterval);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`/api/admin/pencas/${slug}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          num_participants: numParticipants,
          external_results_url: externalResultsUrl,
          sync_interval_minutes: syncInterval
        }),
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

  const handleManualSync = async () => {
    setSyncing(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`/api/admin/pencas/${slug}/sync`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error en la sincronización');
      }

      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Nunca';
    return new Date(dateStr).toLocaleString('es-UY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
          <p className="text-sm text-green-800">✅ Operación completada correctamente</p>
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
          Se mostraran estos espacios en la seccion de Miembros para agregar personas.
        </p>
      </div>

      <div>
        <label htmlFor="external_results_url" className="block text-sm font-medium text-gray-900 mb-2">
          Link de Resultados Excel
        </label>
        <input
          type="url"
          id="external_results_url"
          value={externalResultsUrl}
          onChange={(e) => setExternalResultsUrl(e.target.value)}
          placeholder="https://hipica.maronas.com.uy/RacingInfo/RacingDate?RacingDate=..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <p className="text-sm text-gray-500 mt-2">
          URL de la página de resultados de Maroñas para la automatización.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div>
          <label htmlFor="sync_interval" className="block text-sm font-medium text-gray-900 mb-2">
            Frecuencia de Sincronización Automática
          </label>
          <select
            id="sync_interval"
            value={syncInterval}
            onChange={(e) => setSyncInterval(parseInt(e.target.value))}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value={0}>Desactivado (Solo manual)</option>
            <option value={15}>Cada 15 minutos</option>
            <option value={30}>Cada 30 minutos</option>
            <option value={60}>Cada hora</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Acción Manual
          </label>
          <button
            type="button"
            onClick={handleManualSync}
            disabled={syncing || !externalResultsUrl}
            className="w-full px-4 py-2 bg-white border border-indigo-600 text-indigo-600 font-medium rounded-md hover:bg-indigo-50 disabled:border-gray-300 disabled:text-gray-400 disabled:bg-gray-50 transition-colors"
          >
            {syncing ? 'Sincronizando...' : 'Sincronizar Resultados Ahora'}
          </button>
          <p className="text-xs text-gray-500 mt-2">
            Última sincronización: <span className="font-semibold">{formatDate(lastSyncAt)}</span>
          </p>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-sm"
        >
          {loading ? 'Guardando...' : 'Guardar Configuración General'}
        </button>
      </div>
    </form>
  );
}

