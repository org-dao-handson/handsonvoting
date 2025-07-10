/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    // Required for Next.js 15.x with React 19
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Using the turbopack option is already set in your package.json dev script
  serverRuntimeConfig: {
    port: process.env.PORT || 3000
  },
  // Handle the local file dependency
  webpack: (config, { isServer }) => {
    // Any webpack customizations for @vocdoni/davinci-sdk if needed
    return config;
  }
};

module.exports = nextConfig;