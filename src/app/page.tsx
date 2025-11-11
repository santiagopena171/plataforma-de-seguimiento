import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-primary-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">🏇</span>
            <h1 className="text-xl font-bold text-gray-900">Pencas Hípicas</h1>
          </div>
          <nav className="flex items-center space-x-4">
            <Link
              href="/login"
              className="text-gray-600 hover:text-gray-900 font-medium"
            >
              Iniciar Sesión
            </Link>
            <Link
              href="/register"
              className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 font-medium"
            >
              Registrarse
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-5xl font-bold text-gray-900 mb-6">
          Pronósticos de Carreras de Caballos
          <br />
          <span className="text-primary-600">Entre Amigos</span>
        </h2>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Crea pencas personalizadas, invita a tus amigos y compite prediciendo
          los resultados de las carreras. Sin dinero, solo diversión y competencia sana.
        </p>
        <div className="flex justify-center space-x-4">
          <Link
            href="/register"
            className="bg-primary-600 text-white px-8 py-3 rounded-lg hover:bg-primary-700 font-medium text-lg"
          >
            Comenzar Gratis
          </Link>
          <Link
            href="#features"
            className="bg-white text-primary-600 border-2 border-primary-600 px-8 py-3 rounded-lg hover:bg-primary-50 font-medium text-lg"
          >
            Saber Más
          </Link>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="bg-yellow-50 border-t border-b border-yellow-200 py-6">
        <div className="container mx-auto px-4">
          <div className="flex items-start space-x-3 max-w-4xl mx-auto">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="font-bold text-yellow-900 mb-1">
                Importante: Sitio de Juego Social
              </h3>
              <p className="text-yellow-800">
                Esta plataforma es <strong>exclusivamente para entretenimiento entre amigos</strong>.
                No se procesan apuestas, no se gestiona dinero real, y no está relacionado con
                ninguna actividad de juego regulada. Solo pronósticos y puntajes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container mx-auto px-4 py-20">
        <h3 className="text-3xl font-bold text-center text-gray-900 mb-12">
          Características Principales
        </h3>
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon="👥"
            title="Pencas Privadas"
            description="Crea tu propia penca con reglas personalizadas. Solo tus invitados pueden participar."
          />
          <FeatureCard
            icon="🎯"
            title="Múltiples Modalidades"
            description="Predice ganadores, exactas, trifectas. Configura el sistema de puntos a tu gusto."
          />
          <FeatureCard
            icon="📊"
            title="Leaderboard en Vivo"
            description="Sigue la tabla de posiciones en tiempo real. Ve cómo van tus amigos carrera por carrera."
          />
          <FeatureCard
            icon="🔒"
            title="Sellado de Predicciones"
            description="Opción de mantener pronósticos ocultos hasta el cierre. Evita copias y mantén el suspenso."
          />
          <FeatureCard
            icon="⚙️"
            title="Reglas Versionadas"
            description="Cambia reglas sin afectar carreras pasadas. Todo queda documentado y auditable."
          />
          <FeatureCard
            icon="📱"
            title="Notificaciones"
            description="Recibe avisos de cierres próximos, resultados publicados y cambios importantes."
          />
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-gray-50 py-20">
        <div className="container mx-auto px-4">
          <h3 className="text-3xl font-bold text-center text-gray-900 mb-12">
            ¿Cómo Funciona?
          </h3>
          <div className="max-w-4xl mx-auto space-y-8">
            <Step
              number={1}
              title="Regístrate y Obtén Permisos de Admin"
              description="Solo usuarios con rol de administrador pueden crear pencas. Solicita acceso o únete a una existente."
            />
            <Step
              number={2}
              title="Crea Tu Penca"
              description="Define nombre, reglas de puntos, modalidades (winner/exacta/trifecta) y minutos de cierre antes de cada carrera."
            />
            <Step
              number={3}
              title="Carga Carreras y Participantes"
              description="Agrega las carreras con fecha/hora y los caballos que competirán. Genera un código de invitación."
            />
            <Step
              number={4}
              title="Invita a Tus Amigos"
              description="Comparte el código. Cada usuario registrado puede unirse y empezar a pronosticar."
            />
            <Step
              number={5}
              title="Pronostica Antes del Cierre"
              description="Los jugadores eligen sus picks. Las predicciones se bloquean automáticamente según el tiempo configurado."
            />
            <Step
              number={6}
              title="Publica Resultados y Ve el Leaderboard"
              description="Ingresa el orden final (1-2-3). El sistema calcula puntos y actualiza la tabla en tiempo real."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h3 className="text-3xl font-bold text-gray-900 mb-4">
          ¿Listo para Empezar?
        </h3>
        <p className="text-xl text-gray-600 mb-8">
          Crea tu cuenta y únete a la diversión. Totalmente gratis.
        </p>
        <Link
          href="/signup"
          className="inline-block bg-primary-600 text-white px-8 py-3 rounded-lg hover:bg-primary-700 font-medium text-lg"
        >
          Crear Cuenta Ahora
        </Link>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-2xl">🏇</span>
                <span className="text-xl font-bold">Pencas Hípicas</span>
              </div>
              <p className="text-gray-400 text-sm">
                Juego social sin dinero © 2024
              </p>
            </div>
            <div className="text-center md:text-right">
              <p className="text-sm text-gray-400">
                Disclaimer: Sitio de entretenimiento. No se procesan apuestas ni dinero.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string
  title: string
  description: string
}) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="text-4xl mb-4">{icon}</div>
      <h4 className="text-xl font-bold text-gray-900 mb-2">{title}</h4>
      <p className="text-gray-600">{description}</p>
    </div>
  )
}

function Step({
  number,
  title,
  description,
}: {
  number: number
  title: string
  description: string
}) {
  return (
    <div className="flex items-start space-x-4">
      <div className="flex-shrink-0 w-12 h-12 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold text-xl">
        {number}
      </div>
      <div>
        <h4 className="text-xl font-bold text-gray-900 mb-2">{title}</h4>
        <p className="text-gray-600">{description}</p>
      </div>
    </div>
  )
}
