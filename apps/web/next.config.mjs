/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@kb/shared'],
  experimental: {
    optimizePackageImports: ['@kb/shared'],
  },
};

export default nextConfig;
