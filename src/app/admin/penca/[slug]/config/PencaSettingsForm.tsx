'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface TrackOption {
  racetrack_id: number;
  name: string;
  race_count: number;
}

interface PencaSettingsFormProps {
  slug: string;
  currentNumParticipants: number;
  currentExternalResultsUrl?: string;
  currentSyncInterval?: number;
  currentRacetrackId?: number | null;
  lastSyncAt?: string;
}

export default function PencaSettingsForm({
  slug,
  currentNumParticipants,
  currentExternalResultsUrl = '',
  currentSyncInterval = 0,
  currentRacetrackId = null,
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
  const [countdown, setCountdown] = useState<string>('');

  // Estado para búsqueda de hipódromos
  const [searchingTracks, setSearchingTracks] = useState(false);
  const [availableTracks, setAvailableTracks] = useState<TrackOption[]>([]);
  const [selectedRacetrackId, setSelectedRacetrackId] = useState<number | null>(currentRacetrackId ?? null);
  const [tracksSearchError, setTracksSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (syncInterval === 0) {
      setCountdown('');
      return;
    }

    const updateCountdown = () => {
      const now = new Date();
      let targetDate: Date;

      if (!lastSyncAt) {
        // Si no hay última sincronización, la próxima será en el siguiente ciclo de 15 min de Vercel
        const next15 = new Date(now);
        const minutes = next15.getMinutes();
        const nextTick = Math.ceil((minutes + 0.1) / 15) * 15;
        next15.setMinutes(nextTick, 0, 0);
        targetDate = next15;
      } else {
        const lastDate = new Date(lastSyncAt);
        targetDate = new Date(lastDate.getTime() + Number(syncInterval) * 60000);
      }

      const diff = targetDate.getTime() - now.getTime();

      if (diff <= 0) {
        setCountdown('En proceso...');
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setCountdown(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [syncInterval, lastSyncAt]);

  const handleSearchTracks = async () => {
    setSearchingTracks(true);
    setTracksSearchError(null);
    setAvailableTracks([]);

    try {
      const res = await fetch(`/api/admin/pencas/${slug}/find-hipodromos`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al buscar hipódromos');
      }

      if (!data.tracks || data.tracks.length === 0) {
        setTracksSearchError(`No se encontraron hipódromos con carreras para la fecha en la URL (${data.racingDate}). Verificá que la URL tenga resultados publicados.`);
      } else {
        setAvailableTracks(data.tracks);
        // Si solo hay uno, seleccionarlo automáticamente
        if (data.tracks.length === 1 && selectedRacetrackId === null) {
          setSelectedRacetrackId(data.tracks[0].racetrack_id);
        }
      }
    } catch (err) {
      setTracksSearchError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSearchingTracks(false);
    }
  };

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
          sync_interval_minutes: syncInterval,
          racetrack_id: selectedRacetrackId,
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

  const getNextSync = () => {
    const interval = Number(syncInterval);
    if (interval === 0) return null;

    if (!lastSyncAt) return 'Se calculará tras el primer ciclo automático';

    try {
      const lastDate = new Date(lastSyncAt);
      if (isNaN(lastDate.getTime())) return 'Fecha de sincronización previa no válida';

      const nextDate = new Date(lastDate.getTime() + interval * 60000);
      const now = new Date();

      if (nextDate <= now) {
        return 'En cualquier momento (esperando ciclo del servidor)';
      }

      const isToday = nextDate.toDateString() === now.toDateString();

      return nextDate.toLocaleString('es-UY', {
        day: isToday ? undefined : '2-digit',
        month: isToday ? undefined : '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }) + (isToday ? ' (hoy)' : '');
    } catch (e) {
      console.error('Error calculando próxima sincronización:', e);
      return 'Error al calcular';
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Nunca';
    return new Date(dateStr).toLocaleString('es-UY', {
      day: '2-digit',
      month: '2-digit',
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
          <p className="text-sm text-green-800">✅ Operación completada correctamente. El sistema procesará los cambios en el próximo ciclo.</p>
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

      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-1">Hipódromo para sincronización</h4>
          <p className="text-xs text-gray-600 mb-3">
            Si hay carreras en más de un hipódromo el mismo día, seleccioná el que corresponde a esta penca.
            Si no seleccionás ninguno, se usará el primero que tenga resultados publicados.
          </p>

          {selectedRacetrackId !== null && availableTracks.length === 0 && (
            <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded px-3 py-2 mb-3">
              <span className="text-xs text-indigo-800">
                🏇 Hipódromo configurado: <strong>ID {selectedRacetrackId}</strong>
              </span>
              <button
                type="button"
                onClick={() => setSelectedRacetrackId(null)}
                className="text-xs text-red-600 hover:text-red-800 ml-4"
              >
                Limpiar
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleSearchTracks}
            disabled={searchingTracks || !externalResultsUrl}
            className="px-4 py-2 bg-white border border-gray-400 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {searchingTracks ? 'Buscando...' : 'Buscar hipódromos disponibles'}
          </button>

          {tracksSearchError && (
            <p className="text-xs text-red-700 mt-2 bg-red-50 border border-red-200 rounded px-3 py-2">
              ⚠️ {tracksSearchError}
            </p>
          )}

          {availableTracks.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium text-gray-700">Seleccioná el hipódromo:</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="racetrack"
                  value={-1}
                  checked={selectedRacetrackId === null}
                  onChange={() => setSelectedRacetrackId(null)}
                  className="accent-indigo-600"
                />
                <span className="text-sm text-gray-700">Auto-detectar (tomar el primero disponible)</span>
              </label>
              {availableTracks.map((track) => (
                <label key={track.racetrack_id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="racetrack"
                    value={track.racetrack_id}
                    checked={selectedRacetrackId === track.racetrack_id}
                    onChange={() => setSelectedRacetrackId(track.racetrack_id)}
                    className="accent-indigo-600"
                  />
                  <span className="text-sm text-gray-700">
                    <strong>{track.name}</strong>
                    <span className="text-gray-500 ml-2">({track.race_count} carrera{track.race_count !== 1 ? 's' : ''})</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="text-sm font-semibold text-blue-900 mb-1">Nota sobre Sincronización Automática</h4>
        <p className="text-xs text-blue-800">
          La sincronización automática se ejecuta en segundo plano. Al cambiar la frecuencia, el sistema programará la próxima ejecución. Asegúrate de que el link de Excel sea correcto para evitar fallos.
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
          {Number(syncInterval) > 0 && (
            <div className="mt-2 flex flex-col space-y-1">
              <p className="text-xs text-indigo-600 font-medium bg-indigo-50/50 p-2 rounded border border-indigo-100 flex justify-between items-center">
                <span>🕒 Próxima ejecución estimada:</span>
                <span className="font-bold text-sm tracking-widest bg-white px-2 py-0.5 rounded shadow-sm border border-indigo-200">
                  {countdown}
                </span>
              </p>
              <p className="text-[10px] text-gray-400 italic">
                * Hora programada: {getNextSync()}
              </p>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Acción Manual
          </label>
          <button
            type="button"
            onClick={handleManualSync}
            disabled={syncing || !externalResultsUrl}
            className="w-full px-4 py-2 bg-white border border-indigo-600 text-indigo-600 font-medium rounded-md hover:bg-indigo-50 disabled:border-gray-300 disabled:text-gray-400 disabled:bg-gray-50 transition-colors shadow-sm"
          >
            {syncing ? 'Sincronizando...' : 'Sincronizar Resultados Ahora'}
          </button>
          <p className="text-xs text-gray-500 mt-2 flex justify-between">
            <span>Última sincronización: <span className="font-semibold">{formatDate(lastSyncAt)}</span></span>
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

