import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { fileURLToPath } from 'url'

export default defineConfig({
  plugins: [
    vue(),
    Components({
      // 自动扫描 src/components 目录下的 .vue 文件
      dirs: ['src/components'],
      // 组件名称匹配的正则，默认匹配所有 .vue 文件
      extensions: ['vue'],
      // 生成类型声明文件，供 TypeScript 识别自动导入的组件
      dts: 'src/components.d.ts',
      // 深度扫描子目录
      deep: true,
    }),
  ],
  base: '',
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@/styles/variables" as *; @use "@/styles/mixins" as *; @use "@/styles/functions" as *;`,
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        format: 'es',
      },
    },
  },
})
