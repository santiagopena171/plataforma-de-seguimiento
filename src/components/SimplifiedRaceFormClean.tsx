"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface SimplifiedRaceFormProps {
  pencaSlug: string;
  pencaId: string;
  numParticipants: number;
}

export default function SimplifiedRaceFormClean({ pencaSlug, pencaId }: SimplifiedRaceFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dayId = searchParams?.get('dayId') || null;
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    seq: "",
    venue: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const today = new Date().toISOString().split('T')[0];
      const raceResponse = await fetch(`/api/admin/pencas/${pencaSlug}/races`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          penca_id: pencaId,
          seq: formData.seq ? parseInt(formData.seq) : undefined,
          venue: formData.venue,
          distance_m: 1,
          start_at: `${today}T12:00:00Z`,
          race_day_id: dayId || null,
        }),
      });

      if (!raceResponse.ok) {
        const errorData = await raceResponse.json();
        throw new Error(errorData.error || "Error al crear la carrera");
      }

      await raceResponse.json();
      router.push(`/admin/penca/${pencaSlug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Crear nueva carrera</h2>
      {dayId && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-indigo-800">
            ℹ️ Esta carrera se agregará al día seleccionado
          </p>
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Detalles de la carrera</h3>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Número de carrera</label>
          <input
            type="number"
            value={formData.seq}
            onChange={(e) => setFormData({ ...formData, seq: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="ej: 1"
            min={1}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Hipodromo</label>
          <input
            type="text"
            value={formData.venue}
            onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="ej: Hipódromo Nacional"
            required
          />
        </div>

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
            {loading ? "Creando..." : "Crear carrera"}
          </button>
        </div>
      </form>
    </div>
  );
}
