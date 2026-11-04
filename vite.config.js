import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // 唯一不能写错的东西。冒险之证是 '/adventurer-handbook/'，这里是 '/genshin-guide/'
  base: '/genshin-guide/',
  plugins: [vue(), tailwindcss()],
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
})
