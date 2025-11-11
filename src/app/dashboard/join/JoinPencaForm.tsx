'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface JoinPencaFormProps {
  userId: string;
}

export default function JoinPencaForm({ userId }: JoinPencaFormProps) {
  const router = useRouter();
  
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!code.trim()) {
      setError('El código es requerido');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/pencas/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim().toLowerCase(),
          userId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al unirse a la penca');
      }

      const data = await response.json();
      
      // Redirigir al dashboard
      router.push('/dashboard');
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

      {/* Code Input */}
      <div>
        <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
          Código de la Penca
        </label>
        <input
          type="text"
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="ej: penca-maronas-2025"
          className="w-full rounded-md border border-gray-300 px-4 py-3 text-center text-lg font-mono focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          autoFocus
          required
        />
        <p className="text-sm text-gray-500 mt-2">
          El código es el slug de la penca (parte de la URL)
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <svg className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">¿Dónde encuentro el código?</p>
            <p>El administrador de la penca te debe compartir el código. Es la parte final de la URL de la penca.</p>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading || !code.trim()}
        className="w-full px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {loading ? 'Uniéndose...' : 'Unirse a la Penca'}
      </button>

      {/* Back Link */}
      <div className="text-center">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
