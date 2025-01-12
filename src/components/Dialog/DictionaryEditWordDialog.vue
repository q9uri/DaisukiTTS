<template>
  <div v-show="wordEditing" class="col-8 no-wrap text-no-wrap word-editor">
    <div ref="modelDetailContent" class="model-detail-content">
      <div v-if="isNewWordEditing" class="row q-px-md q-mt-lg">
        <div class="text-h5 text-display">新しい単語を追加</div>
      </div>
      <div class="row q-px-md q-pr-md q-mt-md">
        <QInput
          ref="surfaceInput"
          v-model="surface"
          class="word-input"
          outlined
          label="単語"
          placeholder="単語を入力"
          :disable="uiLocked"
          @focus="clearSurfaceInputSelection()"
          @blur="setSurface(surface)"
          @keydown.enter="yomiFocus"
        >
          <ContextMenu
            ref="surfaceContextMenu"
            :header="surfaceContextMenuHeader"
            :menudata="surfaceContextMenudata"
            @beforeShow="startSurfaceContextMenuOperation()"
            @beforeHide="endSurfaceContextMenuOperation()"
          />
        </QInput>
      </div>
      <div class="row q-px-md q-pr-md q-pt-sm">
        <QInput
          ref="yomiInput"
          v-model="yomi"
          class="word-input q-pb-none"
          outlined
          label="読み"
          placeholder="読みを入力"
          :error="!isOnlyHiraOrKana"
          :disable="uiLocked"
          @focus="clearYomiInputSelection()"
          @blur="setYomi(yomi)"
          @keydown.enter="setYomiWhenEnter"
        >
          <template #error>
            読みに使える文字はひらがなとカタカナのみです。
          </template>
          <ContextMenu
            ref="yomiContextMenu"
            :header="yomiContextMenuHeader"
            :menudata="yomiContextMenudata"
            @beforeShow="startYomiContextMenuOperation()"
            @beforeHide="endYomiContextMenuOperation()"
          />
        </QInput>
      </div>
      <div class="row no-wrap q-px-md q-mb-md desc-row" style="align-items: center; margin-top: 24px; white-space: normal;">
        <QIcon name="sym_r_warning" color="warning-light" size="19px" class="q-mr-sm" />
        <div>
          英単語・数字・記号を含む単語は、辞書に反映されないことがあります。<br>
          英単語はカタカナ表記にすると反映される場合もありますが、必ずしも反映されるとは限りません。
        </div>
      </div>
      <div class="row q-px-md q-mt-md text-h6">品詞</div>
      <div class="row q-px-md q-mt-sm q-mb-md desc-row" style="white-space: normal;">
        登録する単語の品詞を選択してください。適切に設定すると、ユーザー辞書の適用精度が向上します。
      </div>
      <div class="row q-px-md q-pr-md">
        <QSelect
          v-model="wordType"
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
          ref="accentPhraseTable"
          class="accent-phrase-table overflow-hidden-y"
        >
          <div v-if="accentPhrase" class="mora-table">
            <AudioAccent
              :accentPhrase
              :accentPhraseIndex="0"
              :uiLocked
              :onChangeAccent="changeAccent"
            />
            <template
              v-for="(mora, moraIndex) in accentPhrase.moras"
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
                v-if="moraIndex < accentPhrase.moras.length - 1"
                class="splitter-cell"
                :style="{
                  gridColumn: `${moraIndex * 2 + 2} / span 1`,
                }"
              />
            </template>
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
          v-model="wordPriority"
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
        @click="discardOrNotDialog(cancel)"
      />
      <QBtn
        v-show="!!selectedId"
        outline
        icon="sym_r_delete"
        label="削除"
        textColor="warning"
        class="text-no-wrap text-bold q-mr-sm"
        :disable="uiLocked"
        @click="deleteWord"
      />
      <QBtn
        v-show="!!selectedId"
        outline
        icon="sym_r_settings_backup_restore"
        label="変更を破棄"
        textColor="warning"
        class="text-no-wrap text-bold q-mr-sm"
        :disable="uiLocked || !isWordChanged"
        @click="resetWord(selectedId)"
      />
      <QBtn
        outline
        icon="sym_r_save"
        label="保存"
        textColor="primary"
        class="text-no-wrap text-bold"
        :disable="uiLocked || !isWordChanged"
        @click="saveWord"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject, ref, watch } from "vue";
import { QInput } from "quasar";
import {
  DictionaryManageDialogContext,
  dictionaryManageDialogContextKey,
} from "./DictionaryManageDialog.vue";
import AudioAccent from "@/components/Talk/AudioAccent.vue";
import ContextMenu from "@/components/Menu/ContextMenu/Container.vue";
import { useRightClickContextMenu } from "@/composables/useRightClickContextMenu";
import { useStore } from "@/store";
import type { FetchAudioResult } from "@/store/type";

const store = useStore();

const context = inject<DictionaryManageDialogContext>(
  dictionaryManageDialogContextKey,
);
if (context == undefined)
  throw new Error("dictionaryManageDialogContext == undefined");
const {
  wordEditing,
  surfaceInput,
  selectedId,
  uiLocked,
  userDict,
  isOnlyHiraOrKana,
  accentPhrase,
  voiceComputed,
  surface,
  yomi,
  wordType,
  wordTypeLabels,
  wordPriority,
  isWordChanged,
  isNewWordEditing,
  setYomi,
  createUILockAction,
  loadingDictProcess,
  computeRegisteredAccent,
  discardOrNotDialog,
  toWordEditingState,
  toWordSelectedState,
  cancel,
  deleteWord,
  getWordTypeFromPartOfSpeech,
} = context;

// 音声再生機構
const nowGenerating = ref(false);
const nowPlaying = ref(false);

const play = async () => {
  if (!accentPhrase.value) return;

  nowGenerating.value = true;
  const audioItem = await store.actions.GENERATE_AUDIO_ITEM({
    text: yomi.value,
    voice: voiceComputed.value,
  });

  if (audioItem.query == undefined)
    throw new Error("assert audioItem.query !== undefined");

  audioItem.query.accentPhrases = [accentPhrase.value];

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

  const { blob } = fetchAudioResult;
  nowGenerating.value = false;
  nowPlaying.value = true;
  await store.actions.PLAY_AUDIO_BLOB({ audioBlob: blob });
  nowPlaying.value = false;
};

const stop = () => {
  void store.actions.STOP_AUDIO();
};

// メニュー系
const yomiInput = ref<QInput>();
const wordPriorityLabels = {
  0: "最低",
  3: "低",
  5: "標準",
  7: "高",
  10: "最高",
};

const yomiFocus = (event?: KeyboardEvent) => {
  if (event && event.isComposing) return;
  yomiInput.value?.focus();
};

const setYomiWhenEnter = (event?: KeyboardEvent) => {
  if (event && event.isComposing) return;
  void setYomi(yomi.value);
};

const convertHankakuToZenkaku = (text: string) => {
  // " "などの目に見えない文字をまとめて全角スペース(0x3000)に置き換える
  text = text.replace(/\p{Z}/gu, () => String.fromCharCode(0x3000));

  // "!"から"~"までの範囲の文字(数字やアルファベット)を全角に置き換える
  return text.replace(/[\u0021-\u007e]/g, (s) => {
    return String.fromCharCode(s.charCodeAt(0) + 0xfee0);
  });
};

const setSurface = (text: string) => {
  // surfaceを全角化する
  // 入力は半角でも問題ないが、登録時に全角に変換され、isWordChangedの判断がおかしくなることがあるので、
  // 入力後に自動で変換するようにする
  surface.value = convertHankakuToZenkaku(text);
};

const saveWord = async () => {
  if (!accentPhrase.value) throw new Error("accentPhrase === undefined");
  const accent = computeRegisteredAccent();
  if (selectedId.value) {
    try {
      void store.actions.SHOW_LOADING_SCREEN({
        message: "変更を保存しています...",
      });
      await store.actions.REWRITE_WORD({
        wordUuid: selectedId.value,
        surface: surface.value,
        pronunciation: yomi.value,
        accentType: accent,
        wordType: wordType.value,
        priority: wordPriority.value,
      });
    } catch (e) {
      void store.actions.SHOW_ALERT_DIALOG({
        title: "単語の更新に失敗しました",
        message: "エンジンの再起動をお試しください。",
      });
      throw e;
    } finally {
      await store.actions.HIDE_ALL_LOADING_SCREEN();
    }
    await loadingDictProcess();
    // 変更後の単語を選択
    surface.value = userDict.value[selectedId.value].surface;
    void setYomi(userDict.value[selectedId.value].yomi, true);
    wordType.value = getWordTypeFromPartOfSpeech(userDict.value[selectedId.value]);
    wordPriority.value = userDict.value[selectedId.value].priority;
    toWordSelectedState();
    toWordEditingState();
  } else {
    let wordUuid: string;
    try {
      void store.actions.SHOW_LOADING_SCREEN({
        message: "単語を辞書に追加しています...",
      });
      wordUuid = await createUILockAction(
        store.actions.ADD_WORD({
          surface: surface.value,
          pronunciation: yomi.value,
          accentType: accent,
          wordType: wordType.value,
          priority: wordPriority.value,
        }),
      );
    } catch (e) {
      void store.actions.SHOW_ALERT_DIALOG({
        title: "単語の登録に失敗しました",
        message: "エンジンの再起動をお試しください。",
      });
      throw e;
    } finally {
      await store.actions.HIDE_ALL_LOADING_SCREEN();
    }
    await loadingDictProcess();
    // 追加した単語を選択
    isNewWordEditing.value = false;  // 追加ダイアログを閉じる
    selectedId.value = wordUuid;
    surface.value = userDict.value[wordUuid].surface;
    void setYomi(userDict.value[wordUuid].yomi, true);
    wordType.value = getWordTypeFromPartOfSpeech(userDict.value[wordUuid]);
    wordPriority.value = userDict.value[wordUuid].priority;
    toWordSelectedState();
    toWordEditingState();
  }
};

const resetWord = async (id: string) => {
  const result = await store.actions.SHOW_WARNING_DIALOG({
    title: "単語の変更を破棄しますか？",
    message: "保存されていない変更内容は失われます。",
    actionName: "破棄する",
    isWarningColorButton: true,
  });
  if (result === "OK") {
    selectedId.value = id;
    surface.value = userDict.value[id].surface;
    void setYomi(userDict.value[id].yomi, true);
    wordPriority.value = userDict.value[id].priority;
    toWordEditingState();
  }
};

// アクセント系
const accentPhraseTable = ref<HTMLElement>();
const modelDetailContent = ref<HTMLElement>();

// モーダル表示の切り替え時にスクロール位置をリセット
watch(isNewWordEditing, () => {
  if (modelDetailContent.value) {
    modelDetailContent.value.scrollTop = 0;
  }
});

const changeAccent = async (_: number, accent: number) => {
  const { engineId, styleId } = voiceComputed.value;

  if (accentPhrase.value) {
    accentPhrase.value.accent = accent;
    accentPhrase.value = (
      await createUILockAction(
        store.actions.FETCH_MORA_DATA({
          accentPhrases: [accentPhrase.value],
          engineId,
          styleId,
        }),
      )
    )[0];
  }
};

// コンテキストメニュー
const surfaceContextMenu = ref<InstanceType<typeof ContextMenu>>();
const yomiContextMenu = ref<InstanceType<typeof ContextMenu>>();

const {
  contextMenuHeader: surfaceContextMenuHeader,
  contextMenudata: surfaceContextMenudata,
  startContextMenuOperation: startSurfaceContextMenuOperation,
  clearInputSelection: clearSurfaceInputSelection,
  endContextMenuOperation: endSurfaceContextMenuOperation,
} = useRightClickContextMenu(surfaceContextMenu, surfaceInput, surface);

const {
  contextMenuHeader: yomiContextMenuHeader,
  contextMenudata: yomiContextMenudata,
  startContextMenuOperation: startYomiContextMenuOperation,
  clearInputSelection: clearYomiInputSelection,
  endContextMenuOperation: endYomiContextMenuOperation,
} = useRightClickContextMenu(yomiContextMenu, yomiInput, yomi);
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

.accent-phrase-table {
  flex-grow: 1;
  align-self: stretch;

  display: flex;
  height: 130px;
  overflow-x: scroll;
  width: calc(66vw - 140px);

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
