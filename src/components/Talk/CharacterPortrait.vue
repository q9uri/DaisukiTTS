<template>
  <div class="character-portrait-wrapper">
    <div class="character-portrait">
      <div
        class="character-portrait-image"
        :style="{ backgroundImage: `url(${portraitPath})` }"
      ></div>
    </div>
    <div class="character-name">{{ characterName }}</div>
    <div class="character-engine-name">Engine: {{ engineName }}</div>
    <div v-if="isInitializingSpeaker" class="loading">
      <QSpinner color="primary" size="5rem" :thickness="4" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "@/store";
import { AudioKey } from "@/type/preload";
import { formatCharacterStyleName } from "@/store/utility";

const store = useStore();

const characterInfo = computed(() => {
  const activeAudioKey: AudioKey | undefined = store.getters.ACTIVE_AUDIO_KEY;
  const audioItem = activeAudioKey
    ? store.state.audioItems[activeAudioKey]
    : undefined;

  const engineId = audioItem?.voice.engineId;
  const styleId = audioItem?.voice.styleId;

  if (
    engineId == undefined ||
    styleId == undefined ||
    !store.state.engineIds.some((id) => id === engineId)
  )
    return undefined;

  return store.getters.CHARACTER_INFO(engineId, styleId);
});

const styleInfo = computed(() => {
  const activeAudioKey = store.getters.ACTIVE_AUDIO_KEY;

  const audioItem = activeAudioKey
    ? store.state.audioItems[activeAudioKey]
    : undefined;

  const styleId = audioItem?.voice.styleId;
  const style = characterInfo.value?.metas.styles.find(
    (style) => style.styleId === styleId,
  );
  return style;
});

const characterName = computed(() => {
  // 初期化前・未選択時
  if (characterInfo.value == undefined) {
    return "（表示エラー）";
  }

  const speakerName = characterInfo.value.metas.speakerName;
  const styleName = styleInfo.value?.styleName;
  return styleName
    ? formatCharacterStyleName(speakerName, styleName)
    : speakerName;
});

const engineName = computed(() => {
  const activeAudioKey = store.getters.ACTIVE_AUDIO_KEY;
  const audioItem = activeAudioKey
    ? store.state.audioItems[activeAudioKey]
    : undefined;
  const engineId = audioItem?.voice.engineId ?? store.state.engineIds[0];
  const engineManifest = store.state.engineManifests[engineId];
  const engineInfo = store.state.engineInfos[engineId];
  return engineManifest ? engineManifest.brandName : (engineInfo ? engineInfo.name : "取得中...");
});

const portraitPath = computed(
  () => styleInfo.value?.iconPath || characterInfo.value?.portraitPath,
);

const isInitializingSpeaker = computed(() => {
  const activeAudioKey = store.getters.ACTIVE_AUDIO_KEY;
  return (
    activeAudioKey &&
    store.state.audioKeysWithInitializingSpeaker.includes(activeAudioKey)
  );
});

// const isMultipleEngine = computed(() => store.state.engineIds.length > 1);
</script>

<style scoped lang="scss">
@use "@/styles/variables" as vars;
@use "@/styles/colors" as colors;

.character-portrait-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  text-align: center;
  .loading {
    position: absolute;
    width: 100%;
    height: 100%;
    background-color: rgba(colors.$background-rgb, 0.3);
    display: grid;
    justify-content: center;
    align-content: center;
  }
  .character-name {
    margin: 0px 12px;
    font-size: 16px;
    font-weight: bold;
    // ref: https://qiita.com/debiru/items/0a349bee3669b776d8e2
    word-break: keep-all;
    overflow-wrap: anywhere;
  }
  .character-engine-name {
    margin: 0px 12px;
    margin-top: 3px;
    margin-bottom: 20px;
    font-size: 13.5px;
    color: rgba(var(--color-display-rgb), 0.8);
  }
  .character-portrait {
    width: 100%;
    min-height: 0;
    padding: 24px;
  }
  .character-portrait-image {
    max-height: 100%;
    margin: 0 auto;
    aspect-ratio: 1 / 1;
    background-position: center top;
    background-size: contain;
    background-color: var(--color-splitter);
    clip-path: vars.$squircle;
  }
}
</style>
