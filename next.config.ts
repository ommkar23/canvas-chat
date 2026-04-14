import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@mariozechner/pi-coding-agent'],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
