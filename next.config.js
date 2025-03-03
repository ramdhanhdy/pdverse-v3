// File: next.config.js (update)
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    DB_CONNECTION: process.env.DB_CONNECTION,
  },
}

module.exports = nextConfig