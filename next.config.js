// File: next.config.js (update)
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    DB_CONNECTION: process.env.DB_CONNECTION,
  },
  webpack: (config) => {
    config.watchOptions = {
      poll: 1000, // Check for changes every second
      aggregateTimeout: 300, // Delay before rebuilding
      ignored: ["**/node_modules", "**/.git"],
    };
    return config;
  },
}

module.exports = nextConfig