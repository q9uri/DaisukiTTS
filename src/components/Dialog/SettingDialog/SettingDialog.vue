<template>
  <QDialog
    v-model="settingDialogOpenedComputed"
    maximized
    transitionShow="jump-up"
    transitionHide="jump-down"
    class="setting-dialog transparent-backdrop"
  >
    <QLayout container view="hHh Lpr fFf" class="bg-background">
      <QPageContainer class="root">
        <QHeader class="q-py-sm">
          <QToolbar>
            <!-- close button -->
            <QBtn
              round
              flat
              icon="sym_r_close"
              color="display"
              aria-label="設定を閉じる"
              @click="settingDialogOpenedComputed = false"
            />
            <QToolbarTitle class="text-display">オプション</QToolbarTitle>
          </QToolbar>
        </QHeader>
        <QPage ref="scroller" class="scroller">
          <div class="q-pa-md row items-start q-gutter-md">
            <!-- Engine Mode Card -->
            <QCard flat class="setting-card">
              <QCardActions>
                <h5 class="text-h5">音声合成エンジン</h5>
                <template v-if="engineIds.length > 1">
                  <QSpace />
                  <QSelect
                    v-model="selectedEngineId"
                    borderless
                    dense
                    name="engine"
                    :options="engineIds"
                    :optionLabel="renderEngineNameLabel"
                  />
                </template>
              </QCardActions>
              <ButtonToggleCell
                v-model="engineUseGpu"
                title="エンジンモード"
                description="GPU モードの利用には dGPU 搭載の PC が必要です。"
                :options="engineUseGpuOptions"
                :disable="!gpuSwitchEnabled(selectedEngineId)"
              >
                <!-- <QTooltip
                  :delay="150"
                  :target="!gpuSwitchEnabled(selectedEngineId)"
                >
                  {{ engineInfos[selectedEngineId].name }}
                  は CPU 版のため、GPU モードは利用できません。
                </QTooltip> -->
                <QTooltip
                  :delay="150"
                  :target="!gpuSwitchEnabled(selectedEngineId)"
                >
                  対応する GPU が搭載されていないため、GPU モードは利用できません。
                </QTooltip>
              </ButtonToggleCell>
              <QCardActions class="q-px-md bg-surface-darken">
                <div>音声のサンプリングレート</div>
                <div
                  aria-label="再生と保存時の音声のサンプリングレートを変更できます（サンプリングレートを上げても音声の品質は上がりません）。"
                >
                  <QIcon name="sym_r_help_outline" size="sm" class="help-hover-icon">
                    <QTooltip
                      :delay="150"
                      anchor="center right"
                      self="center left"
                      transitionShow="jump-right"
                      transitionHide="jump-left"
                    >
                      再生・保存時の音声のサンプリングレートを変更できます。サンプリングレートを上げても音声の品質は上がりません。
                    </QTooltip>
                  </QIcon>
                </div>
                <QSpace />
                <QSelect
                  v-model="outputSamplingRate"
                  borderless
                  dense
                  name="samplingRate"
                  :options="samplingRateOptions"
                  :optionLabel="renderSamplingRateLabel"
                >
                </QSelect>
              </QCardActions>
            </QCard>
            <!-- Preservation Setting -->
            <QCard flat class="setting-card">
              <QCardActions>
                <h5 class="text-h5">操作</h5>
              </QCardActions>
              <ToggleCell
                title="プリセット機能"
                description="プリセット機能を有効にします。パラメータを登録したり適用したりできます。"
                :modelValue="enablePreset"
                @update:modelValue="changeEnablePreset"
              />
              <QSlideTransition>
                <!-- q-slide-transitionはheightだけをアニメーションするのでdivで囲う -->
                <div v-show="enablePreset">
                  <ToggleCell
                    title="スタイル変更時にデフォルトプリセットを適用"
                    description="話者やスタイルの変更時にデフォルトプリセットを自動的に適用します。"
                    class="in-slide-transition-workaround"
                    :modelValue="
                      shouldApplyDefaultPresetOnVoiceChanged
                    "
                    @update:modelValue="changeShouldApplyDefaultPresetOnVoiceChanged"
                  />
                </div>
              </QSlideTransition>
              <ToggleCell
                title="パラメータの引き継ぎ"
                description="テキスト欄追加時に、現在の話速などのパラメータを引き継ぎます。"
                :modelValue="inheritAudioInfoMode"
                @update:modelValue="changeinheritAudioInfo"
              />
              <ButtonToggleCell
                v-model="activePointScrollMode"
                title="再生位置を追従"
                description="音声再生中の、詳細調整欄の自動スクロールのモードを選べます。"
                :options="[
                  {
                    label: '連続',
                    value: 'CONTINUOUSLY',
                    description: '現在の再生位置を真ん中に表示します。',
                  },
                  {
                    label: 'ページめくり',
                    value: 'PAGE',
                    description:
                      '現在の再生位置が表示範囲外にある場合にスクロールします。',
                  },
                  {
                    label: 'オフ',
                    value: 'OFF',
                    description: '自動でスクロールしません。',
                  },
                ]"
              />
              <ButtonToggleCell
                title="テキスト自動分割"
                description="テキスト貼り付け時のテキストの分割箇所を選べます。"
                :modelValue="splitTextWhenPaste"
                :options="[
                  {
                    label: '句点と改行',
                    value: 'PERIOD_AND_NEW_LINE',
                    description: '句点と改行をもとにテキストを分割します。',
                  },
                  {
                    label: '改行',
                    value: 'NEW_LINE',
                    description: '改行のみをもとにテキストを分割します。',
                  },
                  {
                    label: 'オフ',
                    value: 'OFF',
                    description: '分割を行いません。',
                  },
                ]"
                @update:modelValue="
                  changeSplitTextWhenPaste(
                    $event as RootMiscSettingType['splitTextWhenPaste'],
                  )
                "
              />
              <ToggleCell
                title="メモ機能"
                description="ON にすると、テキストを [] で囲むことで、テキスト中にメモを書けます。"
                :modelValue="enableMemoNotation"
                @update:modelValue="changeEnableMemoNotation"
              />
              <ToggleCell
                title="ルビ機能"
                description="ON にすると、テキストに {ルビ対象|よみかた} と書くことで、テキストの読み方を変えられます。"
                :modelValue="enableRubyNotation"
                @update:modelValue="changeEnableRubyNotation"
              />
              <QCardActions class="q-px-md bg-surface-darken">
                <div>非表示にしたヒントを全て再表示</div>
                <div
                  aria-label="過去に非表示にしたヒントを全て再表示できます。"
                >
                  <QIcon name="sym_r_help_outline" size="sm" class="help-hover-icon">
                    <QTooltip
                      :delay="150"
                      anchor="center right"
                      self="center left"
                      transitionShow="jump-right"
                      transitionHide="jump-left"
                    >
                      過去に非表示にしたヒントを全て再表示できます。
                    </QTooltip>
                  </QIcon>
                </div>
                <QSpace />
                <!-- ボタンクリックのフィードバックのためのチェックマーク -->
                <QIcon
                  v-if="isDefaultConfirmedTips && hasResetConfirmedTips"
                  name="sym_r_check"
                  size="sm"
                  color="primary"
                  style="margin-right: 8px"
                >
                </QIcon>
                <QBtn
                  label="再表示する"
                  unelevated
                  color="background"
                  textColor="display"
                  class="text-no-wrap q-mr-sm"
                  :disable="isDefaultConfirmedTips"
                  @click="
                    () => {
                      store.actions.RESET_CONFIRMED_TIPS();
                      hasResetConfirmedTips = true;
                    }
                  "
                >
                </QBtn>
              </QCardActions>
            </QCard>
            <!-- Saving Card -->
            <QCard flat class="setting-card">
              <QCardActions>
                <h5 class="text-h5">保存</h5>
              </QCardActions>
              <QCardActions class="q-px-md bg-surface-darken">
                <div>書き出し先を固定</div>
                <div
                  aria-label="ON にすると、書き出し先フォルダをあらかじめ指定できます。"
                >
                  <QIcon name="sym_r_help_outline" size="sm" class="help-hover-icon">
                    <QTooltip
                      :delay="150"
                      anchor="center right"
                      self="center left"
                      transitionShow="jump-right"
                      transitionHide="jump-left"
                    >
                      ON にすると、書き出し先フォルダをあらかじめ指定できます。
                    </QTooltip>
                  </QIcon>
                </div>
                <QSpace />
                <QInput
                  v-if="savingSetting.fixedExportEnabled"
                  dense
                  maxheight="10px"
                  label="書き出し先のフォルダ"
                  hideBottomSpace
                  readonly
                  :modelValue="savingSetting.fixedExportDir"
                  :inputStyle="{
                    width: `${savingSetting.fixedExportDir.length / 2 + 1}em`,
                    minWidth: '150px',
                    maxWidth: '450px',
                  }"
                  @update:modelValue="
                    (event) => {
                      if (event == null) throw 'event is null';
                      handleSavingSettingChange('fixedExportDir', event);
                    }
                  "
                >
                  <template #append>
                    <QBtn
                      square
                      dense
                      flat
                      color="primary"
                      icon="sym_r_folder_open"
                      @click="selectFixedExportDir()"
                    >
                      <QTooltip :delay="150" anchor="bottom left">
                        フォルダ選択
                      </QTooltip>
                    </QBtn>
                  </template>
                </QInput>
                <QToggle
                  :modelValue="savingSetting.fixedExportEnabled"
                  @update:modelValue="
                    handleSavingSettingChange('fixedExportEnabled', $event)
                  "
                >
                </QToggle>
              </QCardActions>

              <FileNameTemplateDialog
                  v-model:open-dialog="showAudioFilePatternEditDialog"
                  :savedTemplate="audioFileNamePattern"
                  :defaultTemplate="DEFAULT_AUDIO_FILE_NAME_TEMPLATE"
                  :availableTags="[
                    'index',
                    'characterName',
                    'styleName',
                    'text',
                    'date',
                    'projectName',
                  ]"
                  :fileNameBuilder="buildAudioFileNameFromRawData"
                  extension=".wav"
                  @update:template="
                    handleSavingSettingChange('fileNamePattern', $event)
                  "
                />

              <QCardActions class="q-px-md bg-surface-darken">
                <div>書き出しファイル名パターン</div>
                <div
                  aria-label="書き出し時のファイル名パターンをカスタマイズできます。"
                >
                  <QIcon name="sym_r_help_outline" size="sm" class="help-hover-icon">
                    <QTooltip
                      :delay="150"
                      anchor="center right"
                      self="center left"
                      transitionShow="jump-right"
                      transitionHide="jump-left"
                    >
                      書き出し時のファイル名パターンをカスタマイズできます。
                    </QTooltip>
                  </QIcon>
                </div>
                <QSpace />
                <div class="q-px-sm text-ellipsis">
                  {{ savingSetting.fileNamePattern }}
                </div>
                <QBtn
                  label="編集する"
                  unelevated
                  color="background"
                  textColor="display"
                  class="text-no-wrap q-mr-sm"
                  @click="showAudioFilePatternEditDialog = true"
                />
              </QCardActions>

              <ToggleCell
                title="上書き防止"
                description="書き出し時に同名ファイルが既にあったとき、ファイル名に連番を付けて別名で保存します。"
                :modelValue="savingSetting.avoidOverwrite"
                @update:modelValue="
                  handleSavingSettingChange('avoidOverwrite', $event)
                "
              />
              <ButtonToggleCell
                title="文字コード"
                description="テキストファイルを書き出すときの文字コードを選べます。"
                :modelValue="savingSetting.fileEncoding"
                :options="[
                  { label: 'UTF-8', value: 'UTF-8' },
                  { label: 'Shift_JIS', value: 'Shift_JIS' },
                ]"
                @update:modelValue="
                  handleSavingSettingChange('fileEncoding', $event)
                "
              />
              <ToggleCell
                title="txt ファイルを書き出し"
                description="音声書き出し時にテキストを txt ファイルとして書き出します。"
                :modelValue="savingSetting.exportText"
                @update:modelValue="
                  handleSavingSettingChange('exportText', $event)
                "
              />
              <ToggleCell
                title="lab ファイルを書き出し"
                description="音声書き出し時にリップシンク用の lab ファイルを書き出します。"
                :modelValue="savingSetting.exportLab"
                @update:modelValue="
                  handleSavingSettingChange('exportLab', $event)
                "
              />
            </QCard>
            <!-- Theme Card -->
            <QCard flat class="setting-card">
              <QCardActions>
                <h5 class="text-h5">外観</h5>
              </QCardActions>
              <!-- <ButtonToggleCell
                v-model="currentThemeNameComputed"
                title="テーマ"
                description="エディタの色を選べます。"
                :options="availableThemeNameComputed"
              />
              <ButtonToggleCell
                title="フォント"
                description="エディタのフォントを選べます。"
                :modelValue="editorFont"
                :options="[
                  { label: 'デフォルト', value: 'default' },
                  { label: 'OS標準', value: 'os' },
                ]"
                @update:modelValue="changeEditorFont($event as EditorFontType)"
              /> -->
              <ToggleCell
                title="行番号の表示"
                description="テキスト欄の左側に行番号を表示します。"
                :modelValue="showTextLineNumber"
                @update:modelValue="changeShowTextLineNumber"
              />
              <ToggleCell
                title="テキスト追加ボタンの表示"
                description="OFF にしたときは、右下にテキスト追加ボタンが表示されません。(テキスト欄は Shift + Enter で追加できます)"
                :modelValue="showAddAudioItemButton"
                @update:modelValue="changeShowAddAudioItemButton"
              />
            </QCard>

            <!-- Advanced Card -->
            <QCard flat class="setting-card">
              <QCardActions>
                <h5 class="text-h5">高度な設定</h5>
              </QCardActions>
              <ToggleCell
                title="マルチエンジン機能"
                description="複数の VOICEVOX API 互換音声合成エンジンを利用可能にします。"
                :modelValue="enableMultiEngine"
                @update:modelValue="setEnableMultiEngine"
              />
              <ToggleCell
                title="音声をステレオ化"
                description="音声データをモノラルからステレオに変換してから再生・保存を行います。"
                :modelValue="savingSetting.outputStereo"
                @update:modelValue="
                  handleSavingSettingChange('outputStereo', $event)
                "
              />
              <QCardActions
                class="q-px-md bg-surface-darken"
                :class="{ disabled: !canSetAudioOutputDevice }"
              >
                <div>再生デバイス</div>
                <div aria-label="音声の再生デバイスを変更できます。">
                  <QIcon name="sym_r_help_outline" size="sm" class="help-hover-icon">
                    <QTooltip
                      :delay="150"
                      anchor="center right"
                      self="center left"
                      transitionShow="jump-right"
                      transitionHide="jump-left"
                    >
                      音声の再生デバイスを変更できます。
                      <template v-if="!canSetAudioOutputDevice">
                        この機能はお使いの環境でサポートされていないため、使用できません。
                      </template>
                    </QTooltip>
                  </QIcon>
                </div>
                <QSpace />
                <QSelect
                  v-model="currentAudioOutputDeviceComputed"
                  :disable="!canSetAudioOutputDevice"
                  dense
                  name="audioOutputDevice"
                  :options="availableAudioOutputDevices"
                  class="col-7"
                >
                </QSelect>
              </QCardActions>
            </QCard>

            <!-- Experimental Card -->
            <QCard flat class="setting-card">
              <QCardActions>
                <div class="text-h5">実験的機能</div>
              </QCardActions>
              <!-- 今後実験的機能を追加する場合はここに追加 -->
              <!-- <ToggleCell
                title="疑問文を自動調整"
                description="ONの場合、疑問文の語尾の音高が自動的に上げられます。"
                :modelValue="experimentalSetting.enableInterrogativeUpspeak"
                @update:modelValue="
                  changeExperimentalSetting(
                    'enableInterrogativeUpspeak',
                    $event,
                  )
                "
              />
              <ToggleCell
                title="モーフィング機能"
                description="ONの場合、モーフィング機能を有効にします。2つの音声混ぜられるようになります。"
                :modelValue="experimentalSetting.enableMorphing"
                @update:modelValue="
                  changeExperimentalSetting('enableMorphing', $event)
                "
              /> -->
              <ToggleCell
                title="複数選択"
                description="複数のテキスト欄を選択できるようにします。"
                :modelValue="experimentalSetting.enableMultiSelect"
                @update:modelValue="
                  changeExperimentalSetting('enableMultiSelect', $event)
                "
              />
              <ToggleCell
                title="調整結果の保持"
                description="テキスト変更時、同じ読みのアクセント区間内の調整結果を保持します。"
                :modelValue="experimentalSetting.shouldKeepTuningOnTextChange"
                @update:modelValue="
                  changeExperimentalSetting(
                    'shouldKeepTuningOnTextChange',
                    $event,
                  )
                "
              />
              <!-- <ToggleCell
                title="ソング：ピッチ編集機能"
                description="ONの場合、ピッチ編集モードに切り替えて音の高さを変えられるようになります。"
                :modelValue="experimentalSetting.enablePitchEditInSongEditor"
                @update:modelValue="
                  changeExperimentalSetting(
                    'enablePitchEditInSongEditor',
                    $event,
                  )
                "
              /> -->
            </QCard>
            <QCard flat class="setting-card">
              <QCardActions>
                <h5 class="text-h5">データ収集</h5>
              </QCardActions>
              <ToggleCell
                title="ソフトウェア利用状況のデータ収集を許可"
                description="ON にすると、各 UI の利用率などのデータが送信され、AivisSpeech の改善に役立てられます。テキストデータ・音声データは送信されません。"
                :modelValue="acceptRetrieveTelemetryComputed"
                @update:modelValue="acceptRetrieveTelemetryComputed = $event"
              />
            </QCard>
          </div>
        </QPage>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>

<script setup lang="ts">
import { computed, ref, watchEffect } from "vue";
import FileNameTemplateDialog from "./FileNameTemplateDialog.vue";
import ToggleCell from "./ToggleCell.vue";
import ButtonToggleCell from "./ButtonToggleCell.vue";
import { useStore } from "@/store";
import {
  DEFAULT_AUDIO_FILE_NAME_TEMPLATE,
  buildAudioFileNameFromRawData,
} from "@/store/utility";
import {
  SavingSetting,
  EngineSettingType,
  ExperimentalSettingType,
  ActivePointScrollMode,
  RootMiscSettingType,
  EngineId,
} from "@/type/preload";
import { createLogger } from "@/domain/frontend/log";
import { useRootMiscSetting } from "@/composables/useRootMiscSetting";

type SamplingRateOption = EngineSettingType["outputSamplingRate"];

const props = defineProps<{
  modelValue: boolean;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", val: boolean): void;
}>();

const store = useStore();
const { warn } = createLogger("SettingDialog");

const settingDialogOpenedComputed = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

const engineUseGpu = computed({
  get: () => {
    return store.state.engineSettings[selectedEngineId.value].useGpu;
  },
  set: (mode: boolean) => {
    void changeUseGpu(mode);
  },
});
const engineIds = computed(() => store.state.engineIds);
const engineInfos = computed(() => store.state.engineInfos);
const inheritAudioInfoMode = computed(() => store.state.inheritAudioInfo);
const activePointScrollMode = computed({
  get: () => store.state.activePointScrollMode,
  set: (activePointScrollMode: ActivePointScrollMode) => {
    void store.actions.SET_ACTIVE_POINT_SCROLL_MODE({
      activePointScrollMode,
    });
  },
});
const experimentalSetting = computed(() => store.state.experimentalSetting);

// 非表示にしたヒントの再表示
const hasResetConfirmedTips = ref(false);
const isDefaultConfirmedTips = computed(() => {
  const confirmedTips = store.state.confirmedTips;
  // すべて false (= 初期値) かどうか確認
  return Object.values(confirmedTips).every((v) => !v);
});

// ソング：元に戻すトラック操作
// const undoableTrackOperationsLabels = {
//   soloAndMute: "ミュート・ソロ",
//   panAndGain: "パン・音量",
// };
// const undoableTrackOperations = computed({
//   get: () => store.state.undoableTrackOperations,
//   set: (undoableTrackOperations) => {
//     void store.actions.SET_ROOT_MISC_SETTING({
//       key: "undoableTrackOperations",
//       value: undoableTrackOperations,
//     });
//   },
// });

// 外観
// const currentThemeNameComputed = computed({
//   get: () => store.state.currentTheme,
//   set: (currentTheme: string) => {
//     void store.actions.SET_CURRENT_THEME_SETTING({ currentTheme });
//   },
// });

// const availableThemeNameComputed = computed(() => {
//   return [...store.state.availableThemes]
//     .sort((a, b) => a.order - b.order)
//     .map((theme) => {
//       return { label: theme.displayName, value: theme.name };
//     });
// });

// const [editorFont, changeEditorFont] = useRootMiscSetting(store, "editorFont");

const [enableMultiEngine, setEnableMultiEngine] = useRootMiscSetting(
  store,
  "enableMultiEngine",
);

const [showTextLineNumber, changeShowTextLineNumber] = useRootMiscSetting(
  store,
  "showTextLineNumber",
);

const [showAddAudioItemButton, changeShowAddAudioItemButton] =
  useRootMiscSetting(store, "showAddAudioItemButton");

const [enableMemoNotation, changeEnableMemoNotation] = useRootMiscSetting(
  store,
  "enableMemoNotation",
);

const [enableRubyNotation, changeEnableRubyNotation] = useRootMiscSetting(
  store,
  "enableRubyNotation",
);

const [enablePreset, _changeEnablePreset] = useRootMiscSetting(
  store,
  "enablePreset",
);

const [
  shouldApplyDefaultPresetOnVoiceChanged,
  changeShouldApplyDefaultPresetOnVoiceChanged,
] = useRootMiscSetting(store, "shouldApplyDefaultPresetOnVoiceChanged");

const canSetAudioOutputDevice = computed(() => {
  return !!HTMLAudioElement.prototype.setSinkId;
});
const currentAudioOutputDeviceComputed = computed<
  | {
    key: string;
    label: string;
  }
  | undefined
>({
  get: () => {
    // 再生デバイスが見つからなかったらデフォルト値に戻す
    // FIXME: watchなどにしてgetter内で操作しないようにする
    const device = availableAudioOutputDevices.value?.find(
      (device) => device.key === store.state.savingSetting.audioOutputDevice,
    );
    if (device) {
      return device;
    } else if (store.state.savingSetting.audioOutputDevice !== "default") {
      handleSavingSettingChange("audioOutputDevice", "default");
    }
    return undefined;
  },
  set: (device) => {
    if (device) {
      handleSavingSettingChange("audioOutputDevice", device.key);
    }
  },
});

const availableAudioOutputDevices = ref<{ key: string; label: string }[]>();
const updateAudioOutputDevices = async () => {
  const devices = await navigator.mediaDevices.enumerateDevices();
  availableAudioOutputDevices.value = devices
    .filter((device) => device.kind === "audiooutput")
    .map((device) => {
      return { label: device.label, key: device.deviceId };
    });
};
if (navigator.mediaDevices) {
  navigator.mediaDevices.addEventListener(
    "devicechange",
    updateAudioOutputDevices,
  );
  void updateAudioOutputDevices();
} else {
  warn("navigator.mediaDevices is not available.");
}

const acceptRetrieveTelemetryComputed = computed({
  get: () => store.state.acceptRetrieveTelemetry == "Accepted",
  set: (acceptRetrieveTelemetry: boolean) => {
    void store.actions.SET_ACCEPT_RETRIEVE_TELEMETRY({
      acceptRetrieveTelemetry: acceptRetrieveTelemetry ? "Accepted" : "Refused",
    });

    if (acceptRetrieveTelemetry) {
      return;
    }

    void store.actions.SHOW_MESSAGE_DIALOG({
      type: "warning-light",
      title: "データ収集を無効化しました",
      message:
        "ソフトウェア利用状況のデータ収集を完全に無効にするには、AivisSpeech を再起動する必要があります。",
      ok: "OK",
    });
  },
});

const changeUseGpu = async (useGpu: boolean) => {
  void store.actions.SHOW_LOADING_SCREEN({
    message: "起動モードを変更中です...",
  });

  await store.actions.CHANGE_USE_GPU({
    useGpu,
    engineId: selectedEngineId.value,
  });

  void store.actions.HIDE_ALL_LOADING_SCREEN();
};

const changeinheritAudioInfo = async (inheritAudioInfo: boolean) => {
  if (store.state.inheritAudioInfo === inheritAudioInfo) return;
  void store.actions.SET_INHERIT_AUDIOINFO({ inheritAudioInfo });
};

const changeEnablePreset = (value: boolean) => {
  if (value) {
    // プリセット機能をONにしたときは「デフォルトプリセットを自動で適用」もONにする
    _changeEnablePreset(true);
    changeShouldApplyDefaultPresetOnVoiceChanged(true);
  } else {
    _changeEnablePreset(false);
    changeShouldApplyDefaultPresetOnVoiceChanged(false);
  }
};

const changeExperimentalSetting = async (
  key: keyof ExperimentalSettingType,
  data: boolean,
) => {
  void store.actions.SET_EXPERIMENTAL_SETTING({
    experimentalSetting: { ...experimentalSetting.value, [key]: data },
  });
};

const savingSetting = computed(() => store.state.savingSetting);

const engineUseGpuOptions = [
  { label: "CPU", value: false },
  { label: "GPU", value: true },
];

const audioFileNamePattern = computed(
  () => store.state.savingSetting.fileNamePattern,
);
// const songTrackFileNamePattern = computed(
//   () => store.state.savingSetting.songTrackFileNamePattern,
// );
// const audioFileNamePatternWithExt = computed(() =>
//   audioFileNamePattern.value ? audioFileNamePattern.value + ".wav" : "",
// );
// const songTrackFileNamePatternWithExt = computed(() =>
//   songTrackFileNamePattern.value ? songTrackFileNamePattern.value + ".wav" : "",
// );

const gpuSwitchEnabled = (engineId: EngineId) => {
  // CPU版でもGPUモードからCPUモードに変更できるようにする
  return store.getters.ENGINE_CAN_USE_GPU(engineId) || engineUseGpu.value;
};

const samplingRateOptions: SamplingRateOption[] = [
  "engineDefault",
  24000,
  44100,
  48000,
  88200,
  96000,
];
const renderSamplingRateLabel = (value: SamplingRateOption): string => {
  if (value === "engineDefault") {
    return "デフォルト";
  } else {
    return `${value / 1000} kHz`;
  }
};

const handleSavingSettingChange = (
  key: keyof SavingSetting,
  data: string | boolean | number,
) => {
  void store.actions.SET_SAVING_SETTING({
    data: { ...savingSetting.value, [key]: data },
  });
};

const outputSamplingRate = computed({
  get: () => {
    return store.state.engineSettings[selectedEngineId.value]
      .outputSamplingRate;
  },
  set: async (outputSamplingRate: SamplingRateOption) => {
    if (outputSamplingRate !== "engineDefault") {
      const result = await store.actions.SHOW_CONFIRM_DIALOG({
        title: "出力サンプリングレートを変更しますか？",
        message:
          "出力サンプリングレートを変更しても、音質は向上しません。また、音声の生成処理に若干時間がかかる場合があります。",
        actionName: "変更する",
      });
      if (result !== "OK") {
        return;
      }
    }

    void store.actions.SET_ENGINE_SETTING({
      engineId: selectedEngineId.value,
      engineSetting: {
        ...store.state.engineSettings[selectedEngineId.value],
        outputSamplingRate,
      },
    });
  },
});

const openFileExplore = () => {
  return window.backend.showSaveDirectoryDialog({
    title: "書き出し先のフォルダを選択",
  });
};

const selectFixedExportDir = async () => {
  const path = await openFileExplore();
  if (path != undefined) {
    handleSavingSettingChange("fixedExportDir", path);
  }
};

// 書き出し先を固定を有効にしたときに書き出し先が未選択の場合は自動的にダイアログを表示する
watchEffect(async () => {
  if (
    savingSetting.value.fixedExportEnabled &&
    savingSetting.value.fixedExportDir === ""
  ) {
    const path = await openFileExplore();
    if (path != undefined) {
      handleSavingSettingChange("fixedExportDir", path);
    } else {
      // キャンセルした場合書き出し先の固定を無効化する
      handleSavingSettingChange("fixedExportEnabled", false);
    }
  }
});

const [splitTextWhenPaste, changeSplitTextWhenPaste] = useRootMiscSetting(
  store,
  "splitTextWhenPaste",
);

const showAudioFilePatternEditDialog = ref(false);
// const showSongTrackAudioFilePatternEditDialog = ref(false);

const selectedEngineIdRaw = ref<EngineId | undefined>(undefined);
const selectedEngineId = computed({
  get: () => {
    return selectedEngineIdRaw.value || engineIds.value[0];
  },
  set: (engineId: EngineId) => {
    selectedEngineIdRaw.value = engineId;
  },
});
const renderEngineNameLabel = (engineId: EngineId) => {
  return engineInfos.value[engineId].name;
};
</script>

<style scoped lang="scss">
@use "@/styles/visually-hidden" as visually-hidden;
@use "@/styles/colors" as colors;

.text-h5 {
  margin: 0;
  margin-bottom: 8px;
}

.setting-dialog {
  .q-field__control {
    color: colors.$primary;
  }
}

.help-hover-icon {
  margin-left: 6px;
  color: colors.$display;
  opacity: 0.5;
}

.hotkey-table {
  width: 100%;
}

.setting-card {
  @extend .hotkey-table;
  min-width: 475px;
  background: colors.$background;
}

.text-ellipsis {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.setting-dialog .q-layout-container :deep(.absolute-full) {
  right: 0 !important;
  .scroll {
    left: unset !important;
    right: unset !important;
    width: unset !important;
    max-height: unset;
  }
}

.root {
  .scroller {
    overflow-y: scroll;
    > div {
      position: absolute;
      left: 0;
      right: 0;
    }
  }
}
</style>
