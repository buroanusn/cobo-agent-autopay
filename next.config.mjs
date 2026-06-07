/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Server-only packages that must be loaded by Node.js at runtime, not
  // bundled by webpack. Some of these internally import `node:crypto`
  // (or other `node:` schemes) and cause webpack 5 to throw
  // UnhandledSchemeError if they are included in the server bundle.
  serverExternalPackages: [
    "@cobo/agentic-wallet",
    "@prisma/client",
    "prisma"
  ],
  webpack: (config) => {
    // Set `node:` schemes and bare `crypto` / `fs` modules to an empty
    // module on the client side. We never need them in the browser bundle.
    // The server bundle resolves them via Node.js at runtime.
    config.resolve = config.resolve || {};
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      "node:crypto": false,
      "node:buffer": false,
      "node:url": false,
      "node:path": false,
      "node:fs": false,
      "node:stream": false,
      crypto: false,
      buffer: false,
      fs: false,
      stream: false
    };
    return config;
  }
};

export default nextConfig;
