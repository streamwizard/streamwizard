/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    esmExternals: "loose",
    reactCompiler: true,  
  },
};

export default nextConfig;
