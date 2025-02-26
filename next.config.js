/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost'],
  },
  webpack: (config, { isServer }) => {
    // Handle canvas dependency
    config.resolve.alias.canvas = false;
    
    // Handle MuPDF WebAssembly files
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      stream: false,
    };
    
    // Enable WebAssembly
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    
    // Add rule for WebAssembly files
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    });
    
    // Fix for mupdf WebAssembly loading
    if (!isServer) {
      config.output.publicPath = '/_next/';
    }
    
    return config;
  },
  // Add experimental serverComponentsExternalPackages for MuPDF
  experimental: {
    serverComponentsExternalPackages: ['mupdf'],
  },
};

module.exports = nextConfig;
