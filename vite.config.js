import { defineConfig } from 'vite'
import { glob } from 'glob'
import path from 'path'

export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(
        glob.sync('src/games/*/index.html').map(file => [
          path.relative('src', file.slice(0, file.length - 11)),
          path.resolve(__dirname, file)
        ])
      )
    }
  }
})
