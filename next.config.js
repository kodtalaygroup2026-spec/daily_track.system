/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // lets several builds or dev servers run side by side without sharing one output folder
  distDir: process.env.NEXT_DIST_DIR || '.next',
};
