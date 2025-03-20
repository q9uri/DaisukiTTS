<template>
  <QDialog
    v-model="dictionaryManageDialogOpenedComputed"
    maximized
    transitionShow="jump-up"
    transitionHide="jump-down"
    class="setting-dialog transparent-backdrop"
  >
    <QLayout container view="hHh Lpr fFf" class="bg-background">
      <QPageContainer>
        <QHeader class="q-py-sm">
          <QToolbar>
            <!-- close button -->
            <QBtn
              round
              flat
              icon="sym_r_close"
              color="display"
              @click="discardOrNotDialog(closeDialog)"
            />
            <QToolbarTitle class="text-display">
              読み方＆アクセント辞書
            </QToolbarTitle>
            <QBtn
              outline
              icon="sym_r_add"
              label="追加"
              textColor="display"
              class="text-bold"
              :disable="uiLocked"
              @click="handleNewWord"
            />
          </QToolbar>
        </QHeader>
        <QPage class="row">
          <div v-if="loadingDictState" class="loading-dict">
            <div>
              <QSpinner color="primary" size="2.5rem" />
              <div style="margin-top: 12px">
                <template v-if="loadingDictState === 'loading'"
                  >読み込み中...</template
                >
                <template v-if="loadingDictState === 'synchronizing'"
                  >同期中...</template
                >
              </div>
            </div>
          </div>
          <div class="col-4 word-list-col">
            <div
              v-if="wordEditing && isNewWordEditing"
              class="word-list-disable-overlay"
              @click="discardOrNotDialog(handleCancel)"
            ></div>
            <QList class="word-list">
              <QItem
                v-for="(value, key) in userDict"
                :key
                v-ripple
                tag="label"
                clickable
                :active="selectedId === key"
                class="word-list-item"
                activeClass="active-word"
                @click="handleSelectWord(key)"
              >
                <QItemSection>
                  <QItemLabel class="text-display">{{
                    value.surface
                  }}</QItemLabel>
                  <QItemLabel caption class="row">
                    <span>{{ value.yomi }} [{{ wordTypeLabels[getWordTypeFromPartOfSpeech(value)] }}]</span>
                    <span class="q-ml-auto">優先度:{{ value.priority }}</span>
                  </QItemLabel>
                </QItemSection>
              </QItem>
            </QList>
          </div>

          <DictionaryEditWordDialog
            ref="editWordDialog"
            :surface
            :yomi
            :wordEditing
            :wordType
            :wordTypeLabels
            :wordPriority
            :isOnlyHiraOrKana
            :accentPhrase
            :selectedId
            :isNewWordEditing
            :uiLocked
            :isWordChanged
            @update:surface="setSurface"
            @update:yomi="setYomi"
            @update:wordType="wordType = $event"
            @update:wordPriority="wordPriority = $event"
            @changeAccent="changeAccent"
            @deleteWord="handleDeleteWord"
            @resetWord="handleResetWord"
            @saveWord="handleSaveWord"
            @cancel="discardOrNotDialog(handleCancel)"
            @setSurfaceInput="surfaceInput = $event"
          />
        </QPage>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { QInput } from "quasar";
import DictionaryEditWordDialog from "./DictionaryEditWordDialog.vue";
import {
  hideAllLoadingScreen,
  showLoadingScreen,
} from "@/components/Dialog/Dialog";
import { useStore } from "@/store";
import { WordTypes } from "@/openapi";
import { useDictionaryEditor } from "@/composables/useDictionaryEditor";

const props = defineProps<{
  modelValue: boolean;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
}>();

const store = useStore();

const dictionaryManageDialogOpenedComputed = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

// useDictionaryEditorから編集ロジックとステートを取得
const {
  wordEditing,
  isNewWordEditing,
  selectedId,
  uiLocked,
  userDict,
  isOnlyHiraOrKana,
  accentPhrase,
  surface,
  yomi,
  wordType,
  wordPriority,
  loadingDictState,
  isWordChanged,

  loadUserDict,
  setSurface,
  setYomi,
  getWordTypeFromPartOfSpeech,
  updateWord,
  addWord,
  deleteWord,
  changeAccent,
  toInitialState,
  toWordEditingState,
  toWordSelectedState,
  newWord,
  selectWord,
  cancel,
} = useDictionaryEditor();

// 品詞ラベルの定義
const wordTypeLabels = ref({
  [WordTypes.ProperNoun]: "固有名詞",
  [WordTypes.LocationName]: "地名",
  [WordTypes.OrganizationName]: "組織・施設名",
  [WordTypes.PersonName]: "人名",
  [WordTypes.PersonFamilyName]: "人名 - 姓",
  [WordTypes.PersonGivenName]: "人名 - 名",
  [WordTypes.CommonNoun]: "一般名詞",
  [WordTypes.Verb]: "動詞",
  [WordTypes.Adjective]: "形容詞",
  [WordTypes.Suffix]: "接尾辞",
});

// 辞書読み込みの処理
async function loadingDictProcess() {
  try {
    await loadUserDict();
  } catch {
    const result = await store.actions.SHOW_ALERT_DIALOG({
      title: "辞書の取得に失敗しました",
      message: "音声合成エンジンの再起動をお試しください。",
    });
    if (result === "OK") {
      dictionaryManageDialogOpenedComputed.value = false;
    }
  }
}

// ダイアログが開かれた時に辞書を読み込む
watch(dictionaryManageDialogOpenedComputed, async (newValue) => {
  if (newValue) {
    await loadingDictProcess();
    toInitialState();
  }
});

// 保存前の変更破棄確認
async function discardOrNotDialog(okCallback: () => void) {
  if (isWordChanged.value) {
    const result = await store.actions.SHOW_WARNING_DIALOG({
      title: "単語の追加・変更を破棄しますか？",
      message: "保存されていない変更内容は失われます。",
      actionName: "破棄する",
      isWarningColorButton: true,
    });
    if (result === "OK") {
      okCallback();
    }
  } else {
    okCallback();
  }
}

// ダイアログを閉じる処理
const closeDialog = () => {
  dictionaryManageDialogOpenedComputed.value = false;
};

// surfaceInputの参照を保持（DictionaryEditWordDialogから設定される）
const surfaceInput = ref<QInput>();
const editWordDialog = ref();

// 各種操作のハンドラ
const handleNewWord = () => {
  if (wordEditing.value && isWordChanged.value) {
    void discardOrNotDialog(newWord);
  } else {
    newWord();
  }
};

const handleSelectWord = (id: string) => {
  if (wordEditing.value && isWordChanged.value) {
    void discardOrNotDialog(() => selectWord(id));
  } else {
    selectWord(id);
  }
};

const handleCancel = () => {
  cancel();
};

const handleDeleteWord = async () => {
  const result = await store.actions.SHOW_WARNING_DIALOG({
    title: "単語を削除しますか？",
    message: `単語「${userDict.value[selectedId.value].surface}」を削除します。`,
    actionName: "削除する",
    isWarningColorButton: true,
    cancel: "削除しない",
  });
  if (result === "OK") {
    try {
      showLoadingScreen({
        message: "単語を辞書から削除しています...",
      });
      await deleteWord(selectedId.value);
    } catch {
      return;
    } finally {
      hideAllLoadingScreen();
    }
    await loadingDictProcess();
    toInitialState();
  }
};

const handleResetWord = async (id: string) => {
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

const handleSaveWord = async () => {
  if (!accentPhrase.value) throw new Error("accentPhrase === undefined");

  try {
    showLoadingScreen({
      message: selectedId.value ? "変更を保存しています..." : "単語を辞書に追加しています...",
    });

    let wordId: string;
    if (selectedId.value) {
      // 既存単語の更新
      await updateWord(selectedId.value);
      wordId = selectedId.value;
    } else {
      // 新規単語の追加
      wordId = await addWord();
    }

    await loadingDictProcess();

    // 変更後の単語を選択
    isNewWordEditing.value = false;
    selectedId.value = wordId;
    surface.value = userDict.value[wordId].surface;
    void setYomi(userDict.value[wordId].yomi, true);
    wordType.value = getWordTypeFromPartOfSpeech(userDict.value[wordId]);
    wordPriority.value = userDict.value[wordId].priority;
    toWordSelectedState();
    toWordEditingState();
  } catch (e) {
    console.error(e);
  } finally {
    hideAllLoadingScreen();
  }
};
</script>

<style lang="scss">
.play-button .material-symbols-rounded {
  font-variation-settings: 'FILL' 1, 'wght' 300, 'GRAD' 200, 'opsz' 24 !important;
}
</style>

<style lang="scss" scoped>
@use "@/styles/colors" as colors;
@use "@/styles/variables" as vars;

.word-list-col {
  border-right: solid 1px colors.$surface;
  position: relative; // オーバーレイのため
  overflow-x: hidden;
}

.word-list-header {
  margin: 1rem;

  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
  .word-list-title {
    flex-grow: 1;
  }
}

.word-list {
  // menubar-height + toolbar-height + window-border-width
  height: calc(
    100vh - #{vars.$menubar-height + vars.$toolbar-height +
      vars.$window-border-width}
  );
  width: 100%;
  overflow-y: auto;

  .word-list-item {
    padding-right: 16px;

    &.active-word {
      background: hsl(206 66% 32% / 1);
      padding-right: 12px;
      border-right: 4px solid colors.$primary;
    }
  }
}

.loading-dict {
  background-color: rgba(0, 0, 0, 0.3);
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  text-align: center;
  align-items: center;
  justify-content: center;

  > div {
    color: colors.$display;
    background: colors.$background;
    border-radius: 6px;
    padding: 16px 20px;
  }
}

.word-list-disable-overlay {
  background-color: rgba($color: #000000, $alpha: 0.4);
  width: 100%;
  height: 100%;
  position: absolute;
  z-index: 10;
}

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
