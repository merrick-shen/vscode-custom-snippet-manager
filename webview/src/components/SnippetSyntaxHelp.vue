<!-- 片段语法帮助组件：折叠展示 VS Code SnippetString 完整语法 -->
<script setup lang="ts">
import { Icon } from '@iconify/vue'

const { t } = useI18n()

// 展开/折叠状态
const expanded = ref(false)

// 切换展开状态
function toggle() {
  expanded.value = !expanded.value
}

// VS Code SnippetString 完整语法说明
const sections = computed(() => [
  {
    title: t('syntax.basicTitle'),
    items: [
      { code: '$1, $2, $3...', desc: t('syntax.tabstop') },
      { code: '$0', desc: t('syntax.tabstopFinal') },
      { code: '${1:label}', desc: t('syntax.placeholder') },
      { code: '${1|a,b,c|}', desc: t('syntax.choice') },
    ],
  },
  {
    title: t('syntax.selectionTitle'),
    items: [
      { code: '$TM_SELECTED_TEXT', desc: t('syntax.selectedText') },
      { code: '$TM_CURRENT_LINE', desc: t('syntax.currentLine') },
      { code: '$TM_CURRENT_WORD', desc: t('syntax.currentWord') },
      { code: '$TM_LINE_INDEX', desc: t('syntax.lineIndex') },
      { code: '$TM_LINE_NUMBER', desc: t('syntax.lineNumber') },
      { code: '$CURSOR_INDEX', desc: t('syntax.cursorIndex') },
      { code: '$CURSOR_NUMBER', desc: t('syntax.cursorNumber') },
    ],
  },
  {
    title: t('syntax.fileTitle'),
    items: [
      { code: '$TM_FILENAME', desc: t('syntax.filename') },
      { code: '$TM_FILENAME_BASE', desc: t('syntax.filenameBase') },
      { code: '$TM_DIRECTORY', desc: t('syntax.directory') },
      { code: '$TM_FILEPATH', desc: t('syntax.filepath') },
      { code: '$RELATIVE_FILEPATH', desc: t('syntax.relativeFilepath') },
      { code: '$WORKSPACE_NAME', desc: t('syntax.workspaceName') },
      { code: '$WORKSPACE_FOLDER', desc: t('syntax.workspaceFolder') },
    ],
  },
  {
    title: t('syntax.clipboardTitle'),
    items: [{ code: '$CLIPBOARD', desc: t('syntax.clipboard') }],
  },
  {
    title: t('syntax.dateTitle'),
    items: [
      { code: '$CURRENT_YEAR', desc: t('syntax.currentYear') },
      { code: '$CURRENT_YEAR_SHORT', desc: t('syntax.currentYearShort') },
      { code: '$CURRENT_MONTH', desc: t('syntax.currentMonth') },
      { code: '$CURRENT_MONTH_NAME', desc: t('syntax.currentMonthName') },
      { code: '$CURRENT_MONTH_NAME_SHORT', desc: t('syntax.currentMonthNameShort') },
      { code: '$CURRENT_DATE', desc: t('syntax.currentDate') },
      { code: '$CURRENT_DAY_NAME', desc: t('syntax.currentDayName') },
      { code: '$CURRENT_DAY_NAME_SHORT', desc: t('syntax.currentDayNameShort') },
      { code: '$CURRENT_HOUR', desc: t('syntax.currentHour') },
      { code: '$CURRENT_HOUR12', desc: t('syntax.currentHour12') },
      { code: '$CURRENT_MINUTE', desc: t('syntax.currentMinute') },
      { code: '$CURRENT_SECOND', desc: t('syntax.currentSecond') },
      { code: '$CURRENT_SECONDS_UNIX', desc: t('syntax.currentSecondsUnix') },
      { code: '$CURRENT_TIMEZONE_OFFSET', desc: t('syntax.currentTimezoneOffset') },
    ],
  },
  {
    title: t('syntax.randomTitle'),
    items: [
      { code: '$RANDOM', desc: t('syntax.random') },
      { code: '$RANDOM_HEX', desc: t('syntax.randomHex') },
      { code: '$UUID', desc: t('syntax.uuid') },
    ],
  },
  {
    title: t('syntax.commentTitle'),
    items: [
      { code: '$BLOCK_COMMENT_START', desc: t('syntax.blockCommentStart') },
      { code: '$BLOCK_COMMENT_END', desc: t('syntax.blockCommentEnd') },
      { code: '$LINE_COMMENT', desc: t('syntax.lineComment') },
    ],
  },
  {
    title: t('syntax.transformTitle'),
    items: [
      { code: '${TM_FILENAME/(.*)\\..+$/$1/}', desc: t('syntax.transform') },
    ],
  },
  {
    title: t('syntax.escapeTitle'),
    items: [
      { code: '\\$', desc: t('syntax.escapeDollar') },
      { code: '\\}', desc: t('syntax.escapeBrace') },
      { code: '\\\\', desc: t('syntax.escapeBackslash') },
    ],
  },
])
</script>

<template>
  <div class="syntax-help" :class="{ 'syntax-help--expanded': expanded }">
    <button class="syntax-help__header" type="button" @click="toggle">
      <Icon icon="carbon:code" width="16" height="16" />
      <span class="syntax-help__title syntax-help__title--short">{{ t('syntax.shortTitle') }}</span>
      <span class="syntax-help__title syntax-help__title--full">{{ t('syntax.title') }}</span>
      <Icon
        class="syntax-help__arrow"
        icon="carbon:chevron-down"
        width="16"
        height="16"
      />
    </button>
    <transition name="expand">
      <div v-show="expanded" class="syntax-help__body">
        <div
          v-for="(section, sIdx) in sections"
          :key="sIdx"
          class="syntax-help__section"
        >
          <h4 class="syntax-help__section-title">{{ section.title }}</h4>
          <div class="syntax-help__grid">
            <div
              v-for="(item, iIdx) in section.items"
              :key="iIdx"
              class="syntax-help__item"
            >
              <code class="syntax-help__code">{{ item.code }}</code>
              <span class="syntax-help__desc">{{ item.desc }}</span>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped lang="scss">
.syntax-help {
  position: absolute;
  right: 12px;
  bottom: 12px;
  display: flex;
  flex-direction: column;
  width: auto;
  max-height: 32px;
  border: none;
  border-radius: 16px;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  overflow: hidden;
  pointer-events: auto;
  box-shadow: $shadow-primary-btn;
  transition: all 0.25s ease;

  &--expanded {
    right: 0;
    bottom: 0;
    width: 100%;
    max-height: 100%;
    border: 1px solid $border-input;
    border-radius: $radius-lg;
    background: var(--vscode-editor-background);
    color: $color-foreground;
    box-shadow: none;
  }

  &__header {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    width: 100%;
    padding: 6px 10px;
    border: none;
    background: transparent;
    color: inherit;
    font-size: $font-size-sm;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s;
    white-space: nowrap;

    &:hover {
      background: var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.05));
    }

    .syntax-help--expanded & {
      padding: 10px $spacing-md;
    }
  }

  &__title {
    flex: 1;
    text-align: left;

    &--short {
      display: inline;
    }

    &--full {
      display: none;
    }
  }

  &--expanded &__title {
    &--short {
      display: none;
    }

    &--full {
      display: inline;
    }
  }

  &__arrow {
    display: none;
    transition: transform 0.2s ease;
  }

  &--expanded &__arrow {
    display: inline;
    transform: rotate(180deg);
  }

  &__body {
    flex: 1 1 auto;
    min-height: 0;
    padding: 0 $spacing-md 12px;
    border-top: 1px solid $border-input;
    overflow-y: auto;
  }

  &__section {
    padding-top: 12px;

    & + & {
      border-top: 1px solid $border-input;
      margin-top: 10px;
    }
  }

  &__section-title {
    margin: 0 0 8px;
    font-size: $font-size-xs;
    font-weight: 600;
    color: $color-foreground;
    opacity: 0.8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px 16px;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    min-width: 0;
  }

  &__code {
    padding: 2px 6px;
    border-radius: $radius-sm;
    background: var(--vscode-textCodeBlock-background, rgba(120, 120, 120, 0.2));
    color: var(--vscode-textPreformat-foreground, #d4d4d4);
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: $font-size-xs;
    white-space: nowrap;
  }

  &__desc {
    color: $color-description;
    font-size: $font-size-xs;
    @include text-ellipsis;
  }
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 420px;
}
</style>
