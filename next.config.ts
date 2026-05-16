import withPWA from 'next-pwa'

const nextConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true
})({
  reactStrictMode: true
})

export default nextConfig
