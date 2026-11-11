/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // lets several builds or dev servers run side by side without sharing one output folder
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // links and bookmarks made for the static site (index.html, supervisor.html ...) land on the new pages
  async redirects() {
    return [
      { source: '/index.html', destination: '/today', permanent: true },
      { source: '/login.html', destination: '/login', permanent: true },
      { source: '/supervisor.html', destination: '/supervisor', permanent: true },
      { source: '/profile.html', destination: '/profile', permanent: true },
    ];
  },
};
