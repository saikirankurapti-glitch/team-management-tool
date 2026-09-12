import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    alias: {
      // Map the relative Prisma import used in src/prisma.ts to the actual
      // generated client location. This is needed because the schema's custom
      // output path resolves differently at runtime (tsx) vs test time (vitest).
      '../prisma/client': path.resolve(__dirname, '../client/prisma/client'),
      '../../client/prisma/client': path.resolve(__dirname, '../client/prisma/client'),
    },
  },
  resolve: {
    alias: {
      // Allow server/src code to find the generated Prisma client
      // The import '../prisma/client/index.js' from server/src/prisma.ts
      // must resolve to client/prisma/client/
      [path.resolve(__dirname, 'src/../prisma/client/index.js')]: path.resolve(__dirname, '../client/prisma/client/index.js'),
    },
  },
});
