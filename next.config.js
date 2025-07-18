// Set up logging before anything else
// Temporarily disabled for debugging
// try {
//   require('./src/lib/setup-logging.js');
// } catch (error) {
//   console.error('Failed to set up logging:', error);
// }

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Base path configuration - set BASE_PATH env var if needed
  basePath: process.env.BASE_PATH || '',
  assetPrefix: process.env.BASE_PATH || '',
  
  // Production optimizations
  swcMinify: true,
  compress: true,
  poweredByHeader: false,
  
  // Image optimization
  images: {
    domains: ['localhost', 'targonglobal.com', 'www.targonglobal.com'],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },
  
  // Strict mode for development
  reactStrictMode: true,
  
  // Production source maps (disable for security)
  productionBrowserSourceMaps: false,
  
  // Headers for security and caching
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          }
        ]
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate'
          }
        ]
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      }
    ]
  },
  
  // Environment variables validation
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  },
  
  // Webpack configuration
  webpack: (config, { isServer }) => {
    // Enable webpack stats for bundle analysis
    if (process.env.ANALYZE === 'true') {
      config.stats = 'verbose'
      // Log a message about how to analyze the bundle
      if (!isServer) {
        console.log('\n📊 Bundle analysis enabled!')
        console.log('After build completes, check .next/build-manifest.json')
        console.log('You can also install @next/bundle-analyzer for detailed analysis\n')
      }
    }
    return config
  },
  
  // Enable experimental features for production optimization
  experimental: {
    // optimizeCss: true, // Disabled to avoid critters dependency issue
    optimizePackageImports: ['lucide-react', 'date-fns', 'recharts', '@radix-ui/react-icons', '@radix-ui/react-dialog', '@radix-ui/react-select'],
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'],
  },
  
  // Additional production optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  
  // Removed standalone output - incompatible with custom server.js
  // output: 'standalone',
  
  // Disable ESLint during production builds for deployment
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Disable TypeScript errors during production builds for deployment
  typescript: {
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig