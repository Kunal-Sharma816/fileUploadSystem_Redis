/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable experimental features for large uploads
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  
  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
    formats: ['image/webp', 'image/avif'],
  },
};

export default nextConfig;