'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface CreatePencaFormProps {
  userId: string;
}

export default function CreatePencaForm({ userId }: CreatePencaFormProps) {
  const router = useRouter();
  
  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    status: 'open' as 'open' | 'closed' | 'active',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remover acentos
      .replace(/[^a-z0-9\s-]/g, '') // Solo letras, números, espacios y guiones
      .trim()
      .replace(/\s+/g, '-') // Espacios a guiones
      .replace(/-+/g, '-'); // Múltiples guiones a uno solo
  };

  const handleNameChange = (name: string) => {
    setForm({
      ...form,
      name,
      slug: generateSlug(name),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validaciones
    if (!form.name.trim()) {
      setError('El nombre es requerido');
      setLoading(false);
      return;
    }

    if (!form.slug.trim()) {
      setError('El slug es requerido');
      setLoading(false);
      return;
    }

    if (form.slug.length < 3) {
      setError('El slug debe tener al menos 3 caracteres');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/admin/pencas/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          created_by: userId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al crear la penca');
      }

      const data = await response.json();
      
      // Redirigir a la penca recién creada
      router.push(`/admin/penca/${data.slug}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
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

      {/* Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
          Nombre de la Penca *
        </label>
        <input
          type="text"
          id="name"
          value={form.name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Ej: Penca de Maroñas 2025"
          className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          required
        />
        <p className="text-sm text-gray-500 mt-1">
          Nombre público que verán los participantes
        </p>
      </div>

      {/* Slug */}
      <div>
        <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-2">
          Slug (URL) *
        </label>
        <div className="flex">
          <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
            /penca/
          </span>
          <input
            type="text"
            id="slug"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder="penca-maronas-2025"
            className="flex-1 rounded-r-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            pattern="[a-z0-9-]+"
            required
          />
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Solo letras minúsculas, números y guiones. Se genera automáticamente del nombre.
        </p>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
          Descripción
        </label>
        <textarea
          id="description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Descripción breve de la penca..."
          rows={3}
          className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <p className="text-sm text-gray-500 mt-1">
          Opcional: Agrega una descripción para los participantes
        </p>
      </div>

      {/* Status */}
      <div>
        <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
          Estado Inicial
        </label>
        <select
          id="status"
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value as 'open' | 'closed' | 'active' })}
          className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="open">Abierta (Acepta nuevos miembros)</option>
          <option value="active">Activa (En progreso)</option>
          <option value="closed">Cerrada (Finalizada)</option>
        </select>
        <p className="text-sm text-gray-500 mt-1">
          Puedes cambiar el estado después desde la configuración
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">
          Siguiente Paso
        </h4>
        <p className="text-sm text-blue-800">
          Después de crear la penca, podrás:
        </p>
        <ul className="text-sm text-blue-800 mt-2 space-y-1 list-disc list-inside">
          <li>Agregar carreras</li>
          <li>Configurar reglas de puntuación</li>
          <li>Generar códigos de invitación</li>
          <li>Gestionar miembros</li>
        </ul>
      </div>

      {/* Buttons */}
      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading || !form.name.trim() || !form.slug.trim()}
          className="px-6 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Creando...' : 'Crear Penca'}
        </button>
      </div>
    </form>
  );
}
