/** @type {import('next').NextConfig} */
const nextConfig = {
  logging: {
    fetches: false,
    
  },


  
  experimental: {
    esmExternals: 'loose',
  },
};

export default nextConfig;
