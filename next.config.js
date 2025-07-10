/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // Remove or disable trailingSlash
  basePath: process.env.NODE_ENV === 'production' ? '/handsonvoting' : '',
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },
  env: {
    API_URL: process.env.API_URL,
    RPC_URL: process.env.RPC_URL,
    PRIVATE_KEY: process.env.PRIVATE_KEY,
    ORGANIZATION_REGISTRY_ADDRESS: process.env.ORGANIZATION_REGISTRY_ADDRESS,
    PROCESS_REGISTRY_ADDRESS: process.env.PROCESS_REGISTRY_ADDRESS,
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

module.exports = nextConfig;
