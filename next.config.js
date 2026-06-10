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

  // API proxy: src/app/api/[...path]/route.ts forwards /api/* to NEXT_PUBLIC_API_BASE_URL.
};

module.exports = nextConfig;
