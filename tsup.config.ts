import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'adapters/index': 'src/adapters/index.ts',
    'algorithms/index': 'src/algorithms/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  target: 'es2022',
  outExtension({ format }) {
    return {
      js: format === 'esm' ? '.mjs' : '.js',
    };
  },
  external: ['@cloudflare/workers-types', '@libsql/client', 'better-sqlite3', 'bun:sqlite', './bun-sqlite'],
});
