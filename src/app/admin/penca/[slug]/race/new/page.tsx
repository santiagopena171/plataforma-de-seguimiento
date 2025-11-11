'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

export default function NewRacePage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    seq: '',
    venue: '',
    distance_m: '',
    start_date: '',
    start_time: '15:00',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validar que seq sea único (esto se validará también en el servidor)
      if (!formData.seq || !formData.venue || !formData.distance_m || !formData.start_date || !formData.start_time) {
        throw new Error('Todos los campos son requeridos');
      }

      const res = await fetch(`/api/admin/pencas/${slug}/races`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seq: parseInt(formData.seq),
          venue: formData.venue,
          distance_m: parseInt(formData.distance_m),
          start_at: `${formData.start_date}T${formData.start_time}:00`,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al crear carrera');
      }

      // Redirigir de vuelta
      router.push(`/admin/penca/${slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-3">
            <Link
              href={`/admin/penca/${slug}`}
              className="text-gray-600 hover:text-gray-900"
            >
              ← Volver
            </Link>
            <span className="text-gray-400">/</span>
            <h1 className="text-2xl font-bold text-gray-900">
              Crear nueva carrera
            </h1>
          </div>
        </div>
      </header>

      {/* Form */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Detalles de la carrera */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Detalles de la carrera</h2>
            
            <div className="space-y-4">
              {/* Número de carrera */}
              <div>
                <label htmlFor="seq" className="block text-sm font-medium text-gray-900">
                  Número de carrera
                </label>
                <input
                  type="number"
                  name="seq"
                  id="seq"
                  value={formData.seq}
                  onChange={handleChange}
                  required
                  min="1"
                  className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="ej: 1"
                />
              </div>

              {/* Venue */}
              <div>
                <label htmlFor="venue" className="block text-sm font-medium text-gray-900">
                  Hipódromo
                </label>
                <input
                  type="text"
                  name="venue"
                  id="venue"
                  value={formData.venue}
                  onChange={handleChange}
                  required
                  className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="ej: Hipódromo Nacional"
                />
              </div>

              {/* Distance */}
              <div>
                <label htmlFor="distance_m" className="block text-sm font-medium text-gray-900">
                  Distancia (metros)
                </label>
                <input
                  type="number"
                  name="distance_m"
                  id="distance_m"
                  value={formData.distance_m}
                  onChange={handleChange}
                  required
                  min="100"
                  className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="ej: 2000"
                />
              </div>

              {/* Start date/time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="start_date" className="block text-sm font-medium text-gray-900">
                    Fecha de inicio
                  </label>
                  <input
                    type="date"
                    name="start_date"
                    id="start_date"
                    value={formData.start_date}
                    onChange={handleChange}
                    required
                    className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label htmlFor="start_time" className="block text-sm font-medium text-gray-900">
                    Hora de inicio
                  </label>
                  <input
                    type="time"
                    name="start_time"
                    id="start_time"
                    value={formData.start_time}
                    onChange={handleChange}
                    required
                    className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <Link
              href={`/admin/penca/${slug}`}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creando...' : 'Crear carrera'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
