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
                activeClass="active-word"
                @click="
                  selectWord(key);
                  editWord();
                "
              >
                <QItemSection>
                  <QItemLabel class="text-display">{{
                    value.surface
                  }}</QItemLabel>
                  <QItemLabel caption>{{ value.yomi }}</QItemLabel>
                </QItemSection>
              </QItem>
            </QList>
          </div>

          <!-- 右側のpane -->
          <div
            v-show="wordEditing"
            class="col-8 no-wrap text-no-wrap word-editor"
          >
            <div class="model-detail-content">
              <div class="row q-pl-md q-pr-md q-mt-lg">
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
              <div class="row q-pl-md q-pr-md q-pt-md">
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
              <div class="row q-pl-md q-mt-lg text-h6">アクセント調整</div>
              <div class="row q-pl-md q-mt-sm q-mb-md desc-row">
                語尾のアクセントを考慮するため、「が」が自動で挿入されます。
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
              <div class="row q-pl-md q-mt-lg text-h6">品詞</div>
              <div class="row q-pl-md q-mt-sm q-mb-md desc-row" style="white-space: normal;">
                登録する単語の品詞を選択してください。適切に設定すると、ユーザー辞書の適用精度が向上します。
              </div>
              <div class="row q-pl-md q-pr-md">
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
              <div class="row q-pl-md q-mt-lg text-h6">単語優先度</div>
              <div class="row q-pl-md q-mt-sm q-mb-lg desc-row">
                単語を登録しても反映されない場合は優先度を高くしてください。
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
                v-show="!!selectedId"
                outline
                icon="sym_r_delete"
                label="削除"
                textColor="warning"
                class="text-no-wrap text-bold q-mr-sm"
                :disable="uiLocked || !isDeletable"
                @click="deleteWord"
              />
              <QBtn
                v-show="!!selectedId"
                outline
                icon="sym_r_settings_backup_restore"
                label="リセット"
                textColor="warning"
                class="text-no-wrap text-bold q-mr-sm"
                :disable="uiLocked || !isWordChanged"
                @click="resetWord"
              />
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
        </QPage>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { QInput, QSelect } from "quasar";
import AudioAccent from "@/components/Talk/AudioAccent.vue";
import ContextMenu from "@/components/Menu/ContextMenu/Container.vue";
import { useRightClickContextMenu } from "@/composables/useRightClickContextMenu";
import { useStore } from "@/store";
import type { FetchAudioResult } from "@/store/type";
import { AccentPhrase, UserDictWord, WordTypes } from "@/openapi";
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
const nowGenerating = ref(false);
const nowPlaying = ref(false);

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
      type: "error",
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
      type: "error",
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
const yomiInput = ref<QInput>();
const yomiFocus = (event?: KeyboardEvent) => {
  if (event && event.isComposing) return;
  yomiInput.value?.focus();
};
const setYomiWhenEnter = (event?: KeyboardEvent) => {
  if (event && event.isComposing) return;
  void setYomi(yomi.value);
};

const selectedId = ref("");
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
const accentPhraseTable = ref<HTMLElement>();

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
      type: "error",
      title: "音声の生成に失敗しました",
      message: "音声合成エンジンの再起動をお試しください。",
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

// accent phraseにあるaccentと実際に登録するアクセントには差が生まれる
// アクセントが自動追加される「ガ」に指定されている場合、
// 実際に登録するaccentの値は0となるので、そうなるように処理する
const computeRegisteredAccent = () => {
  if (!accentPhrase.value) throw new Error();
  let accent = accentPhrase.value.accent;
  accent = accent === accentPhrase.value.moras.length ? 0 : accent;
  return accent;
};
// computeの逆
// 辞書から得たaccentが0の場合に、自動で追加される「ガ」の位置にアクセントを表示させるように処理する
const computeDisplayAccent = () => {
  if (!accentPhrase.value || !selectedId.value) throw new Error();
  let accent = userDict.value[selectedId.value].accentType;
  accent = accent === 0 ? accentPhrase.value.moras.length : accent;
  return accent;
};

const wordType = ref<WordTypes>(defaultWordType);
const wordTypeLabels = {
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
};

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
const wordPriorityLabels = {
  0: "最低",
  3: "低",
  5: "標準",
  7: "高",
  10: "最高",
};

// 操作（ステートの移動）
const isWordChanged = computed(() => {
  if (selectedId.value === "") {
    return surface.value && yomi.value && accentPhrase.value;
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
const saveWord = async () => {
  isNewWordEditing.value = false;
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
    } catch {
      void store.actions.SHOW_ALERT_DIALOG({
        type: "error",
        title: "単語の更新に失敗しました",
        message: "音声合成エンジンの再起動をお試しください。",
      });
      return;
    } finally {
      await store.actions.HIDE_ALL_LOADING_SCREEN();
    }
    await loadingDictProcess();
    selectWord(selectedId.value);
    editWord();
  } else {
    try {
      void store.actions.SHOW_LOADING_SCREEN({
        message: "単語を辞書に追加しています...",
      });
      await createUILockAction(
        store.actions.ADD_WORD({
          surface: surface.value,
          pronunciation: yomi.value,
          accentType: accent,
          wordType: wordType.value,
          priority: wordPriority.value,
        }),
      );
    } catch {
      void store.actions.SHOW_ALERT_DIALOG({
        type: "error",
        title: "単語の登録に失敗しました",
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
const isDeletable = computed(() => !!selectedId.value);
const deleteWord = async () => {
  const result = await store.actions.SHOW_WARNING_DIALOG({
    title: "登録された単語を削除しますか？",
    message: "削除された単語は元に戻せません。",
    actionName: "削除",
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
        type: "error",
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
const resetWord = async () => {
  const result = await store.actions.SHOW_WARNING_DIALOG({
    title: "単語の変更をリセットしますか？",
    message: "単語の変更は破棄されてリセットされます。",
    actionName: "リセット",
  });
  if (result === "OK") {
    selectWord(selectedId.value);
    editWord();
  }
};
const discardOrNotDialog = async (okCallback: () => void) => {
  if (isWordChanged.value) {
    const result = await store.actions.SHOW_WARNING_DIALOG({
      title: "単語の追加・変更を破棄しますか？",
      message: "破棄すると、単語の追加・変更はリセットされます。",
      actionName: "破棄",
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
  isNewWordEditing.value = true;
  selectedId.value = "";
  surface.value = "";
  void setYomi("");
  wordType.value = defaultWordType;
  wordPriority.value = defaultDictPriority;
  editWord();
};
const editWord = () => {
  toWordEditingState();
};
const selectWord = (id: string) => {
  selectedId.value = id;
  surface.value = userDict.value[id].surface;
  void setYomi(userDict.value[id].yomi, true);
  wordType.value = getWordTypeFromPartOfSpeech(userDict.value[id]);
  wordPriority.value = userDict.value[id].priority;
  toWordSelectedState();
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
    const firstKey = Object.keys(userDict.value)[0];
    selectWord(firstKey);
    editWord();
  }
};
// 単語が選択されているだけの状態
const toWordSelectedState = () => {
  wordEditing.value = false;
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
}

.active-word {
  background: rgba(colors.$primary-rgb, 0.4);
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
  color: rgba(colors.$display-rgb, 0.5);
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
