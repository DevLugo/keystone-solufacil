/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Configuración para trabajar con Keystone
  async rewrites() {
    return [
      // Redirigir las rutas de la API de Keystone
      {
        source: '/api/graphql',
        destination: 'http://localhost:3000/api/graphql',
      },
      // Permitir que las rutas de la API de Next.js funcionen
      {
        source: '/api/:path*',
        destination: '/api/:path*',
      },
    ];
  },

  // Configuración de la API
  experimental: {
    appDir: false,
  },

  // Configuración del servidor
  serverRuntimeConfig: {
    // Configuración específica del servidor
  },

  // Configuración pública
  publicRuntimeConfig: {
    // Configuración pública
  },
};

module.exports = nextConfig;
