'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface DeletePencaButtonProps {
  slug: string;
  name?: string | null;
  align?: 'start' | 'end';
}

export default function DeletePencaButton({
  slug,
  name,
  align = 'end',
}: DeletePencaButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    const label = name || slug;
    const confirmed = window.confirm(
      `¿Eliminar la penca "${label}"? Esta acción es irreversible.`
    );
    if (!confirmed) return;

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/admin/pencas/${slug}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Error desconocido');
      }
      router.refresh();
    } catch (err: any) {
      console.error('Failed to delete penca', err);
      setError(err.message || 'No se pudo eliminar la penca');
    } finally {
      setLoading(false);
    }
  };

  const alignmentClass =
    align === 'start' ? 'items-start text-left' : 'items-end text-right';

  return (
    <div className={`inline-flex flex-col ${alignmentClass}`}>
      <button
        type="button"
        onClick={handleDelete}
        disabled={loading}
        className="text-red-600 hover:text-red-800 disabled:opacity-60"
      >
        {loading ? 'Eliminando…' : 'Eliminar'}
      </button>
      {error && (
        <span className="mt-1 text-xs text-red-500 max-w-xs">
          {error}
        </span>
      )}
    </div>
  );
}
