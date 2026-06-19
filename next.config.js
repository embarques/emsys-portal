const path = require('path');

function normalizeApiBaseUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allows your phone to load Next.js dev assets from your Mac/PC on the LAN.
  // Add your current LAN IP here if it changes.
  allowedDevOrigins: [
    '10.1.5.142',
    '10.1.5.142:3000',
    'localhost',
    'localhost:3000',
    '127.0.0.1',
    '127.0.0.1:3000',
  ],

  async rewrites() {
    const apiBase =
      normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL) ||
      'https://api.embarqueros.com/v1';

    return [
      {
        source: '/api/proxy/:path*',
        destination: `${apiBase}/:path*`,
      },
    ];
  },

  // Prevents Next.js from selecting /Users/hectorm as the workspace root
  // when it finds another yarn.lock/package-lock.json above this project.
  outputFileTracingRoot: __dirname,
  output: 'standalone',
  turbopack: {
    root: __dirname,
  },
};

module.exports = nextConfig;
