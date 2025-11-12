'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import SimplifiedRaceForm from '@/components/SimplifiedRaceFormClean';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function NewRacePage() {
  const params = useParams();
  const slug = params.slug as string;
  const [penca, setPenca] = useState<{ id: string; num_participants: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponentClient();

  useEffect(() => {
    async function fetchPenca() {
      const { data } = await supabase
        .from('pencas')
        .select('id, num_participants')
        .eq('slug', slug)
        .single();
      
      if (data) {
        setPenca(data);
      }
      setLoading(false);
    }
    fetchPenca();
  }, [slug, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Cargando...</div>
      </div>
    );
  }

  if (!penca) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600">Penca no encontrada</div>
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
              Crear nueva carrera
            </h1>
          </div>
        </div>
      </header>

      {/* Form */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SimplifiedRaceForm 
          pencaSlug={slug} 
          pencaId={penca.id} 
          numParticipants={penca.num_participants || 8}
        />
      </main>
    </div>
  );
}
