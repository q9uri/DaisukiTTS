<template>
  <div v-show="isWordEditing" class="col-8 no-wrap text-no-wrap word-editor">
    <div ref="modelDetailContent" class="model-detail-content">
      <div v-if="isNewWordEditing" class="row q-px-md q-mt-lg">
        <div class="text-h5 text-display">新しい単語を追加</div>
      </div>
      <div class="row q-px-md q-mt-md">
        <div class="pronunciation-items-container">
          <!-- アイテム配列をループして表示 -->
          <div class="pronunciation-items-wrapper">
            <div
              v-for="(item, accentPhraseIndex) in wordAccentPhraseItems"
              :key="accentPhraseIndex"
              class="pronunciation-item"
            >
              <!-- 単語入力 -->
              <div class="row">
                <QInput
                  :ref="(el: any) => { if (el) surfaceContexts[accentPhraseIndex].inputRef = el; }"
                  v-model="item.surface"
                  class="word-input"
                  outlined
                  label="単語"
                  placeholder="単語を入力"
                  :disable="uiLocked"
                  @focus="surfaceContexts[accentPhraseIndex]?.helper?.clearInputSelection()"
                  @blur="handleSurfaceBlur(accentPhraseIndex)"
                  @keydown.enter="yomiFocus(accentPhraseIndex, $event)"
                >
                  <ContextMenu
                    :ref="(el: any) => { if (el) surfaceContexts[accentPhraseIndex].contextMenuRef = el; }"
                    :header="surfaceContexts[accentPhraseIndex]?.helper?.contextMenuHeader"
                    :menudata="surfaceContexts[accentPhraseIndex]?.helper?.contextMenudata"
                    @beforeShow="surfaceContexts[accentPhraseIndex]?.helper?.startContextMenuOperation()"
                    @beforeHide="surfaceContexts[accentPhraseIndex]?.helper?.endContextMenuOperation()"
                  />
                </QInput>
              </div>

              <!-- 読み入力 -->
              <div class="row q-pt-sm">
                <QInput
                  :ref="(el: any) => { if (el) yomiContexts[accentPhraseIndex].inputRef = el; }"
                  v-model="item.pronunciation"
                  class="word-input q-pb-none"
                  outlined
                  label="読み"
                  placeholder="読みを入力"
                  :error="!item.isValid"
                  :disable="uiLocked"
                  @focus="yomiContexts[accentPhraseIndex]?.helper?.clearInputSelection()"
                  @blur="handleYomiBlur(accentPhraseIndex)"
                  @keydown.enter="setYomiWhenEnter(accentPhraseIndex, $event)"
                >
                  <template #error>
                    読みに使える文字はひらがなとカタカナのみです。
                  </template>
                  <ContextMenu
                    :ref="(el: any) => { if (el) yomiContexts[accentPhraseIndex].contextMenuRef = el; }"
                    :header="yomiContexts[accentPhraseIndex]?.helper?.contextMenuHeader"
                    :menudata="yomiContexts[accentPhraseIndex]?.helper?.contextMenudata"
                    @beforeShow="yomiContexts[accentPhraseIndex]?.helper?.startContextMenuOperation()"
                    @beforeHide="yomiContexts[accentPhraseIndex]?.helper?.endContextMenuOperation()"
                  />
                </QInput>
              </div>
            </div>
          </div>

          <!-- 右側の追加・削除ボタン -->
          <div class="pronunciation-controls">
            <!-- 最大 10 個までしか追加できない -->
            <QBtn
              round
              dense
              flat
              icon="sym_r_add"
              color="primary"
              :disable="uiLocked || wordAccentPhraseItems.length >= 10"
              class="add-button"
              @click="addWordAccentPhraseItem"
            />
            <!-- 最低 1 個は残しておく -->
            <QBtn
              round
              dense
              flat
              icon="sym_r_remove"
              color="warning"
              :disable="uiLocked || wordAccentPhraseItems.length <= 1"
              class="remove-button"
              @click="removeLastWordAccentPhraseItem"
            />
          </div>
        </div>
      </div>
      <div class="row no-wrap q-px-md q-mb-md desc-row" style="align-items: center; margin-top: 24px; white-space: normal;">
        <QIcon name="sym_r_warning" color="warning-light" size="19px" class="q-mr-sm" />
        <div>
          音声合成エンジンは、読み上げやすくするために内部でテキストを変換しています。<br>
          この際、英単語はカタカナに、一部の日時・記号・単位などは日本語の読み方に置き換えられます。<br>
          ユーザー辞書はこの変換後のテキストに適用されるため、元の単語に日時・記号・単位などが含まれていると、意図通りに反映されない場合があります。
        </div>
      </div>
      <div class="row q-px-md q-mt-md text-h6">品詞</div>
      <div class="row q-px-md q-mt-sm q-mb-md desc-row" style="white-space: normal;">
        登録する単語の品詞を選択してください。適切に設定すると、ユーザー辞書の適用精度が向上します。
      </div>
      <div class="row q-px-md q-pr-md">
        <QSelect
          v-model="wordTypeModel"
          class="word-input"
          outlined
          :options="Object.entries(wordTypeLabels).map(([value, label]) => ({ value, label }))"
          :disable="uiLocked"
          dense
          emitValue
          mapOptions
        />
      </div>
      <div class="row q-px-md q-mt-md text-h6">アクセント調整</div>
      <div class="row q-px-md q-mt-sm q-mb-md desc-row">
        語尾のアクセントを考慮して調整できるように、自動的に「が」が挿入されます。
      </div>
      <div class="row q-px-md" style="height: 130px">
        <div class="play-button">
          <QBtn
            v-if="!nowPlaying && !nowGenerating"
            fab
            color="primary"
            textColor="display-on-primary"
            icon="sym_r_play_arrow"
            @click="play"
          />
          <QBtn
            v-else
            fab
            color="primary"
            textColor="display-on-primary"
            icon="sym_r_stop"
            :disable="nowGenerating"
            @click="stop"
          />
        </div>
        <div
          class="accent-phrase-table overflow-hidden-y"
        >
          <!-- 各アクセント句ごとのアクセント表示 -->
          <div v-for="(item, accentPhraseIndex) in wordAccentPhraseItems" v-show="item.accentPhrase" :key="accentPhraseIndex" class="accent-block">
            <div class="mora-table">
              <AudioAccent
                v-if="item.accentPhrase"
                :accentPhrase="item.accentPhrase"
                :accentPhraseIndex="0"
                :uiLocked
                :onChangeAccentPosition="(_, accent) => handleChangeAccentPosition(accentPhraseIndex, accent)"
              />
              <template
                v-for="(mora, moraIndex) in item.accentPhrase?.moras || []"
                :key="moraIndex"
              >
                <div
                  class="text-cell"
                  :style="{
                    gridColumn: `${moraIndex * 2 + 1} / span 1`,
                  }"
                >
                  {{ mora.text }}
                </div>
                <div
                  v-if="moraIndex < (item.accentPhrase?.moras.length || 0) - 1"
                  class="splitter-cell"
                  :style="{
                    gridColumn: `${moraIndex * 2 + 2} / span 1`,
                  }"
                />
              </template>
            </div>
          </div>
        </div>
      </div>
      <div class="row q-px-md q-mt-md text-h6">単語優先度</div>
      <div class="row q-px-md q-mt-sm q-mb-lg desc-row">
        単語を登録しても反映されないときは、単語優先度を徐々に上げてみてください。
      </div>
      <div
        class="row q-px-md q-pb-md"
        :style="{
          justifyContent: 'center',
        }"
      >
        <QSlider
          v-model="wordPriorityModel"
          snap
          dense
          color="primary"
          markers
          :min="0"
          :max="10"
          :step="1"
          :markerLabels="wordPriorityLabels"
          :style="{
            width: '80%',
          }"
        />
      </div>
    </div>
    <div class="fixed-bottom-buttons">
      <QSpace />
      <QBtn
        v-show="isNewWordEditing"
        outline
        icon="sym_r_close"
        label="キャンセル"
        textColor="display"
        class="text-no-wrap text-bold q-mr-sm"
        :disable="uiLocked"
        @click="handleCancel"
      />
      <QBtn
        v-show="!!selectedId"
        outline
        icon="sym_r_delete"
        label="削除"
        textColor="warning"
        class="text-no-wrap text-bold q-mr-sm"
        :disable="uiLocked"
        @click="$emit('deleteWord')"
      />
      <QBtn
        v-show="!!selectedId"
        outline
        icon="sym_r_settings_backup_restore"
        label="変更を破棄"
        textColor="warning"
        class="text-no-wrap text-bold q-mr-sm"
        :disable="uiLocked || !isWordChanged"
        @click="$emit('resetWord', selectedId)"
      />
      <QBtn
        outline
        icon="sym_r_save"
        label="保存"
        textColor="primary"
        class="text-no-wrap text-bold"
        :disable="isSaveButtonDisabled"
        @click="$emit('saveWord')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, Ref } from "vue";
import { QInput } from "quasar";
import AudioAccent from "@/components/Talk/AudioAccent.vue";
import ContextMenu from "@/components/Menu/ContextMenu/Container.vue";
import type { WordAccentPhraseItem } from "@/composables/useDictionaryEditor";
import { useRightClickContextMenu } from "@/composables/useRightClickContextMenu";
import { createKanaRegex, convertHankakuToZenkaku, wordTypeLabels } from "@/domain/japanese";
import { WordTypes } from "@/openapi";
import { useStore } from "@/store";
import type { FetchAudioResult } from "@/store/type";

const props = defineProps<{
  uiLocked: boolean;
  isWordEditing: boolean;
  isWordChanged: boolean;
  isNewWordEditing: boolean;
  selectedId: string;
  wordAccentPhraseItems: WordAccentPhraseItem[];
  wordType: WordTypes;
  wordPriority: number;
}>();

const emit = defineEmits<{
  (e: "update:surface", value: string, accentPhraseIndex?: number): void;
  (e: "update:pronunciation", value: string, accentPhraseIndex?: number, changeWord?: boolean): void;
  (e: "update:wordType", value: WordTypes): void;
  (e: "update:wordPriority", value: number): void;
  (e: "changeAccentPosition", accentPhraseIndex: number, accent: number): void;
  (e: "addWordAccentPhraseItem"): void;
  (e: "removeWordAccentPhraseItem", accentPhraseIndex: number): void;
  (e: "resetWord", id: string): void;
  (e: "deleteWord"): void;
  (e: "saveWord"): void;
  (e: "cancel"): void;
}>();

// モーダル表示の切り替え時にスクロール位置をリセット
const modelDetailContent = ref<HTMLElement>();
watch(() => props.isNewWordEditing, () => {
  if (modelDetailContent.value) {
    modelDetailContent.value.scrollTop = 0;
  }
});

const wordPriorityLabels = {
  0: "最低",
  3: "低",
  5: "標準",
  7: "高",
  10: "最高",
};

const wordTypeModel = computed({
  get: () => props.wordType,
  set: (val) => emit("update:wordType", val),
});

const wordPriorityModel = computed({
  get: () => props.wordPriority,
  set: (val) => emit("update:wordPriority", val),
});

// 保存ボタンが無効化されているかどうか
const isSaveButtonDisabled = computed(() => {
  // UI がロックされている
  if (props.uiLocked) return true;
  // 保存時からの変更がない
  if (!props.isWordChanged) return true;
  // wordAccentPhraseItems が空（通常発生しないはず）
  if (props.wordAccentPhraseItems.length === 0) return true;
  // どれか一つでもアクセント句情報が生成されていない
  if (props.wordAccentPhraseItems.some(item => !item.accentPhrase)) return true;
  return false;
});

const store = useStore();

// 現在音声生成中かどうか
const nowGenerating = ref(false);
// 現在音声再生中かどうか
const nowPlaying = ref(false);

// 音声合成 -> 再生
const play = async () => {
  // まだ最初のアクセント句情報が生成されていない場合は再生しない
  if (props.wordAccentPhraseItems.length === 0 || !props.wordAccentPhraseItems[0]?.accentPhrase) return;

  nowGenerating.value = true;

  // ユーザーによるソート順で一番先頭にあたるキャラクターの EngineId, StyleId を取得する
  const userOrderedCharacterInfos = store.getters.USER_ORDERED_CHARACTER_INFOS("talk");
  if (!userOrderedCharacterInfos) throw new Error("assert USER_ORDERED_CHARACTER_INFOS");
  if (store.state.engineIds.length === 0) throw new Error("assert engineId.length > 0");
  const characterInfo = userOrderedCharacterInfos[0].metas;
  const speakerId = characterInfo.speakerUuid;
  const { engineId, styleId } = characterInfo.styles[0];

  // 音声合成用の AudioItem を生成
  const audioItem = await store.actions.GENERATE_AUDIO_ITEM({
    // wordAccentPhraseItems 内の surface を結合したものを入力テキストとする
    // AccentPhrase と挙動を合わせるため、末尾に「が」を追加する
    text: props.wordAccentPhraseItems.map(item => item.surface).join("") + "が",
    voice: { engineId, speakerId, styleId },
  });
  if (audioItem.query == undefined)
    throw new Error("assert audioItem.query !== undefined");

  // wordAccentPhraseItems 内にあるアクセント句で AudioQuery.accentPhrases の内容を差し替える
  audioItem.query.accentPhrases = props.wordAccentPhraseItems
    .filter(item => item.accentPhrase)
    .map(item => item.accentPhrase!);

  // 音声合成結果を取得
  let fetchAudioResult: FetchAudioResult;
  try {
    fetchAudioResult = await store.actions.FETCH_AUDIO_FROM_AUDIO_ITEM({
      audioItem,
    });
  } catch (e) {
    window.backend.logError(e);
    nowGenerating.value = false;
    void store.actions.SHOW_ALERT_DIALOG({
      title: "生成に失敗しました",
      message: "エンジンの再起動をお試しください。",
    });
    return;
  }

  // 音声合成結果を再生
  const { blob } = fetchAudioResult;
  nowGenerating.value = false;
  nowPlaying.value = true;
  await store.actions.PLAY_AUDIO_BLOB({ audioBlob: blob });
  nowPlaying.value = false;
};

// 音声合成 -> 再生中の音声を停止
const stop = () => {
  void store.actions.STOP_AUDIO();
};

const handleSurfaceBlur = (accentPhraseIndex = 0) => {
  const value = props.wordAccentPhraseItems[accentPhraseIndex]?.surface || "";
  emit("update:surface", convertHankakuToZenkaku(value), accentPhraseIndex);
};

const handleYomiBlur = (accentPhraseIndex = 0) => {
  const value = props.wordAccentPhraseItems[accentPhraseIndex]?.pronunciation || "";
  void emit("update:pronunciation", value, accentPhraseIndex);
};

const yomiFocus = (accentPhraseIndex = 0, event?: KeyboardEvent) => {
  if (event && event.isComposing) return;
  // @ts-expect-error なぜか inputRef.value ではなく inputRef を参照しないと QInput を適切に参照できない
  // useRightClickContextMenu() にリアクティブ渡すためにトリッキーなことやっているからではありそう
  yomiContexts.value[accentPhraseIndex].inputRef?.focus();
  // もしこの時点で accentPhraseIndex に対応する surface がひらがな・カタカナのみで構成されている場合は、
  // その値をそのまま読み仮名に設定する
  const surface = props.wordAccentPhraseItems[accentPhraseIndex]?.surface || "";
  if (createKanaRegex().test(surface)) {
    void emit("update:pronunciation", surface, accentPhraseIndex);
  }
};

const setYomiWhenEnter = (accentPhraseIndex = 0, event?: KeyboardEvent) => {
  if (event && event.isComposing) return;
  void emit("update:pronunciation", props.wordAccentPhraseItems[accentPhraseIndex]?.pronunciation || "", accentPhraseIndex);
};

// アクセント句を追加
const addWordAccentPhraseItem = () => {
  emit("addWordAccentPhraseItem");
};

// 最後のアクセント句を削除
const removeLastWordAccentPhraseItem = () => {
  emit("removeWordAccentPhraseItem", props.wordAccentPhraseItems.length - 1);
};

// 指定されたアクセント句のアクセント位置を変更
const handleChangeAccentPosition = async (accentPhraseIndex: number, accent: number) => {
  emit("changeAccentPosition", accentPhraseIndex, accent);
};

// キャンセルボタンを押した時の処理
const handleCancel = () => {
  emit("cancel");
};

// 各入力用の状態を保持する型
interface InputContext {
  // inputRef に限り ref を多重掛けする
  inputRef: Ref<Ref<InstanceType<typeof QInput> | undefined>>;
  contextMenuRef: Ref<InstanceType<typeof ContextMenu> | undefined>;
  computedModel: ReturnType<typeof createSurfaceModel>;
  helper: ReturnType<typeof useRightClickContextMenu>;
}

// 表層入力・読み入力用のコンテキスト配列を宣言
const surfaceContexts = ref<InputContext[]>([]);
const yomiContexts = ref<InputContext[]>([]);

function createSurfaceModel(accentPhraseIndex: number) {
  return computed({
    get: () => props.wordAccentPhraseItems[accentPhraseIndex]?.surface || "",
    set: (val: string) => emit("update:surface", val, accentPhraseIndex),
  });
}

function createYomiModel(accentPhraseIndex: number) {
  return computed({
    get: () => props.wordAccentPhraseItems[accentPhraseIndex]?.pronunciation || "",
    set: (val: string) => emit("update:pronunciation", val, accentPhraseIndex),
  });
}

// 入力コンテキストを追加する共通関数
const addInputContext = (accentPhraseIndex: number) => {
  const surfaceModel = createSurfaceModel(accentPhraseIndex);
  const yomiModel = createYomiModel(accentPhraseIndex);

  const surfaceContextMenuRef = ref<InstanceType<typeof ContextMenu>>();
  const surfaceInputRef = ref<InstanceType<typeof QInput>>();
  const surfaceHelper = useRightClickContextMenu(
    surfaceContextMenuRef,
    surfaceInputRef,
    surfaceModel,
  );

  const yomiContextMenuRef = ref<InstanceType<typeof ContextMenu>>();
  const yomiInputRef = ref<InstanceType<typeof QInput>>();
  const yomiHelper = useRightClickContextMenu(
    yomiContextMenuRef,
    yomiInputRef,
    yomiModel,
  );

  surfaceContexts.value.push({
    // inputRef は ref をそのまま渡すのが重要
    // inputRef.value を渡すと SelectionHelperForQInput で QInput を取得できない
    inputRef: surfaceInputRef,
    contextMenuRef: surfaceContextMenuRef.value,
    computedModel: surfaceModel.value,
    // @ts-expect-error 型推論がうまくいかない
    helper: surfaceHelper,
  });

  yomiContexts.value.push({
    // inputRef は ref をそのまま渡すのが重要
    // inputRef.value を渡すと SelectionHelperForQInput で QInput を取得できない
    inputRef: yomiInputRef,
    contextMenuRef: yomiContextMenuRef.value,
    computedModel: yomiModel.value,
    // @ts-expect-error 型推論がうまくいかない
    helper: yomiHelper,
  });
};

// props.wordAccentPhraseItems の数に合わせてコンテキスト配列を初期化
onMounted(() => {
  surfaceContexts.value = [];
  yomiContexts.value = [];

  for (let i = 0; i < props.wordAccentPhraseItems.length; i++) {
    addInputContext(i);
  }
});

// props.wordAccentPhraseItems の長さが変更されたときにコンテキスト配列を調整
watch(
  () => props.wordAccentPhraseItems.length,
  (newLen, oldLen) => {
    if (newLen > (oldLen || 0)) {
      // 新しい項目を追加
      for (let i = oldLen || 0; i < newLen; i++) {
        addInputContext(i);
      }
    } else if (newLen < (oldLen || 0)) {
      // 不要な項目を削除
      surfaceContexts.value.splice(newLen);
      yomiContexts.value.splice(newLen);
    }
  },
  { immediate: true }
);
</script>

<style lang="scss" scoped>
@use '@/styles/colors' as colors;
@use '@/styles/variables' as vars;

.word-editor {
  display: flex;
  flex-flow: column;
  height: calc(
    100vh - #{vars.$menubar-height + vars.$toolbar-height +
      vars.$window-border-width}
  ) !important;
}

.model-detail-content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
  height: calc(100% - 66px);
}

.fixed-bottom-buttons {
  display: flex;
  justify-content: flex-end;
  padding: 16px;
  padding-top: 14px;
  height: 66px;
  border-top: 2px solid var(--color-splitter);
}

.word-input {
  width: 100%;
}

.desc-row {
  color: rgba(colors.$display-rgb, 0.7);
  font-size: 12px;
}

.play-button {
  margin: auto 0;
  padding-right: 16px;
}

// 複数アクセント句対応のためのスタイル
.pronunciation-items-container {
  display: flex;
  width: 100%;
  position: relative;
}

.pronunciation-items-wrapper {
  display: flex;
  gap: 8px;
  width: 100%;
}

.pronunciation-item {
  flex-grow: 1;
  position: relative;
}

.pronunciation-controls {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  margin-left: 4px;
  padding-top: 20px;
}

.add-button {
  margin-bottom: 8px;
}

.accent-phrase-table {
  flex-grow: 1;
  align-self: stretch;
  display: flex;
  height: 130px;
  overflow-x: scroll;
  width: calc(66vw - 140px);

  .accent-block {
    display: flex;
    position: relative;
    margin-right: 24px;
    &:last-child {
      margin-right: 0;
    }
  }

  .mora-table {
    display: inline-grid;
    align-self: stretch;
    grid-template-rows: 1fr 60px 30px;

    .text-cell {
      padding: 0;
      min-width: 20px;
      max-width: 20px;
      grid-row-start: 3;
      text-align: center;
      white-space: nowrap;
      color: colors.$display;
      position: relative;
    }

    .splitter-cell {
      min-width: 20px;
      max-width: 20px;
      grid-row: 3 / span 1;
      z-index: vars.$detail-view-splitter-cell-z-index;
    }
  }
}

.save-delete-reset-buttons {
  padding: 20px;

  display: flex;
  flex: 1;
  align-items: flex-end;
}
</style>
