'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DeleteRaceButton({ raceId, slug }: { raceId: string; slug: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/races/${raceId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        console.error('Error al eliminar:', data);
        alert(data.error || 'Error al eliminar la carrera');
        return;
      }

      // Recargar la página completa para refrescar los datos
      window.location.reload();
    } catch (err) {
      console.error('Error en handleDelete:', err);
      alert(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  if (showConfirm) {
    return (
      <div className="flex gap-2">
        <button
          onClick={handleDelete}
          disabled={loading}
          className="px-3 py-1 text-sm text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded"
        >
          {loading ? 'Eliminando...' : 'Confirmar'}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          disabled={loading}
          className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="px-3 py-1 text-sm text-red-600 hover:text-red-800"
    >
      Eliminar
    </button>
  );
}
