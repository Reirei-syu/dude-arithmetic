import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages 部署必须配置
  base: '/dude-arithmetic/',

  plugins: [react(), tailwindcss()],

  // 路径别名（推荐写法）
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // 构建优化
  build: {
    sourcemap: false,   // 生产环境关闭 sourcemap，体积更小
  },

  // 本地开发服务器
  server: {
    hmr: true,
  },

  // 本地预览（npm run preview）
  preview: {
    port: 4173,
    open: true,
  },
});