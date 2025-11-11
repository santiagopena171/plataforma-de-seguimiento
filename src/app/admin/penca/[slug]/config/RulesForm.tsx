'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface RulesFormProps {
  pencaId: string;
  slug: string;
  activeRuleset: any;
  allRulesets: any[];
}

export default function RulesForm({ pencaId, slug, activeRuleset, allRulesets }: RulesFormProps) {
  const router = useRouter();
  
  const [form, setForm] = useState({
    version: (activeRuleset?.version || 0) + 1,
    points_first: activeRuleset?.points_top3?.first || 5,
    points_second: activeRuleset?.points_top3?.second || 3,
    points_third: activeRuleset?.points_top3?.third || 1,
    modalities: activeRuleset?.modalities_enabled || ['winner'],
    lock_minutes: activeRuleset?.lock_minutes_before_start || 15,
    sealed: activeRuleset?.sealed_predictions_until_close !== false,
    effective_from: activeRuleset?.effective_from_race_seq || 1,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const modalityOptions = [
    { id: 'winner', label: 'Ganador' },
    { id: 'exacta', label: 'Exacta (1° y 2°)' },
    { id: 'trifecta', label: 'Trifecta (1°, 2° y 3°)' },
    { id: 'place', label: 'Lugar (Top 3)' },
  ];

  const handleModalityToggle = (modality: string) => {
    setForm({
      ...form,
      modalities: form.modalities.includes(modality)
        ? form.modalities.filter((m) => m !== modality)
        : [...form.modalities, modality],
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`/api/admin/pencas/${slug}/rules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pencaId,
          version: form.version,
          points_top3: {
            first: form.points_first,
            second: form.points_second,
            third: form.points_third,
          },
          modalities_enabled: form.modalities,
          lock_minutes_before_start: form.lock_minutes,
          sealed_predictions_until_close: form.sealed,
          effective_from_race_seq: form.effective_from,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al actualizar las reglas');
      }

      setSuccess(true);
      setTimeout(() => {
        router.refresh();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Current Version Info */}
      {activeRuleset && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>Versión actual: {activeRuleset.version}</strong>
            <br />
            Efectiva desde carrera #{activeRuleset.effective_from_race_seq}
            <br />
            Creada: {new Date(activeRuleset.created_at).toLocaleString('es')}
          </p>
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-green-800">✅ Reglas actualizadas correctamente</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Points Distribution */}
        <div className="border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Distribución de Puntos
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                1° Lugar
              </label>
              <input
                type="number"
                min="0"
                value={form.points_first}
                onChange={(e) => setForm({ ...form, points_first: parseInt(e.target.value) || 0 })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                2° Lugar
              </label>
              <input
                type="number"
                min="0"
                value={form.points_second}
                onChange={(e) => setForm({ ...form, points_second: parseInt(e.target.value) || 0 })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                3° Lugar
              </label>
              <input
                type="number"
                min="0"
                value={form.points_third}
                onChange={(e) => setForm({ ...form, points_third: parseInt(e.target.value) || 0 })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Modalities */}
        <div className="border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Modalidades Habilitadas
          </h3>
          <div className="space-y-3">
            {modalityOptions.map((modality) => (
              <label key={modality.id} className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.modalities.includes(modality.id)}
                  onChange={() => handleModalityToggle(modality.id)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-gray-700">{modality.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Lock Settings */}
        <div className="border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Configuración de Bloqueo
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minutos para bloquear antes del inicio
              </label>
              <input
                type="number"
                min="0"
                value={form.lock_minutes}
                onChange={(e) => setForm({ ...form, lock_minutes: parseInt(e.target.value) || 0 })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <p className="text-sm text-gray-500 mt-1">
                Los pronósticos se bloquearán este tiempo antes de que comience la carrera
              </p>
            </div>

            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.sealed}
                onChange={(e) => setForm({ ...form, sealed: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-gray-700">
                Mantener pronósticos sellados hasta cierre de carrera
              </span>
            </label>
          </div>
        </div>

        {/* Effective From */}
        <div className="border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Aplicación de Reglas
          </h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Efectiva desde carrera #
            </label>
            <input
              type="number"
              min="1"
              value={form.effective_from}
              onChange={(e) => setForm({ ...form, effective_from: parseInt(e.target.value) || 1 })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <p className="text-sm text-gray-500 mt-1">
              A partir de qué carrera serán aplicadas estas reglas
            </p>
          </div>
        </div>

        {/* Version History */}
        {allRulesets.length > 0 && (
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Historial de Versiones
            </h3>
            <div className="space-y-2">
              {allRulesets
                .sort((a, b) => b.version - a.version)
                .map((ruleset) => (
                  <div
                    key={ruleset.id}
                    className={`p-3 rounded-lg border ${
                      ruleset.is_active
                        ? 'bg-indigo-50 border-indigo-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">
                          Versión {ruleset.version}
                          {ruleset.is_active && (
                            <span className="ml-2 inline-block px-2 py-1 text-xs font-semibold bg-indigo-600 text-white rounded">
                              Activa
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          Desde carrera #{ruleset.effective_from_race_seq}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(ruleset.created_at).toLocaleString('es')}
                        </p>
                      </div>
                      <div className="text-right text-sm text-gray-600">
                        <p>
                          Puntos: {ruleset.points_top3.first}/{ruleset.points_top3.second}/{ruleset.points_top3.third}
                        </p>
                        <p className="text-xs mt-1">
                          {ruleset.modalities_enabled.join(', ')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Guardando...' : 'Guardar Nueva Versión'}
          </button>
        </div>
      </form>
    </div>
  );
}
