import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Indispensable pour l'image Docker minimale (cf. Dockerfile)
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  // Driver Postgres de Prisma 7 (pg : require dynamique), Puppeteer (PDF) et le
  // client LDAP gardés hors bundle serveur.
  serverExternalPackages: ["@prisma/adapter-pg", "pg", "puppeteer", "ldapts", "@azure/msal-node"],
  // Ce que le traçage du build standalone ne doit JAMAIS embarquer : fichiers .env,
  // sauvegardes de la base, sources des scripts, docs.
  outputFileTracingExcludes: {
    "*": [
      "./backups/**",
      "./docs/**",
      "./.env",
      "./.env*",
      "./scripts/**",
      "./*.tsbuildinfo",
      "./**/*.test.ts",
    ],
  },
  devIndicators: {
    position: "bottom-right",
  },
  // En-têtes de sécurité posés PAR L'APP (mêmes valeurs que l'application Flask :
  // X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy).
  // La CSP porte un nonce par réponse et se construit dans le middleware (src/proxy.ts).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      // APP_DOMAIN peut lister plusieurs origines séparées par des virgules.
      allowedOrigins: process.env.APP_DOMAIN
        ? process.env.APP_DOMAIN.split(",")
            .map((o) => o.trim())
            .filter(Boolean)
        : undefined,
      // Pièces jointes : même plafond que Sentinelle (MAX_CONTENT_LENGTH = 25 Mo).
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
