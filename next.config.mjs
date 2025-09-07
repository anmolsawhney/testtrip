/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true, // Keeping the standard Next.js config

  // Add the redirects function to handle URL changes
  async redirects() {
    return [
      {
        source: "/discover",
        destination: "/",
        permanent: true
      }
    ]
  }
}

export default nextConfig