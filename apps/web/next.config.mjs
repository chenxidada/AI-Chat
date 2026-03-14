/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@kb/shared'],
  experimental: {
    optimizePackageImports: ['@kb/shared', 'mermaid'],
  },
  webpack: (config, { isServer }) => {
    // 处理 mermaid 在服务端的兼容性
    if (isServer) {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push('mermaid');
      }
    }
    return config;
  },
};

export default nextConfig;
