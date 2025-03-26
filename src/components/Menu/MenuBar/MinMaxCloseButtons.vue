<template>
  <QBadge
    v-if="$q.platform.is.mac"
    transparent
    color="transparent"
    textColor="display"
    class="full-height cursor-not-allowed no-border-radius"
  >
    <QBtn
      dense
      flat
      round
      icon="sym_r_lens"
      size="8.5px"
      color="red"
      class="title-bar-buttons"
      aria-label="閉じる"
      @click="closeWindow()"
    ></QBtn>
    <QBtn
      dense
      flat
      round
      icon="sym_r_lens"
      size="8.5px"
      color="yellow"
      class="title-bar-buttons"
      aria-label="最小化"
      @click="minimizeWindow()"
    ></QBtn>
    <QBtn
      dense
      flat
      round
      icon="sym_r_lens"
      size="8.5px"
      color="green"
      class="title-bar-buttons"
      aria-label="最大化"
      @click="toggleMaximizeWindow()"
    ></QBtn>
  </QBadge>
  <QBadge
    v-else
    transparent
    color="transparent"
    textColor="display"
    class="full-height cursor-not-allowed no-border-radius title-bar-buttons-root"
  >
    <QBtn
      dense
      flat
      icon="sym_r_minimize"
      class="title-bar-buttons"
      aria-label="最小化"
      @click="minimizeWindow()"
    ></QBtn>

    <QBtn
      v-if="isMaximized || isFullscreen"
      dense
      flat
      :icon="mdiWindowRestore"
      class="title-bar-buttons"
      aria-label="最大化"
      @click="toggleMaximizeWindow()"
    >
    </QBtn>

    <QBtn
      v-else
      dense
      flat
      icon="sym_r_crop_square"
      class="title-bar-buttons"
      aria-label="最大化"
      @click="toggleMaximizeWindow()"
    ></QBtn>

    <QBtn
      dense
      flat
      icon="sym_r_close"
      class="title-bar-buttons close"
      aria-label="閉じる"
      @click="closeWindow()"
    ></QBtn>
  </QBadge>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { mdiWindowRestore } from "@quasar/extras/mdi-v5";
import { useQuasar } from "quasar";
import { useStore } from "@/store";

const $q = useQuasar();
const store = useStore();

const closeWindow = async () => {
  void store.actions.CHECK_EDITED_AND_NOT_SAVE({ closeOrReload: "close" });
};
const minimizeWindow = () => window.backend.minimizeWindow();
const toggleMaximizeWindow = () => window.backend.toggleMaximizeWindow();

const isMaximized = computed(() => store.state.isMaximized);
const isFullscreen = computed(() => store.getters.IS_FULLSCREEN);
</script>

<style scoped lang="scss">
.q-badge {
  padding: 0;
}

.title-bar-buttons-root {
  z-index: 2000;
}

.title-bar-buttons {
  overflow: visible;
  ::v-deep(span.q-focus-helper) {
    background-color: #ffffff !important;
    transition: opacity 0.15s cubic-bezier(0.25, 0.8, 0.5, 1) !important;
  }
  &:hover {
    ::v-deep(span.q-focus-helper) {
      opacity: 0.2 !important;
      &:before {
        opacity: 0 !important;
      }
      &:after {
        opacity: 0 !important;
      }
    }
  }
  &.close {
    margin-right: 4px;
    ::v-deep(span.q-focus-helper) {
      background-color: #e81123 !important;
    }
    &:hover {
      ::v-deep(span.q-focus-helper) {
        opacity: 1 !important;
      }
    }
  }
}

.close:hover {
  ::v-deep(.q-focus-helper) {
    opacity: 1 !important;
  }
}
</style>
