import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Pencas Hípicas - Juego Social',
  description: 'Plataforma de pencas de carreras de caballos entre amigos. Sin dinero, solo diversión.',
  keywords: 'pencas, caballos, carreras, pronósticos, juego social',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
