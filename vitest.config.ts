/**
 * Vitest configuration
 *
 * This file intentionally has NO imports so it can be loaded in environments
 * where neither `vitest` nor `expo` is installed in the project's node_modules
 * (e.g. bare CI runners that invoke vitest via npx/pnpm exec).
 *
 * Key problem solved: the root tsconfig.json extends "expo/tsconfig.base",
 * which vitest/esbuild cannot resolve when expo is absent. We bypass this by
 * supplying an inline `tsconfigRaw` JSON string directly to esbuild, skipping
 * file-based tsconfig resolution entirely.
 *
 * IMPORTANT: `tsconfigRaw` MUST be a JSON *string*, not an object.
 * Vite's `transformWithEsbuild` only skips `loadTsconfigJsonForFile` when
 * `typeof tsconfigRaw === "string"` (see vite/src/node/plugins/esbuild.ts).
 */

const config = {
  test: {
    environment: "node",
    include: ["**/*.{test,spec}.{ts,tsx}", "tests/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.expo/**"],
  },
  resolve: {
    alias: {
      "@": new URL(".", import.meta.url).pathname.replace(/\/$/, ""),
    },
  },
  esbuild: {
    // IMPORTANT: must be a JSON *string*, not an object.
    // Vite's transformWithEsbuild only skips loadTsconfigJsonForFile when
    // tsconfigRaw is typeof "string".  Passing an object still triggers the
    // file-based tsconfig resolution, which fails because expo/tsconfig.base
    // is not installed in bare CI runners.
    tsconfigRaw: JSON.stringify({
      compilerOptions: {
        target: "ES2020",
        module: "ESNext",
        moduleResolution: "bundler",
        lib: ["ES2020", "DOM"],
        allowJs: true,
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        resolveJsonModule: true,
        noEmit: true,
        jsx: "react-native",
        paths: {
          "@/*": ["./*"],
          "@shared/*": ["./shared/*"],
        },
      },
    }),
  },
};

export default config;
