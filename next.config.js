const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allows your phone to load Next.js dev assets from your Mac/PC on the LAN.
  // Add your current LAN IP here if it changes.
  allowedDevOrigins: [
    '10.1.5.142',
    '10.1.5.142:3001',
    'localhost',
    'localhost:3001',
    '127.0.0.1',
    '127.0.0.1:3001',
  ],

  // Prevents Next.js from selecting /Users/hectorm as the workspace root
  // when it finds another yarn.lock/package-lock.json above this project.
  outputFileTracingRoot: __dirname,
  output: 'standalone',
  turbopack: {
    root: __dirname,
  },

  // Dev-only proxy: browser calls same-origin /api/* → NEXT_PUBLIC_API_BASE_URL/*
  // Avoids CORS when the remote API does not allow http://localhost:3001.
  async rewrites() {
    if (process.env.NODE_ENV !== 'development') {
      return [];
    }

    const target = (process.env.NEXT_PUBLIC_API_BASE_URL || '').trim().replace(/\/+$/, '');
    if (!target.startsWith('http')) {
      return [];
    }

    return [
      {
        source: '/api/:path*',
        destination: `${target}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
