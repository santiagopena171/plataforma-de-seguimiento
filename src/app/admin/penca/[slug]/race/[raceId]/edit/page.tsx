'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Horse {
  id: string;
  program_number: number;
  horse_name: string;
  jockey: string;
}

interface Race {
  id: string;
  seq: number;
  venue: string;
  distance_m: number;
  start_at: string;
  status: 'scheduled' | 'in_progress' | 'finished' | 'cancelled';
}

export default function EditRacePage() {
  const router = useRouter();
  const params = useParams<{ slug?: string; raceId?: string }>();
  const slug = typeof params?.slug === 'string' ? params.slug : null;
  const raceId = typeof params?.raceId === 'string' ? params.raceId : null;

  const [race, setRace] = useState<Race | null>(null);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    venue: '',
    start_date: '',
  });

  // Cargar datos de la carrera y caballos
  useEffect(() => {
    if (!raceId) return;

    async function loadData() {
      try {
        setLoading(true);

        // Cargar carrera
        const raceRes = await fetch(`/api/admin/races/${raceId}`);
        if (!raceRes.ok) throw new Error('No se pudo cargar la carrera');
        const raceData = await raceRes.json();
        setRace(raceData);

        // Separar fecha y hora
        const startAtDate = new Date(raceData.start_at);
        const date = startAtDate.toISOString().split('T')[0];

        setFormData({
          venue: raceData.venue,
          start_date: date,
        });

        // Cargar caballos
        const horsesRes = await fetch(`/api/admin/races/${raceId}/entries`);
        if (horsesRes.ok) {
          const horsesData = await horsesRes.json();
          setHorses(horsesData);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [raceId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleHorseChange = (index: number, field: keyof Omit<Horse, 'id'>, value: string | number) => {
    const newHorses = [...horses];
    newHorses[index] = {
      ...newHorses[index],
      [field]: field === 'program_number' ? parseInt(value as string) : value,
    };
    setHorses(newHorses);
  };

  const addHorse = () => {
    const newNumber = horses.length > 0 ? Math.max(...horses.map((h: Horse) => h.program_number)) + 1 : 1;
    setHorses([
      ...horses,
      {
        id: `new-${Date.now()}`,
        program_number: newNumber,
        horse_name: '',
        jockey: '',
      },
    ]);
  };

  const removeHorse = (index: number) => {
    setHorses(horses.filter((_: Horse, i: number) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // Actualizar carrera
      const raceRes = await fetch(`/api/admin/races/${raceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venue: formData.venue,
          distance_m: 1, // Default (must be > 0)
          start_at: `${formData.start_date}T12:00:00Z`, // Default (UTC)
        }),
      });

      if (!raceRes.ok) {
        const text = await raceRes.text();
        try {
          const error = JSON.parse(text);
          throw new Error(error.error || `Error al actualizar carrera (${raceRes.status})`);
        } catch (e) {
          throw new Error(`Error al actualizar carrera: ${raceRes.status} ${text}`);
        }
      }

      // Actualizar caballos solo con número (sin nombre ni jockey)
      const horsesRes = await fetch(`/api/admin/races/${raceId}/entries`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: horses.map((h: Horse) => ({
            id: h.id,
            program_number: h.program_number,
            horse_name: '',
            jockey: '',
          })),
        }),
      });

      if (!horsesRes.ok) {
        const text = await horsesRes.text();
        try {
          const error = JSON.parse(text);
          throw new Error(error.error || `Error al actualizar caballos (${horsesRes.status})`);
        } catch (e) {
          throw new Error(`Error al actualizar caballos: ${horsesRes.status} ${text}`);
        }
      }

      // Redirigir de vuelta
      router.push(`/admin/penca/${slug}`);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSubmitting(false);
    }
  };

  if (!slug || !raceId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-600">
          Parámetros inválidos para la carrera.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Cargando...</div>
      </div>
    );
  }

  if (!race) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">Carrera no encontrada</h2>
          <Link href={`/admin/penca/${slug}`} className="text-indigo-600 hover:underline mt-4 inline-block">
            Volver a la penca
          </Link>
        </div>
      </div>
    );
  }

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
              Editar Carrera #{race.seq}
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
            </div>
          </div>

          {/* Caballos */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Caballos ({horses.length})</h2>
              <button
                type="button"
                onClick={addHorse}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700"
              >
                + Agregar número
              </button>
            </div>

            {horses.length === 0 ? (
              <p className="text-gray-600 text-sm">No hay números agregados</p>
            ) : (
              <div className="space-y-4">
                {horses.map((horse, index) => (
                  <div key={horse.id} className="flex gap-4 items-end p-4 border border-gray-200 rounded-lg">
                    {/* Número */}
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-900 mb-1">
                        Número
                      </label>
                      <input
                        type="number"
                        value={horse.program_number}
                        onChange={(e) => handleHorseChange(index, 'program_number', e.target.value)}
                        required
                        min="1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="ej: 1"
                      />
                    </div>

                    {/* Nombre del caballo */}
                    <div className="hidden">
                      <label className="block text-sm font-medium text-gray-900 mb-1">
                        Nombre del caballo
                      </label>
                      <input
                        type="text"
                        value={horse.horse_name}
                        onChange={(e) => handleHorseChange(index, 'horse_name', e.target.value)}
                        // not required here because the field is hidden in this form
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="ej: Rápido del Sur"
                      />
                    </div>

                    {/* Jockey */}
                    <div className="hidden">
                      <label className="block text-sm font-medium text-gray-900 mb-1">
                        Jockey
                      </label>
                      <input
                        type="text"
                        value={horse.jockey}
                        onChange={(e) => handleHorseChange(index, 'jockey', e.target.value)}
                        // not required here because the field is hidden in this form
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="ej: Juan Pérez"
                      />
                    </div>

                    {/* Eliminar */}
                    <button
                      type="button"
                      onClick={() => removeHorse(index)}
                      className="px-3 py-2 text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            )}
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
              disabled={submitting}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}


