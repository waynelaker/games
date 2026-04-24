import { defineConfig } from 'vite'
import { glob } from 'glob'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/index.html'),
        ...Object.fromEntries(
          glob.sync('src/games/*/index.html').map(file => [
            path.relative('src', file.slice(0, file.length - 11)),
            path.resolve(__dirname, file)
          ])
        )
      }
    }
  }
})
