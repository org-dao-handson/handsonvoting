/** @type {import('next').NextConfig} */
const nextConfig = {
  //output: 'export',
  basePath: process.env.NODE_ENV === 'production' ? '' : '',
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: {
    API_URL: process.env.API_URL,
    RPC_URL: process.env.RPC_URL,
    PRIVATE_KEY: process.env.PRIVATE_KEY,
    ORGANIZATION_REGISTRY_ADDRESS: process.env.ORGANIZATION_REGISTRY_ADDRESS,
    PROCESS_REGISTRY_ADDRESS: process.env.PROCESS_REGISTRY_ADDRESS,
  },
  webpack: (config, { isServer }) => {
    // This is necessary for the Redis DNS module in server components
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        dns: false,
        fs: false,
        net: false,
        tls: false,
      };
    }

    return config;
  },
};

module.exports = nextConfig;
