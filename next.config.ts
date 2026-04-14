import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@mariozechner/pi-coding-agent'],
  allowedDevOrigins: ['127.0.0.1'],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
