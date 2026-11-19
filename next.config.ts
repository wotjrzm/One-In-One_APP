import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // loadBank reads content/problems via dynamic fs; make sure it ships with every server function.
  outputFileTracingIncludes: {
    "/**": ["./content/problems/**/*.json"],
  },
};

export default nextConfig;
