/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/upload-audio",
        destination: `${process.env.NEXT_PUBLIC_API_SVR}/upload-audio`,
      },
      {
        source: "/api/response-events",
        destination: `${process.env.NEXT_PUBLIC_API_SVR}/response-events`,
      },
    ];
  },
};

export default nextConfig;
