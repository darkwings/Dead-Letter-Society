import { defineConfig } from 'orval'

export default defineConfig({
  dls: {
    input: { target: 'http://localhost:8080/api/openapi' },
    output: {
      target: './src/api/generated.ts',
      client: 'react-query',
      override: { mutator: { path: './src/api/client.ts', name: 'customInstance' } },
    },
  },
})
