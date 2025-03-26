<template>
  <div class="title-bar-buttons-container bg-primary">
    <QBadge
      v-if="$q.platform.is.mac"
      transparent
      color="transparent"
      textColor="display"
      class="full-height cursor-not-allowed no-border-radius"
    >
      <QBtn
        v-if="isPinned"
        id="pinned-btn"
        dense
        flat
        round
        icon="sym_r_push_pin"
        class="title-bar-buttons"
        aria-label="最前面固定を解除"
        @click="changePinWindow()"
      >
        <QTooltip :delay="150" :offset="[0, 8]">
          最前面固定を解除
        </QTooltip>
      </QBtn>
      <QBtn
        v-else
        id="pinned-btn"
        dense
        flat
        round
        icon="sym_r_push_pin"
        color="display"
        class="title-bar-buttons rotate-45"
        aria-label="最前面に固定"
        @click="changePinWindow()"
      >
        <QTooltip :delay="150" :offset="[0, 8]">
          最前面に固定
        </QTooltip>
      </QBtn>
    </QBadge>
    <QBadge
      v-else
      transparent
      color="transparent"
      textColor="display"
      class="full-height cursor-not-allowed no-border-radius title-bar-buttons-root"
    >
      <QBtn
        v-if="isPinned"
        id="pinned-btn"
        dense
        flat
        round
        icon="sym_r_push_pin"
        class="title-bar-buttons"
        aria-label="最前面固定を解除"
        @click="changePinWindow()"
      >
        <QTooltip :delay="150" :offset="[0, 8]">
          最前面固定を解除
        </QTooltip>
      </QBtn>
      <QBtn
        v-else
        id="pinned-btn"
        dense
        flat
        round
        icon="sym_r_push_pin"
        class="title-bar-buttons rotate-45"
        aria-label="最前面に固定"
        @click="changePinWindow()"
      >
        <QTooltip :delay="150" :offset="[0, 8]">
          最前面に固定
        </QTooltip>
      </QBtn>
    </QBadge>
    <MinMaxCloseButtons v-if="!$q.platform.is.mac" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useQuasar } from "quasar";
import MinMaxCloseButtons from "./MinMaxCloseButtons.vue";
import { useStore } from "@/store";

const $q = useQuasar();
const store = useStore();

const changePinWindow = () => {
  window.backend.changePinWindow();
};

const isPinned = computed(() => store.state.isPinned);
</script>

<style scoped lang="scss">
.q-badge {
  padding: 0;
  margin-left: 0;
}

.title-bar-buttons-container {
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 2000;
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
}
</style>
