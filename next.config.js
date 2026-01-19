/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    PORT: process.env.PORT || 4444,
  },
};

module.exports = nextConfig;
