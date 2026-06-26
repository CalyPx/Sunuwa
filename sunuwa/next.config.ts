import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  // Leaflet needs this for CSS imports
  transpilePackages: ['leaflet', 'react-leaflet'],
  devIndicators: false,
}

export default withNextIntl(nextConfig)
