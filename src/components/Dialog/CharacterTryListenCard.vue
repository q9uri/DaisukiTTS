<template>
  <QItem
    v-ripple="isHoverableItem"
    clickable
    class="q-pa-none character-item"
    :class="[
      isHoverableItem && 'hoverable-character-item',
      isSelected && 'selected-character-item',
    ]"
    @click="
      selectCharacter(speakerUuid);
      togglePlayOrStop(speakerUuid, selectedStyle, 0);
    "
  >
    <div class="character-item-inner">
      <img
        :src="characterInfo.metas.styles[selectedStyleIndex || 0].iconPath"
        :alt="characterInfo.metas.speakerName"
        class="style-icon"
      />
      <span
        class="text-subtitle1 q-ma-sm"
        style="font-weight: bold; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;"
      >
        {{ characterInfo.metas.speakerName }}
      </span>
      <div
        v-if="characterInfo.metas.styles.length > 1"
        class="style-select-container"
      >
        <QBtn
          flat
          dense
          icon="sym_r_chevron_left"
          textColor="display"
          class="style-select-button"
          aria-label="前のスタイル"
          @mouseenter="isHoverableItem = false"
          @mouseleave="isHoverableItem = true"
          @click.stop="
            selectCharacter(speakerUuid);
            rollStyleIndex(speakerUuid, -1);
          "
        />
        <span aria-live="polite">{{
          selectedStyle.styleName || DEFAULT_STYLE_NAME
        }}</span>
        <QBtn
          flat
          dense
          icon="sym_r_chevron_right"
          textColor="display"
          class="style-select-button"
          aria-label="次のスタイル"
          @mouseenter="isHoverableItem = false"
          @mouseleave="isHoverableItem = true"
          @click.stop="
            selectCharacter(speakerUuid);
            rollStyleIndex(speakerUuid, 1);
          "
        />
      </div>
      <div class="voice-samples">
        <QBtn
          v-for="voiceSampleIndex of [
            ...Array(selectedStyle.voiceSamplePaths.length).keys(),
          ]"
          :key="voiceSampleIndex"
          round
          unelevated
          :icon="
            playing != undefined &&
            speakerUuid === playing.speakerUuid &&
            selectedStyle.styleId === playing.styleId &&
            voiceSampleIndex === playing.index
              ? 'sym_r_stop'
              : 'sym_r_play_arrow'
          "
          color="primary"
          class="voice-sample-btn"
          :aria-label="`サンプルボイス${voiceSampleIndex + 1}`"
          @mouseenter="isHoverableItem = false"
          @mouseleave="isHoverableItem = true"
          @click.stop="
            selectCharacter(speakerUuid);
            togglePlayOrStop(speakerUuid, selectedStyle, voiceSampleIndex);
          "
        />
      </div>
      <div
        v-if="isNewCharacter"
        class="new-character-item q-pa-sm text-weight-bold"
      >
        NEW!
      </div>
    </div>
  </QItem>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { CharacterInfo, SpeakerId, StyleId, StyleInfo } from "@/type/preload";
import { DEFAULT_STYLE_NAME } from "@/store/utility";

const props = defineProps<{
  characterInfo: CharacterInfo;
  isSelected: boolean;
  isNewCharacter?: boolean;
  playing?: {
    speakerUuid: SpeakerId;
    styleId: StyleId;
    index: number;
  };
  togglePlayOrStop: (
    speakerUuid: SpeakerId,
    styleInfo: StyleInfo,
    index: number,
  ) => void;
}>();

const emit = defineEmits<{
  (event: "update:selectCharacter", speakerUuid: SpeakerId): void;
  (event: "update:portrait", portrait: string): void;
}>();

// キャラクター枠のホバー状態を表示するかどうか
// 再生ボタンなどにカーソルがある場合はキャラクター枠のホバーUIを表示しないようにするため
const isHoverableItem = ref(true);

const selectCharacter = (speakerUuid: SpeakerId) => {
  emit("update:selectCharacter", speakerUuid);
  updatePortrait();
};

const updatePortrait = () => {
  let portraitPath = props.characterInfo.portraitPath;
  const stylePortraitPath = selectedStyle.value.portraitPath;
  if (stylePortraitPath) {
    portraitPath = stylePortraitPath;
  }
  emit("update:portrait", portraitPath);
};

const speakerUuid = computed(() => props.characterInfo.metas.speakerUuid);

// 選択中のスタイル
const selectedStyleIndex = ref<number>(0);
const selectedStyle = computed(
  () => props.characterInfo.metas.styles[selectedStyleIndex.value],
);

// スタイル番号をずらす
const rollStyleIndex = (speakerUuid: SpeakerId, diff: number) => {
  // 0 <= index <= length に収める
  const length = props.characterInfo.metas.styles.length;

  let styleIndex = selectedStyleIndex.value + diff;
  styleIndex = styleIndex < 0 ? length - 1 : styleIndex % length;
  selectedStyleIndex.value = styleIndex;

  // 音声を再生する。同じstyleIndexだったら停止する。
  props.togglePlayOrStop(speakerUuid, selectedStyle.value, 0);
  updatePortrait();
};
</script>

<style lang="scss">
.voice-samples .material-symbols-rounded {
  font-variation-settings: 'FILL' 1, 'wght' 300, 'GRAD' 200, 'opsz' 24 !important;
}
</style>

<style scoped lang="scss">
@use "@/styles/variables" as vars;
@use "@/styles/colors" as colors;

.character-item {
  height: 230px;
  background: #363A3F;
  border: 1.5px #3B3E43 solid;
  box-shadow: 0px 1px 4px rgba(0, 0, 0, 0.25);
  border-radius: 10px;
  overflow: hidden;
  &.selected-character-item {
    border: none;
    box-shadow: 0 0 0 2px colors.$primary;
  }
  &:hover :deep(.q-focus-helper) {
    opacity: 0 !important;
  }
  &.hoverable-character-item:hover :deep(.q-focus-helper) {
    opacity: 0.15 !important;
  }
  .character-item-inner {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
    .style-icon {
      width: 100px;
      height: 100px;
      clip-path: vars.$squircle;
      background-color: var(--color-splitter);
      border-radius: 5px;
    }
    .style-select-container {
      display: flex;
      flex-direction: row;
      justify-content: center;
      align-items: center;
      margin-top: -12px;
      padding-bottom: 4px;
    }
    .voice-samples {
      display: flex;
      height: 42px;
      column-gap: 5px;
      align-items: center;
      justify-content: center;
      .voice-sample-btn {
        box-shadow: 0px 1px 4px rgba(0, 0, 0, 0.25);
      }
    }
    .new-character-item {
      color: colors.$primary;
      position: absolute;
      left: 0px;
      top: 0px;
    }
  }
}
</style>
