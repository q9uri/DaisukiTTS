<template>
  <QCardActions class="no-wrap q-px-md bg-surface-darken" :class="props.class">
    <div>
      <div>{{ title }}</div>
      <div :aria-label="description">
        <!-- <QIcon name="sym_r_help_outline" size="sm" class="help-hover-icon">
          <QTooltip
            :delay="150"
            anchor="center right"
            self="center left"
            transitionShow="jump-right"
            transitionHide="jump-left"
          >
            {{ description }}
          </QTooltip>
        </QIcon> -->
        <div class="text-caption">
          {{ description }}
        </div>
      </div>
    </div>
    <QSpace />
    <slot />
  </QCardActions>
</template>

<script setup lang="ts">
export type Props = {
  title: string;
  description: string;
  class?: unknown; // 型はquasarの定義を真似ている
};

const props = defineProps<Props>();
</script>

<style scoped lang="scss">
@use "@/styles/visually-hidden" as visually-hidden;
@use "@/styles/colors" as colors;

.help-hover-icon {
  margin-left: 6px;
  color: colors.$display;
  opacity: 0.5;
}

.text-caption {
  font-size: 0.75rem;
  line-height: 1.25rem;
  letter-spacing: 0.03333em;
  margin-top: 2px;
  color: #c6c6c6;
}
</style>