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
              flat
              icon="sym_r_file_upload"
              label="インポート"
              color="display"
              class="text-bold q-px-sm q-mr-sm"
              :disable="uiLocked || isNewWordEditing"
              @click="discardOrNotDialog(handleImportDictionary)"
            />
            <QBtn
              flat
              icon="sym_r_file_download"
              label="エクスポート"
              color="display"
              class="text-bold q-px-sm q-mr-sm"
              :disable="uiLocked || isNewWordEditing"
              @click="discardOrNotDialog(handleExportDictionary)"
            />
            <QBtn
              outline
              icon="sym_r_add"
              label="追加"
              textColor="display"
              class="text-bold"
              :disable="uiLocked || isNewWordEditing"
              @click="discardOrNotDialog(addNewWord)"
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
              v-if="isWordEditing && isNewWordEditing"
              class="word-list-disable-overlay"
              @click="discardOrNotDialog(toInitialState)"
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
                @click="discardOrNotDialog(() => selectWord(key))"
              >
                <QItemSection>
                  <QItemLabel v-if="value.stem.join('') !== value.surface" class="text-display">
                    <!-- stem を連結した文字列と surface (エンジンによって正規化される) が異なる場合のみ両方を表示する -->
                    {{ value.stem.join("") }} ({{ value.surface }})
                  </QItemLabel>
                  <QItemLabel v-else class="text-display">
                    {{ value.surface }}
                  </QItemLabel>
                  <QItemLabel caption class="row">
                    <span>{{ value.pronunciation.join("") }} [{{ wordTypeLabels[getWordTypeFromPartOfSpeech(value)] }}]</span>
                    <span class="q-ml-auto">優先度:{{ value.priority }}</span>
                  </QItemLabel>
                </QItemSection>
              </QItem>
            </QList>
          </div>

          <!-- 辞書が空の場合のプレースホルダ -->
          <div
            v-if="!loadingDictState && Object.keys(userDict).length === 0 && !isWordEditing"
            class="col-8 empty-state"
          >
            <div class="empty-state-message">
              <div class="text-h6">辞書に単語が登録されていません</div>
              <div class="text-caption q-mt-sm">
                画面右上の「追加」ボタンから、辞書に登録したい単語を追加できます。
              </div>
            </div>
          </div>
          <DictionaryEditWordDialog
            v-else
            :uiLocked
            :isWordEditing
            :isWordChanged
            :isNewWordEditing
            :selectedId
            :wordAccentPhraseItems
            :wordType
            :wordPriority
            @update:surface="updateSurface"
            @update:pronunciation="updatePronunciation"
            @update:wordType="wordType = $event"
            @update:wordPriority="wordPriority = $event"
            @changeAccentPosition="changeAccentPosition"
            @addWordAccentPhraseItem="addWordAccentPhraseItem"
            @removeWordAccentPhraseItem="removeWordAccentPhraseItem"
            @resetWord="handleResetWord"
            @deleteWord="handleDeleteWord"
            @saveWord="handleSaveWord"
            @cancel="discardOrNotDialog(toInitialState)"
          />
        </QPage>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>

<script setup lang="ts">
import { watch } from "vue";
import DictionaryEditWordDialog from "./DictionaryEditWordDialog.vue";
import { hideAllLoadingScreen, showLoadingScreen } from "@/components/Dialog/Dialog";
import { useDictionaryEditor } from "@/composables/useDictionaryEditor";
import { getWordTypeFromPartOfSpeech, wordTypeLabels } from "@/domain/japanese";
import { createLogger } from "@/helpers/log";
import { ResponseError } from "@/openapi";
import { useStore } from "@/store";

const dialogOpened = defineModel<boolean>("dialogOpened", { default: false });

const store = useStore();

const log = createLogger("DictionaryManageDialog");

// useDictionaryEditorから編集ロジックと状態を取得
const {
  // 状態
  uiLocked,
  loadingDictState,
  userDict,
  isWordEditing,
  isWordChanged,
  isNewWordEditing,
  selectedId,
  wordAccentPhraseItems,
  wordType,
  wordPriority,

  // 関数
  createUILockAction,
  loadUserDict,
  addWordToEngine,
  updateWordToEngine,
  deleteWordFromEngine,
  updateSurface,
  updatePronunciation,
  changeAccentPosition,
  addWordAccentPhraseItem,
  removeWordAccentPhraseItem,
  toInitialState,
  addNewWord,
  selectWord,
} = useDictionaryEditor();

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
      dialogOpened.value = false;
    }
  }
}

// ダイアログが開かれた時に辞書を読み込む
watch(dialogOpened, async (newValue) => {
  if (newValue) {
    await loadingDictProcess();
    toInitialState();
  }
});

// ダイアログを閉じる
const closeDialog = () => {
  dialogOpened.value = false;
};

// 保存前の変更の破棄を確認
async function discardOrNotDialog(okCallback: () => void) {
  // エントリが変更されているか、新しい単語を追加中の場合
  if (isWordChanged.value || isNewWordEditing.value) {
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

const handleResetWord = async (id: string) => {
  const result = await store.actions.SHOW_WARNING_DIALOG({
    title: "単語の変更を破棄しますか？",
    message: "保存されていない変更内容は失われます。",
    actionName: "破棄する",
    isWarningColorButton: true,
  });
  if (result === "OK") {
    // 指定された ID の単語を選択し直す
    selectWord(id);
  }
};

const handleDeleteWord = async () => {
  const result = await store.actions.SHOW_WARNING_DIALOG({
    title: "単語を削除しますか？",
    message: `単語「${userDict.value[selectedId.value].stem.join("")}」を削除します。`,
    actionName: "削除する",
    isWarningColorButton: true,
    cancel: "削除しない",
  });
  if (result === "OK") {
    try {
      showLoadingScreen({
        message: "単語を辞書から削除しています...",
      });
      await deleteWordFromEngine(selectedId.value);
    } catch {
      return;
    } finally {
      hideAllLoadingScreen();
    }
    await loadingDictProcess();
    toInitialState();
  }
};

const handleSaveWord = async () => {
  if (!wordAccentPhraseItems.value[0]?.accentPhrase)
    throw new Error("accentPhrase === undefined");

  try {
    showLoadingScreen({
      message: selectedId.value ? "変更を保存しています..." : "単語を辞書に追加しています...",
    });

    let wordId: string;
    if (selectedId.value) {
      // 既存単語の更新をエンジンに反映
      await updateWordToEngine(selectedId.value);
      wordId = selectedId.value;
    } else {
      // 新規単語の追加をエンジンに反映
      wordId = await addWordToEngine();
    }

    await loadingDictProcess();

    // 変更後の単語を選択
    selectWord(wordId);
  } catch (error) {
    log.error(error);
  } finally {
    hideAllLoadingScreen();
  }
};

const handleImportDictionary = async (): Promise<void> => {
  try {
    const filePath = await window.backend.showOpenFileDialog({
      title: "ユーザー辞書をインポート",
      name: "ユーザー辞書ファイル (JSON 形式)",
      mimeType: "application/json",
      extensions: ["json"],
      defaultPath: "user_dict.json",
    });
    if (!filePath) return;

    const fileResult = await window.backend.readFile({ filePath });
    if (!fileResult.ok) {
      throw new Error(`Failed to read file: ${fileResult.error.message}`);
    }

    const fileContent = new TextDecoder().decode(fileResult.value);
    const importedDict = JSON.parse(fileContent);
    await createUILockAction(store.actions.IMPORT_USER_DICT({ importedDict }));
    // インポート後に辞書を再読み込み
    await loadUserDict();
    // エディタ上での変更を破棄するため、selectedId を再度選択する
    selectWord(selectedId.value);
    await store.actions.SHOW_MESSAGE_DIALOG({
      type: "info",
      title: "ユーザー辞書のインポートが完了しました",
      message: "ユーザー辞書が正常にインポートされました。",
    });
  } catch (error) {
    log.error(error);
    if (error instanceof ResponseError) {
      void store.actions.SHOW_ALERT_DIALOG({
        title: "ユーザー辞書のインポートに失敗しました",
        message: "ファイルの形式が正しくありません。\n" +
                 `(HTTP Error ${error.response.status} / ${await error.response.text()})`,
      });
    } else {
      await store.actions.SHOW_ALERT_DIALOG({
        title: "ユーザー辞書のインポートに失敗しました",
        message: "ファイルの形式が正しくありません。",
      });
    }
  }
};

const handleExportDictionary = async (): Promise<void> => {
  try {
    // 辞書を JSON 形式でエクスポート (インデント: 4スペース)
    const dictJson = JSON.stringify(userDict.value, null, 4);
    const filePath = await window.backend.showSaveFileDialog({
      title: "ユーザー辞書をエクスポート",
      name: "ユーザー辞書ファイル (JSON 形式)",
      extensions: ["json"],
      defaultPath: "user_dict.json",
    });
    if (!filePath) return;
    await window.backend.writeFile({
      filePath,
      buffer: new TextEncoder().encode(dictJson),
    });
    await store.actions.SHOW_MESSAGE_DIALOG({
      type: "info",
      title: "ユーザー辞書のエクスポートが完了しました",
      message: "ユーザー辞書が正常にエクスポートされました。",
    });
  } catch (error) {
    log.error(error);
    if (error instanceof ResponseError) {
      void store.actions.SHOW_ALERT_DIALOG({
        title: "ユーザー辞書のエクスポートに失敗しました",
        message: "ファイルの書き込みに失敗しました。\n" +
                 `(HTTP Error ${error.response.status} / ${await error.response.text()})`,
      });
    } else {
      await store.actions.SHOW_ALERT_DIALOG({
        title: "ユーザー辞書のエクスポートに失敗しました",
        message: "ファイルの書き込みに失敗しました。",
      });
    }
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

// Empty state styles
.empty-state {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: rgba(colors.$display-rgb, 0.7);
  padding: 16px;
}

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
