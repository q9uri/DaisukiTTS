<template>
  <QDialog
    v-model="dialogOpened"
    maximized
    transitionShow="jump-up"
    transitionHide="jump-down"
    class="setting-dialog transparent-backdrop"
  >
    <QLayout container view="hHh Lpr fFf" class="bg-background">
      <QPageContainer>
        <QHeader class="q-py-sm">
          <QToolbar>
            <QBtn
              round
              flat
              icon="sym_r_close"
              color="display"
              @click="closeDialog"
            />
            <QToolbarTitle class="text-display">プリセットを編集</QToolbarTitle>
          </QToolbar>
        </QHeader>

        <QPage class="row no-wrap">
          <!-- 左ペイン: プリセット一覧 -->
          <div class="col-4" style="position: relative; min-width: 260px; flex-shrink: 0; border-right: solid 1px var(--color-surface);">
            <QList v-if="presetList.length > 0" class="preset-list">
              <Draggable
                :modelValue="presetList"
                itemKey="key"
                handle=".drag-handle"
                @update:modelValue="reorderPreset"
              >
                <template #item="{ element: item }">
                  <QItem
                    v-ripple
                    clickable
                    :active="selectedPresetKey === item.key"
                    activeClass="active-preset"
                    class="preset-item"
                    @click="selectPreset(item.key)"
                  >
                    <QItemSection>
                      <QItemLabel class="text-display">{{ item.name }}</QItemLabel>
                    </QItemSection>
                    <QItemSection avatar class="drag-handle">
                      <QIcon name="sym_r_drag_indicator" size="xs" color="grey" />
                    </QItemSection>
                  </QItem>
                </template>
              </Draggable>
            </QList>
          </div>

          <!-- 右ペイン: プリセット編集 -->
          <div class="col-8 preset-detail">
            <div v-if="presetList.length === 0" class="empty-state">
              <div class="empty-state-message">
                <div class="text-h6">プリセットが登録されていません</div>
                <div class="text-caption q-mt-sm">
                  エディター画面右のパラメータを変更した状態で<br>
                  プリセットを新規登録すると追加できます。
                </div>
              </div>
            </div>
            <template v-else-if="selectedPreset && editingPreset">
              <div class="preset-detail-content">
                <div class="parameter-list">
                  <h2 class="preset-name">{{ selectedPreset.name }}</h2>
                  <div class="preset-field">
                    <label for="preset-name">プリセット名</label>
                    <BaseTextField
                      id="preset-name"
                      :modelValue="editingPreset.name"
                      :hasError="!editingPreset.name"
                      @change="changePresetName"
                    />
                  </div>
                  <template
                    v-for="(value, sliderKey) in SLIDER_PARAMETERS"
                    :key="sliderKey"
                  >
                    <ParameterSlider
                      v-if="shouldShowParameter(sliderKey) && editingPreset"
                      :modelValue="Number(editingPreset[sliderKey as keyof Omit<Preset, 'name' | 'morphingInfo'>])"
                      :sliderKey
                      :min="value.min()"
                      :max="value.max()"
                      :step="value.step()"
                      :scrollStep="value.scrollStep()"
                      :label="getParameterLabel(sliderKey)"
                      @update:modelValue="(newValue: number) => { if (editingPreset) editingPreset[sliderKey as keyof Omit<Preset, 'name' | 'morphingInfo'>] = newValue }"
                    />
                  </template>
                  <template
                    v-if="editingPreset && shouldShowMorphing"
                  >
                    <h3 class="parameter-headline">モーフィング</h3>
                    <div class="mophing-style">
                      <CharacterButton
                        :selectedVoice="
                          editingPreset.morphingInfo
                            ? {
                                engineId:
                                  editingPreset.morphingInfo.targetEngineId,
                                speakerId:
                                  editingPreset.morphingInfo.targetSpeakerId,
                                styleId:
                                  editingPreset.morphingInfo.targetStyleId,
                              }
                            : undefined
                        "
                        :characterInfos="morphingTargetCharacters"
                        :showEngineInfo="morphingTargetEngines.length >= 2"
                        :emptiable="true"
                        :uiLocked="false"
                        @update:selectedVoice="
                          if ($event == null) {
                            editingPreset.morphingInfo = undefined;
                          } else {
                            editingPreset.morphingInfo = {
                              targetEngineId: $event.engineId,
                              targetSpeakerId: $event.speakerId,
                              targetStyleId: $event.styleId,
                              rate: editingPreset.morphingInfo?.rate ?? 0.5,
                            };
                          }
                        "
                      />
                      <div class="morphing-info">
                        <div>
                          {{
                            morphingTargetCharacterInfo
                              ? morphingTargetCharacterInfo.metas.speakerName
                              : '未設定'
                          }}
                        </div>
                        <div
                          v-if="
                            morphingTargetCharacterInfo &&
                            morphingTargetCharacterInfo.metas.styles.length >= 2
                          "
                        >
                          （{{ morphingTargetStyleInfo?.styleName }}）
                        </div>
                        <div v-if="editingPreset.morphingInfo" class="text-caption">
                          混ぜる比率: {{ (editingPreset.morphingInfo.rate * 100).toFixed(0) }}%
                        </div>
                      </div>
                    </div>
                    <ParameterSlider
                      v-if="editingPreset.morphingInfo"
                      v-model="editingPreset.morphingInfo.rate"
                      sliderKey="morphingRate"
                      label="割合"
                      :min="SLIDER_PARAMETERS.morphingRate.min()"
                      :max="SLIDER_PARAMETERS.morphingRate.max()"
                      :step="SLIDER_PARAMETERS.morphingRate.step()"
                      :scrollStep="SLIDER_PARAMETERS.morphingRate.scrollStep()"
                    />
                  </template>
                </div>
              </div>
              <div class="fixed-bottom-buttons">
                <QSpace />
                <QBtn
                  outline
                  icon="sym_r_delete"
                  label="削除"
                  textColor="warning"
                  class="text-no-wrap text-bold q-mr-sm"
                  @click="deletePreset(selectedPresetKey)"
                />
                <QBtn
                  outline
                  icon="sym_r_settings_backup_restore"
                  label="変更を破棄"
                  textColor="warning"
                  class="text-no-wrap text-bold q-mr-sm"
                  :disabled="!isPresetChanged"
                  @click="discardChanges"
                />
                <QBtn
                  outline
                  icon="sym_r_save"
                  label="保存"
                  textColor="primary"
                  class="text-no-wrap text-bold q-mr-sm"
                  :disabled="!isPresetChanged"
                  @click="saveChanges"
                >
                  <QTooltip :delay="150" :offset="[0, 8]">
                    変更の保存のみを行う
                  </QTooltip>
                </QBtn>
                <QBtn
                  outline
                  icon="sym_r_save"
                  label="保存して適用"
                  textColor="primary"
                  class="text-no-wrap text-bold"
                  :disabled="!isPresetChanged"
                  @click="saveAndApplyChanges"
                >
                  <QTooltip :delay="150" :offset="[0, 8]">
                    変更を保存し、このプリセットが設定されたテキスト欄すべてに適用する
                  </QTooltip>
                </QBtn>
              </div>
            </template>
          </div>
        </QPage>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import Draggable from "vuedraggable";
import { useStore } from "@/store";
import BaseTextField from "@/components/Base/BaseTextField.vue";
import CharacterButton from "@/components/CharacterButton.vue";
import ParameterSlider from "@/components/Talk/ParameterSlider.vue";
import { useDefaultPreset } from "@/composables/useDefaultPreset";
import type {
  CharacterInfo,
  Preset,
  PresetKey,
  PresetSliderKey,
} from "@/type/preload";
import { SLIDER_PARAMETERS } from "@/store/utility";

const dialogOpened = defineModel<boolean>("dialogOpened", { default: false });

const store = useStore();
const { isDefaultPresetKey } = useDefaultPreset();

const presetItems = computed(() => store.state.presetItems);
const presetKeys = computed(() => store.state.presetKeys);

const presetList = computed(() =>
  presetKeys.value
    .filter((key) => presetItems.value[key] != undefined)
    .filter((key) => !isDefaultPresetKey(key))
    .map((key) => ({
      key,
      ...presetItems.value[key],
    }))
);

type ParameterType = Exclude<PresetSliderKey, "morphingRate">;
const parameterLabels: Record<ParameterType, string> = {
  speedScale: "話速",
  intonationScale: "抑揚",
  tempoDynamicsScale: "テンポの緩急",
  pitchScale: "音高",
  volumeScale: "音量",
  pauseLengthScale: "間の長さ",
  prePhonemeLength: "開始無音（秒）",
  postPhonemeLength: "終了無音（秒）",
};

const selectedPresetKey = ref<PresetKey>();
const selectedPreset = computed(() =>
  selectedPresetKey.value ? presetItems.value[selectedPresetKey.value] : undefined
);
const editingPreset = ref<Preset | undefined>();

const isPresetChanged = computed(() => {
  if (!selectedPreset.value || !editingPreset.value) return false;
  return JSON.stringify(selectedPreset.value) !== JSON.stringify(editingPreset.value);
});

watch(
  () => dialogOpened.value,
  (newValue) => {
    if (newValue && presetList.value.length > 0) {
      // ダイアログを開いた時に最初のプリセットを選択
      selectPreset(presetList.value[0].key);
    } else if (!newValue) {
      // ダイアログが閉じられた時に状態をリセット
      selectedPresetKey.value = undefined;
      editingPreset.value = undefined;
    }
  },
);

const selectPreset = (key: PresetKey) => {
  if (isPresetChanged.value) {
    void discardChangesWithConfirm(() => {
      selectedPresetKey.value = key;
      editingPreset.value = { ...presetItems.value[key] };
      if (editingPreset.value.morphingInfo) {
        editingPreset.value.morphingInfo = { ...editingPreset.value.morphingInfo };
      }
    });
  } else {
    selectedPresetKey.value = key;
    editingPreset.value = { ...presetItems.value[key] };
    if (editingPreset.value.morphingInfo) {
      editingPreset.value.morphingInfo = { ...editingPreset.value.morphingInfo };
    }
  }
};

const changePresetName = (event: Event) => {
  if (event.target instanceof HTMLInputElement && editingPreset.value) {
    editingPreset.value.name = event.target.value;
  }
};

const discardChangesWithConfirm = async (callback: () => void) => {
  const result = await store.actions.SHOW_WARNING_DIALOG({
    title: "プリセットの変更を破棄しますか？",
    message: "保存されていない変更内容は失われます。",
    actionName: "破棄する",
    isWarningColorButton: true,
  });

  if (result === "OK") {
    callback();
  }
};

const discardChanges = () => {
  if (!selectedPresetKey.value) return;
  void discardChangesWithConfirm(() => {
    if (!selectedPresetKey.value) return;

    // プリセットのディープコピーを作成
    const originalPreset = presetItems.value[selectedPresetKey.value];
    editingPreset.value = JSON.parse(JSON.stringify(originalPreset));
  });
};

const saveChanges = async () => {
  if (!selectedPresetKey.value || !editingPreset.value) return;

  await store.actions.UPDATE_PRESET({
    presetData: editingPreset.value,
    presetKey: selectedPresetKey.value,
  });
};

const saveAndApplyChanges = async () => {
  if (!selectedPresetKey.value || !editingPreset.value) return;

  // プリセットを更新
  await store.actions.UPDATE_PRESET({
    presetData: editingPreset.value,
    presetKey: selectedPresetKey.value,
  });

  // 更新したプリセットを使用しているすべての音声アイテムに適用
  await store.actions.COMMAND_FULLY_APPLY_AUDIO_PRESET({
    presetKey: selectedPresetKey.value,
  });
};

const closeDialog = () => {
  if (isPresetChanged.value) {
    void discardChangesWithConfirm(() => {
      dialogOpened.value = false;
    });
  } else {
    dialogOpened.value = false;
  }
};

const reorderPreset = (featurePresetList: (Preset & { key: PresetKey })[]) => {
  const newPresetKeys = featurePresetList.map((item) => item.key);

  // ストアのアクションを呼び出して順序を保存
  // デフォルトプリセットは表示するlistから除外しているので、元のキーリストから取得して末尾に追加する
  const defaultPresetKeys = presetKeys.value.filter(isDefaultPresetKey);
  void store.actions.SAVE_PRESET_ORDER({
    presetKeys: [...newPresetKeys, ...defaultPresetKeys],
  });
};

const deletePreset = async (key: PresetKey | undefined) => {
  if (!key) return;
  const result = await store.actions.SHOW_WARNING_DIALOG({
    title: "プリセットを削除しますか？",
    message: `プリセット「${presetItems.value[key].name}」を削除します。`,
    actionName: "削除する",
    isWarningColorButton: true,
  });
  if (result === "OK") {
    await store.actions.DELETE_PRESET({
      presetKey: key,
    });
    // 削除後、次のプリセットを選択
    if (presetList.value.length > 0) {
      const nextPreset = presetList.value[0];
      selectPreset(nextPreset.key);
    } else {
      selectedPresetKey.value = undefined;
      editingPreset.value = undefined;
    }
  }
};

const shouldShowMorphing = computed(
  () => store.state.experimentalSetting.enableMorphing,
);

const morphingTargetEngines = store.getters.MORPHING_SUPPORTED_ENGINES;

const morphingTargetCharacters = computed<CharacterInfo[]>(() => {
  const allCharacterInfos = store.getters.USER_ORDERED_CHARACTER_INFOS("talk");
  if (allCharacterInfos == undefined)
    throw new Error("USER_ORDERED_CHARACTER_INFOS == undefined");

  // AivisSpeech Engine の話者は除外
  const filteredCharacterInfos = allCharacterInfos.filter(character => {
    const styles = character.metas.styles;
    return styles.length > 0 && styles[0].engineId !== store.getters.DEFAULT_ENGINE_ID;
  });

  return filteredCharacterInfos;
});

const morphingTargetCharacterInfo = computed(() =>
  store.getters
    .USER_ORDERED_CHARACTER_INFOS("talk")
    ?.find(
      (character) =>
        character.metas.speakerUuid ===
        editingPreset.value?.morphingInfo?.targetSpeakerId,
    ),
);

const morphingTargetStyleInfo = computed(() => {
  const morphingInfo = editingPreset.value?.morphingInfo;

  if (!morphingInfo) return;

  return morphingTargetCharacterInfo.value?.metas.styles.find(
    (style) =>
      style.engineId === morphingInfo.targetEngineId &&
      style.styleId === morphingInfo.targetStyleId,
  );
});

// AivisSpeech Engine (デフォルトエンジン) かどうかを判定
const isAivisSpeechEngine = computed(() => {
  if (!selectedPreset.value || !editingPreset.value) return false;
  // 現在のエンジンIDを取得
  const currentEngineId = store.state.engineIds[0]; // デフォルトエンジンを使用
  return store.getters.DEFAULT_ENGINE_ID === currentEngineId;
});

// パラメータの表示判定
const shouldShowParameter = (sliderKey: PresetSliderKey) => {
  if (isAivisSpeechEngine.value) {
    // AivisSpeech Engine では pauseLengthScale は非表示
    if (sliderKey === "pauseLengthScale") return false;
  } else {
    // 他のエンジンでは tempoDynamicsScale は非表示
    if (sliderKey === "tempoDynamicsScale") return false;
  }
  return sliderKey in parameterLabels;
};

// パラメータのラベル取得
const getParameterLabel = (sliderKey: PresetSliderKey): string => {
  if (isAivisSpeechEngine.value) {
    // AivisSpeech Engine での特殊なラベル
    if (sliderKey === "intonationScale") return "感情表現の強さ";
  }
  return parameterLabels[sliderKey as ParameterType] ?? "";
};
</script>

<style scoped lang="scss">
@use "@/styles/colors" as colors;
@use "@/styles/variables" as vars;
@use "@/styles/v2/variables" as v2_vars;
@use "@/styles/v2/mixin" as mixin;

.preset-list {
  height: calc(
    100vh - #{vars.$menubar-height + vars.$toolbar-height +
      vars.$window-border-width}
  );
  overflow-y: auto;
}

.active-preset {
  padding-right: 12px;
  background: hsl(206 66% 32% / 1);
  border-right: 4px solid colors.$primary;
}

.preset-item {
  transition: background-color 0.2s ease;

  &:hover {
    background-color: hsla(0, 0%, 50%, 0.1);
  }
}

.drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  min-width: 32px;
  max-width: 32px;
  cursor: grab;

  &:active {
    cursor: grabbing;
  }
}

.preset-detail {
  .preset-detail-content {
    height: calc(
      100vh - #{vars.$menubar-height + vars.$toolbar-height +
        vars.$window-border-width} - 66px
    );
    padding: 16px;
    overflow-y: auto;
  }

  .fixed-bottom-buttons {
    display: flex;
    justify-content: flex-end;
    padding: 16px;
    padding-top: 14px;
    height: 66px;
    border-top: 2px solid var(--color-splitter);
  }
}

.empty-state {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: rgba(colors.$display-rgb, 0.7);
  padding: 16px;

  .empty-state-message {
    max-width: 300px;
  }
}

.parameter-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: v2_vars.$gap-2;
}

.preset-name {
  @include mixin.headline-1;
  flex-direction: column;
  font-size: 1.5rem;
  word-break: break-all;
}

.preset-field {
  display: flex;
  flex-direction: column;
  gap: v2_vars.$gap-1;
}

.parameter-headline {
  @include mixin.headline-2;
}

.mophing-style {
  display: flex;
  align-items: center;
  gap: v2_vars.$gap-1;
}

.morphing-info {
  display: flex;
  flex-direction: column;
  gap: v2_vars.$gap-1;
}
</style>
