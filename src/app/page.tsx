"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function HomePage() {
  const router = useRouter();
  const [slug, setSlug] = useState('');

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const s = (slug || '').trim();
    if (!s) return;
    router.push(`/public/${encodeURIComponent(s)}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏇</span>
            <h1 className="text-lg font-bold">Pencas Hípicas</h1>
          </div>
          <nav>
            <Link href="/login" className="text-gray-700 hover:text-gray-900 font-medium">
              Iniciar sesión
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center">
        <form onSubmit={handleSubmit} autoComplete="off" className="w-full max-w-md bg-white p-8 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Ingresá el código de la penca</h2>

          <label htmlFor="slug" className="sr-only">Código (slug)</label>
          <input
            id="slug"
            name="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="Código de la penca"
            autoComplete="off"
            className="w-full px-4 py-3 border border-gray-200 rounded-md mb-4"
          />

          <button
            type="submit"
            className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
          >
            Buscar Penca
          </button>

          <p className="text-sm text-gray-500 mt-4">Si sos admin, usá <Link href="/login" className="text-indigo-600">Iniciar sesión</Link>.</p>
        </form>
      </main>

      <footer className="py-8 text-center text-sm text-gray-500">
        Juego social — sin dinero. © {new Date().getFullYear()}
      </footer>
    </div>
  );
}
