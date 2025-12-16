/** @type {import('next').NextConfig} */
const nextConfig = {
  compiler: {
    reactCompiler: true,
  },
  images: {
    domains: ["static-cdn.jtvnw.net"],
  },
};




export default nextConfig;