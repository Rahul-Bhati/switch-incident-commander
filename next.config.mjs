/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Allows production builds to succeed even with minor typing variances during generation
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

let exportedConfig = nextConfig;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { withSentryConfig } = await import("@sentry/nextjs");
  exportedConfig = withSentryConfig(nextConfig, {
    silent: true,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    widenClientFileUpload: true,
    hideSourceMaps: true,
    disableLogger: true,
  });
} catch {
  // If @sentry/nextjs is not fully configured, fallback to standard nextConfig
  exportedConfig = nextConfig;
}

export default exportedConfig;
