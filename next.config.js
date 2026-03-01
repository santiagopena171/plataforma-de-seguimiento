/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    CALLMEBOT_PHONE: process.env.CALLMEBOT_PHONE,
    CALLMEBOT_APIKEY: process.env.CALLMEBOT_APIKEY,
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
