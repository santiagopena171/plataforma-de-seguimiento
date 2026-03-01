/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    CALLMEBOT_PHONE: process.env.CALLMEBOT_PHONE || '59897784716',
    CALLMEBOT_APIKEY: process.env.CALLMEBOT_APIKEY || '3239720',
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
