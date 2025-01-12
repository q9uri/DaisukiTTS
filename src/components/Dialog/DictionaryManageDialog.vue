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
              @click="newWord"
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
              @click="discardOrNotDialog(cancel)"
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
                @click="selectWord(key)"
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

          <DictionaryEditWordDialog />
        </QPage>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>

<script lang="ts">
import { Ref, ComputedRef } from "vue";

export const dictionaryManageDialogContextKey = "dictionaryManageDialogContext";

export interface DictionaryManageDialogContext {
  wordEditing: Ref<boolean>;
  surfaceInput: Ref<QInput | undefined>;
  selectedId: Ref<string>;
  uiLocked: Ref<boolean>;
  userDict: Ref<Record<string, UserDictWord>>;
  isOnlyHiraOrKana: Ref<boolean>;
  accentPhrase: Ref<AccentPhrase | undefined>;
  voiceComputed: ComputedRef<{
    engineId: EngineId;
    speakerId: SpeakerId;
    styleId: StyleId;
  }>;
  surface: Ref<string>;
  yomi: Ref<string>;
  wordType: Ref<WordTypes>;
  wordTypeLabels: Ref<Record<WordTypes, string>>;
  wordPriority: Ref<number>;
  isWordChanged: ComputedRef<boolean>;
  isNewWordEditing: Ref<boolean>;
  setYomi: (text: string, changeWord?: boolean) => Promise<void>;
  createUILockAction: <T>(action: Promise<T>) => Promise<T>;
  loadingDictProcess: () => Promise<void>;
  computeRegisteredAccent: () => number;
  discardOrNotDialog: (okCallback: () => void) => Promise<void>;
  toWordEditingState: () => void;
  toWordSelectedState: () => void;
  cancel: () => void;
  deleteWord: () => Promise<void>;
  getWordTypeFromPartOfSpeech: (dictData: UserDictWord | undefined) => WordTypes;
}
</script>

<script setup lang="ts">
import { computed, ref, watch, provide } from "vue";
import { QInput } from "quasar";
import DictionaryEditWordDialog from "./DictionaryEditWordDialog.vue";
import { useStore } from "@/store";
import { AccentPhrase, UserDictWord, WordTypes } from "@/openapi";
import { EngineId, SpeakerId, StyleId } from "@/type/preload";
import {
  convertHiraToKana,
  convertLongVowel,
  createKanaRegex,
} from "@/domain/japanese";

const defaultWordType = WordTypes.ProperNoun;
const defaultDictPriority = 5;

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
const uiLocked = ref(false); // ダイアログ内でstore.getters.UI_LOCKEDは常にtrueなので独自に管理

const loadingDictState = ref<null | "loading" | "synchronizing">("loading");
const userDict = ref<Record<string, UserDictWord>>({});

const createUILockAction = function <T>(action: Promise<T>) {
  uiLocked.value = true;
  return action.finally(() => {
    uiLocked.value = false;
  });
};

const loadingDictProcess = async () => {
  if (store.state.engineIds.length === 0)
    throw new Error("assert engineId.length > 0");

  loadingDictState.value = "loading";
  try {
    userDict.value = await createUILockAction(
      store.actions.LOAD_ALL_USER_DICT(),
    );
  } catch {
    const result = await store.actions.SHOW_ALERT_DIALOG({
      title: "辞書の取得に失敗しました",
      message: "音声合成エンジンの再起動をお試しください。",
    });
    if (result === "OK") {
      dictionaryManageDialogOpenedComputed.value = false;
    }
  }
  loadingDictState.value = "synchronizing";
  try {
    await createUILockAction(store.actions.SYNC_ALL_USER_DICT());
  } catch {
    await store.actions.SHOW_ALERT_DIALOG({
      title: "辞書の同期に失敗しました",
      message: "音声合成エンジンの再起動をお試しください。",
    });
  }
  loadingDictState.value = null;
};
watch(dictionaryManageDialogOpenedComputed, async (newValue) => {
  if (newValue) {
    await loadingDictProcess();
    toInitialState();
  }
});

const wordEditing = ref(false);
const surfaceInput = ref<QInput>();
const selectedId = ref("");
const lastSelectedId = ref("");
const surface = ref("");
const yomi = ref("");

const voiceComputed = computed(() => {
  const userOrderedCharacterInfos =
    store.getters.USER_ORDERED_CHARACTER_INFOS("talk");
  if (userOrderedCharacterInfos == undefined)
    throw new Error("assert USER_ORDERED_CHARACTER_INFOS");
  if (store.state.engineIds.length === 0)
    throw new Error("assert engineId.length > 0");
  const characterInfo = userOrderedCharacterInfos[0].metas;
  const speakerId = characterInfo.speakerUuid;
  const { engineId, styleId } = characterInfo.styles[0];
  return { engineId, speakerId, styleId };
});

const kanaRegex = createKanaRegex();
const isOnlyHiraOrKana = ref(true);
const accentPhrase = ref<AccentPhrase | undefined>();

const setYomi = async (text: string, changeWord?: boolean) => {
  const { engineId, styleId } = voiceComputed.value;

  // テキスト長が0の時にエラー表示にならないように、テキスト長を考慮する
  isOnlyHiraOrKana.value = !text.length || kanaRegex.test(text);
  // 読みが変更されていない場合は、アクセントフレーズに変更を加えない
  // ただし、読みが同じで違う単語が存在する場合が考えられるので、changeWordフラグを考慮する
  // 「ガ」が自動挿入されるので、それを考慮してsliceしている
  if (
    text ==
      accentPhrase.value?.moras
        .map((v) => v.text)
        .join("")
        .slice(0, -1) &&
    !changeWord
  ) {
    return;
  }
  if (isOnlyHiraOrKana.value && text.length) {
    text = convertHiraToKana(text);
    text = convertLongVowel(text);
    accentPhrase.value = (
      await createUILockAction(
        store.actions.FETCH_ACCENT_PHRASES({
          text: text + "ガ'",
          engineId,
          styleId,
          isKana: true,
        }),
      )
    )[0];
    if (selectedId.value && userDict.value[selectedId.value].yomi === text) {
      accentPhrase.value.accent = computeDisplayAccent();
    }
  } else {
    accentPhrase.value = undefined;
  }
  yomi.value = text;
};

// accent phraseにあるaccentと実際に登録するアクセントには差が生まれる
// アクセントが自動追加される「ガ」に指定されている場合、
// 実際に登録するaccentの値は0となるので、そうなるように処理する
const computeRegisteredAccent = () => {
  if (!accentPhrase.value) return 0;  // エラーにさせないために0を返す
  let accent = accentPhrase.value.accent;
  accent = accent === accentPhrase.value.moras.length ? 0 : accent;
  return accent;
};
// computeの逆
// 辞書から得たaccentが0の場合に、自動で追加される「ガ」の位置にアクセントを表示させるように処理する
const computeDisplayAccent = () => {
  if (!accentPhrase.value || !selectedId.value) return 0;  // エラーにさせないために0を返す
  let accent = userDict.value[selectedId.value].accentType;
  accent = accent === 0 ? accentPhrase.value.moras.length : accent;
  return accent;
};

const wordType = ref<WordTypes>(defaultWordType);
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

// 品詞フィールドから WordTypes を推定する関数
const getWordTypeFromPartOfSpeech = (dictData: UserDictWord | undefined): WordTypes => {
  // 基本ないが、もし dictData が undefined の場合は固有名詞として扱う
  if (!dictData) return WordTypes.ProperNoun;

  const { partOfSpeech, partOfSpeechDetail1, partOfSpeechDetail2, partOfSpeechDetail3 } = dictData;
  if (partOfSpeech === "名詞") {
    if (partOfSpeechDetail1 === "固有名詞") {
      if (partOfSpeechDetail2 === "地域" && partOfSpeechDetail3 === "一般") {
        return WordTypes.LocationName;
      }
      if (partOfSpeechDetail2 === "組織") {
        return WordTypes.OrganizationName;
      }
      if (partOfSpeechDetail2 === "人名") {
        if (partOfSpeechDetail3 === "一般") {
          return WordTypes.PersonName;
        }
        if (partOfSpeechDetail3 === "姓") {
          return WordTypes.PersonFamilyName;
        }
        if (partOfSpeechDetail3 === "名") {
          return WordTypes.PersonGivenName;
        }
      }
      return WordTypes.ProperNoun;
    }
    if (partOfSpeechDetail1 === "接尾") return WordTypes.Suffix;
    return WordTypes.CommonNoun;
  }
  if (partOfSpeech === "動詞") return WordTypes.Verb;
  if (partOfSpeech === "形容詞") return WordTypes.Adjective;

  // デフォルトは固有名詞
  return WordTypes.ProperNoun;
};

const wordPriority = ref(defaultDictPriority);

// 操作（ステートの移動）
const isWordChanged = computed(() => {
  if (selectedId.value === "") {
    return (
      surface.value != "" && yomi.value != "" && accentPhrase.value != undefined
    );
  }
  // 一旦代入することで、userDictそのものが更新された時もcomputedするようにする
  const dict = userDict.value;
  const dictData = dict[selectedId.value];
  const currentWordType = getWordTypeFromPartOfSpeech(dictData);
  return (
    dictData &&
    (dictData.surface !== surface.value ||
      dictData.yomi !== yomi.value ||
      dictData.accentType !== computeRegisteredAccent() ||
      currentWordType !== wordType.value ||
      dictData.priority !== wordPriority.value)
  );
});

const deleteWord = async () => {
  const result = await store.actions.SHOW_WARNING_DIALOG({
    title: "単語を削除しますか？",
    message: `単語「${userDict.value[selectedId.value].surface}」を削除します。`,
    actionName: "削除する",
    isWarningColorButton: true,
    cancel: "削除しない",
  });
  if (result === "OK") {
    try {
      void store.actions.SHOW_LOADING_SCREEN({
        message: "単語を辞書から削除しています...",
      });
      await createUILockAction(
        store.actions.DELETE_WORD({
          wordUuid: selectedId.value,
        }),
      );
    } catch {
      void store.actions.SHOW_ALERT_DIALOG({
        title: "単語の削除に失敗しました",
        message: "音声合成エンジンの再起動をお試しください。",
      });
      return;
    } finally {
      await store.actions.HIDE_ALL_LOADING_SCREEN();
    }
    await loadingDictProcess();
    toInitialState();
  }
};
const discardOrNotDialog = async (okCallback: () => void) => {
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
};

const isNewWordEditing = ref(false);
const newWord = () => {
  const newWordImpl = () => {
    isNewWordEditing.value = true;
    selectedId.value = "";
    surface.value = "";
    void setYomi("");
    wordType.value = defaultWordType;
    wordPriority.value = defaultDictPriority;
    editWord();
  };

  if (wordEditing.value && isWordChanged.value) {
    void discardOrNotDialog(newWordImpl);
  } else {
    newWordImpl();
  }
};
const editWord = () => {
  toWordEditingState();
};
const selectWord = (id: string) => {
  const selectWordImpl = () => {
    selectedId.value = id;
    surface.value = userDict.value[id].surface;
    void setYomi(userDict.value[id].yomi, true);
    wordType.value = getWordTypeFromPartOfSpeech(userDict.value[id]);
    wordPriority.value = userDict.value[id].priority;
    toWordSelectedState();
    editWord();
  };

  if (wordEditing.value && isWordChanged.value) {
    void discardOrNotDialog(selectWordImpl);
  } else {
    selectWordImpl();
  }
};
const cancel = () => {
  toInitialState();
};
const closeDialog = () => {
  toDialogClosedState();
};

// ステートの移動
// 初期状態
const toInitialState = () => {
  isNewWordEditing.value = false;
  wordEditing.value = false;
  selectedId.value = "";
  surface.value = "";
  void setYomi("");
  wordType.value = defaultWordType;
  wordPriority.value = defaultDictPriority;

  // 辞書の最初の項目を選択する
  if (Object.keys(userDict.value).length > 0) {
    // 前回選択していた項目があればそれを選択、なければ最初の項目を選択
    const targetKey = lastSelectedId.value && userDict.value[lastSelectedId.value]
      ? lastSelectedId.value
      : Object.keys(userDict.value)[0];
    selectWord(targetKey);
  }
};
// 単語が選択されているだけの状態
const toWordSelectedState = () => {
  wordEditing.value = false;
  // 選択された項目を記憶
  lastSelectedId.value = selectedId.value;
};
// 単語が編集されている状態
const toWordEditingState = () => {
  wordEditing.value = true;
  surfaceInput.value?.focus();
};
// ダイアログが閉じている状態
const toDialogClosedState = () => {
  dictionaryManageDialogOpenedComputed.value = false;
};

provide<DictionaryManageDialogContext>(dictionaryManageDialogContextKey, {
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
});
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
