import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import LogoutButton from '@/components/LogoutButton';
import RulesForm from './RulesForm';

interface PageProps {
  params: {
    slug: string;
  };
}

export default async function ConfigPage({ params }: PageProps) {
  const supabase = createServerComponentClient({ cookies });
  
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  // Verificar que sea admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  if (profile?.role !== 'admin') {
    redirect('/dashboard');
  }

  // Obtener la penca con sus reglas
  const { data: penca, error: pencaError } = await supabase
    .from('pencas')
    .select(`
      *,
      rulesets (
        *
      )
    `)
    .eq('slug', params.slug)
    .single();

  if (pencaError || !penca) {
    notFound();
  }

  const activeRuleset = penca.rulesets?.find((r: any) => r.is_active) || penca.rulesets?.[0];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <Link
                href={`/admin/penca/${params.slug}`}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Volver a {penca.name}
              </Link>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Configuración de Reglas
          </h1>
          <p className="text-gray-600 mb-6">
            Define las reglas de puntuación y modalidades para esta penca
          </p>

          <RulesForm 
            pencaId={penca.id} 
            slug={params.slug}
            activeRuleset={activeRuleset}
            allRulesets={penca.rulesets || []}
          />
        </div>
      </main>
    </div>
  );
}
