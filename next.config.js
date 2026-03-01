/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    CALLMEBOT_PHONE: process.env.CALLMEBOT_PHONE || '59897784716',
    CALLMEBOT_APIKEY: process.env.CALLMEBOT_APIKEY || '3239720',
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '8681789703:AAF9wm9VA5XOZOskrLocSlkwlh8N_DgOlfM',
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '5695426761',
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },
}

module.exports = nextConfig
