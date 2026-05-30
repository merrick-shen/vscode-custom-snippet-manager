<!-- 策略选项按钮：图标 + 名称 + 描述 -->
<script setup lang="ts">
defineProps<{
  /** 图标名称，如 carbon:edit */
  icon: string
  /** 策略名称 */
  name: string
  /** 策略描述 */
  desc: string
  /** 是否为危险样式 */
  danger?: boolean
}>()

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <button class="strategy-option" :class="{ 'strategy-option-danger': danger }" @click="emit('click')">
    <div class="strategy-header">
      <Icon :icon="icon" width="16" height="16" />
      <span class="strategy-name">{{ name }}</span>
    </div>
    <span class="strategy-desc">{{ desc }}</span>
  </button>
</template>

<style scoped lang="scss">
.strategy-option {
  @include flex-column;
  gap: $spacing-xs;
  padding: 10px 14px;
  border: 1px solid $border-input;
  border-radius: $radius-md;
  background: $bg-input;
  color: $color-foreground;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: background-color 0.15s, border-color 0.15s;

  &:hover {
    background: $bg-list-hover;
    border-color: $color-focus;
  }
}

.strategy-option-danger:hover {
  border-color: $color-error;
}

.strategy-header {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
}

.strategy-name {
  font-size: $font-size-base;
  font-weight: 600;
}

.strategy-desc {
  font-size: $font-size-xs;
  color: $color-description;
  padding-left: 24px;
}
</style>
