<!-- 应用根组件：根据后端注入的 __VIEW_MODE 标识决定渲染侧边栏视图或编辑器视图 -->
<script setup lang="ts">
/**
 * 应用根组件
 * 侧边栏和编辑器共用同一套 Vue 构建产物，通过视图模式区分
 */
import { computed } from 'vue'
import SidebarView from './views/SidebarView.vue'
import EditorView from './views/EditorView.vue'

// 读取后端注入的视图模式标识，默认为 sidebar
const viewMode = computed(() => window.__VIEW_MODE || 'sidebar')
</script>

<template>
  <SidebarView v-if="viewMode === 'sidebar'" />
  <EditorView v-else />
</template>

<style>
/* 全局盒模型重置 */
* {
  box-sizing: border-box;
}

/* 基础样式：适配 VS Code 主题变量 */
body {
  margin: 0;
  padding: 0;
  background-color: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
  font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
  font-size: 13px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

/* 自定义滚动条样式，与 VS Code 风格一致 */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--vscode-scrollbarSlider-background);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--vscode-scrollbarSlider-hoverBackground);
}
</style>
