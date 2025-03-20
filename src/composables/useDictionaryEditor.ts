import { ref, computed } from "vue";
import {
  convertHiraToKana,
  convertLongVowel,
  createKanaRegex
} from "@/domain/japanese";
import {
  AccentPhrase,
  UserDictWord,
  WordTypes
} from "@/openapi";
import { useStore } from "@/store";

export interface PronunciationItem {
  surface: string;
  yomi: string;
  accentPhrase?: AccentPhrase;
}

const defaultWordType = WordTypes.ProperNoun;
const defaultDictPriority = 5;

export function useDictionaryEditor(initialSurface = "", initialYomi = "") {
  const store = useStore();

  // 編集状態の管理
  const wordEditing = ref(false);
  const isNewWordEditing = ref(false);
  const selectedId = ref("");
  const lastSelectedId = ref("");
  const uiLocked = ref(false);  // ダイアログ内で store.getters.UI_LOCKED は常に true なので独自に管理
  const surface = ref(initialSurface);
  const yomi = ref(initialYomi);
  const wordType = ref<WordTypes>(defaultWordType);
  const wordPriority = ref(defaultDictPriority);
  const loadingDictState = ref<null | "loading" | "synchronizing">(null);
  const userDict = ref<Record<string, UserDictWord>>({});
  const isOnlyHiraOrKana = ref(true);
  const accentPhrase = ref<AccentPhrase | undefined>();

  // 複数アクセント対応を準備
  const pronunciationItems = ref<PronunciationItem[]>([
    { surface: initialSurface, yomi: initialYomi }
  ]);

  // 複合単語（表層形）の連結結果
  const combinedSurface = ref(initialSurface);

  // 入力検証用 (ひらがな／カタカナのみチェック等)
  const kanaRegex = createKanaRegex();

  function isYomiValid(text: string): boolean {
    return text.length === 0 || kanaRegex.test(text);
  }

  const createUILockAction = function <T>(action: Promise<T>) {
    uiLocked.value = true;
    return action.finally(() => {
      uiLocked.value = false;
    });
  };

  // 各発音ペアの文字列変更時に全体更新
  function updateCombinedSurface(): void {
    combinedSurface.value = pronunciationItems.value.map(item => item.surface).join("");
    surface.value = combinedSurface.value;
  }

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

  // 読み更新（アクセント句取得の API 呼び出しは内部でラップ）
  async function setYomi(text: string, changeWord?: boolean): Promise<void> {
    const userOrderedCharacterInfos = store.getters.USER_ORDERED_CHARACTER_INFOS("talk");
    if (userOrderedCharacterInfos == undefined)
      throw new Error("assert USER_ORDERED_CHARACTER_INFOS");
    if (store.state.engineIds.length === 0)
      throw new Error("assert engineId.length > 0");
    const characterInfo = userOrderedCharacterInfos[0].metas;
    const { engineId, styleId } = characterInfo.styles[0];

    // テキスト長が0の時にエラー表示にならないように、テキスト長を考慮する
    isOnlyHiraOrKana.value = !text.length || kanaRegex.test(text);
    // 読みが変更されていない場合は、アクセントフレーズに変更を加えない
    // ただし、読みが同じで違う単語が存在する場合が考えられるので、changeWord フラグを考慮する
    // 「ガ」が自動挿入されるので、それを考慮して slice している
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

    // 将来的な複数アクセント句対応のため、現状は最初の項目のみ更新
    if (pronunciationItems.value.length > 0) {
      pronunciationItems.value[0].yomi = text;
      pronunciationItems.value[0].accentPhrase = accentPhrase.value;
    }
  }

  // 辞書データから状態を更新する
  async function loadWord(dictData: UserDictWord): Promise<void> {
    surface.value = dictData.surface;
    yomi.value = dictData.yomi;
    wordType.value = getWordTypeFromPartOfSpeech(dictData);
    wordPriority.value = dictData.priority;

    // 複数アクセント句対応の準備
    const stemArray: string[] = Array.isArray(dictData.stem) ? dictData.stem : [dictData.stem];
    const yomiArray: string[] = Array.isArray(dictData.yomi) ? dictData.yomi : [dictData.yomi];
    const accentTypeArray: number[] = Array.isArray(dictData.accentType) ? dictData.accentType : [dictData.accentType];

    pronunciationItems.value = [];
    for (let i = 0; i < Math.max(stemArray.length, yomiArray.length); i++) {
      const itemSurface = i < stemArray.length ? stemArray[i] : "";
      const itemYomi = i < yomiArray.length ? yomiArray[i] : "";
      pronunciationItems.value.push({
        surface: itemSurface,
        yomi: itemYomi
      });
    }

    // 現状は1つ目の項目のみアクセント句を設定
    await setYomi(yomi.value, true);
    updateCombinedSurface();
  }

  // 辞書操作系関数
  async function loadUserDict(): Promise<void> {
    if (store.state.engineIds.length === 0)
      throw new Error("assert engineId.length > 0");

    loadingDictState.value = "loading";
    try {
      userDict.value = await createUILockAction(
        store.actions.LOAD_ALL_USER_DICT(),
      );
    } catch (ex) {
      await store.actions.SHOW_ALERT_DIALOG({
        title: "辞書の取得に失敗しました",
        message: "音声合成エンジンの再起動をお試しください。",
      });
      throw ex;
    }
    loadingDictState.value = "synchronizing";
    try {
      await createUILockAction(store.actions.SYNC_ALL_USER_DICT());
    } catch (ex) {
      await store.actions.SHOW_ALERT_DIALOG({
        title: "辞書の同期に失敗しました",
        message: "音声合成エンジンの再起動をお試しください。",
      });
      throw ex;
    }
    loadingDictState.value = null;
  }

  // 単語追加の処理
  async function addWord(): Promise<string> {
    if (!accentPhrase.value) throw new Error("accentPhrase === undefined");
    const accent = computeRegisteredAccent();

    try {
      const wordUuid = await createUILockAction(
        store.actions.ADD_WORD({
          surface: surface.value,
          pronunciation: yomi.value,
          accentType: accent,
          wordType: wordType.value,
          priority: wordPriority.value,
        }),
      );
      return wordUuid;
    } catch (ex) {
      await store.actions.SHOW_ALERT_DIALOG({
        title: "単語の登録に失敗しました",
        message: "エンジンの再起動をお試しください。",
      });
      throw ex;
    }
  }

  // 単語更新の処理
  async function updateWord(wordId: string): Promise<void> {
    if (!accentPhrase.value) throw new Error("accentPhrase === undefined");
    const accent = computeRegisteredAccent();

    try {
      await store.actions.REWRITE_WORD({
        wordUuid: wordId,
        surface: surface.value,
        pronunciation: yomi.value,
        accentType: accent,
        wordType: wordType.value,
        priority: wordPriority.value,
      });
    } catch (ex) {
      await store.actions.SHOW_ALERT_DIALOG({
        title: "単語の更新に失敗しました",
        message: "エンジンの再起動をお試しください。",
      });
      throw ex;
    }
  }

  // 単語削除の処理
  async function deleteWord(wordId: string): Promise<void> {
    try {
      await createUILockAction(
        store.actions.DELETE_WORD({
          wordUuid: wordId,
        }),
      );
    } catch (ex) {
      await store.actions.SHOW_ALERT_DIALOG({
        title: "単語の削除に失敗しました",
        message: "音声合成エンジンの再起動をお試しください。",
      });
      throw ex;
    }
  }

  // 変更状態の判定
  const isWordChanged = computed((): boolean => {
    if (selectedId.value === "") {
      return (
        surface.value !== "" && yomi.value !== "" && accentPhrase.value != undefined
      );
    }
    // 一旦代入することで、userDictそのものが更新された時もcomputedするようにする
    const dict = userDict.value;
    const dictData = dict[selectedId.value];
    if (!dictData) {
      return false;
    }
    const currentWordType = getWordTypeFromPartOfSpeech(dictData);
    return (
      dictData.surface !== surface.value ||
      dictData.yomi !== yomi.value ||
      dictData.accentType !== computeRegisteredAccent() ||
      currentWordType !== wordType.value ||
      dictData.priority !== wordPriority.value
    );
  });

  // 便利関数 - surface入力時の文字変換
  function convertHankakuToZenkaku(text: string): string {
    // " "などの目に見えない文字をまとめて全角スペース(0x3000)に置き換える
    text = text.replace(/\p{Z}/gu, () => String.fromCharCode(0x3000));

    // "!"から"~"までの範囲の文字(数字やアルファベット)を全角に置き換える
    return text.replace(/[\u0021-\u007e]/g, (s) => {
      return String.fromCharCode(s.charCodeAt(0) + 0xfee0);
    });
  }

  function setSurface(text: string): void {
    // surfaceを全角化する
    // 入力は半角でも問題ないが、登録時に全角に変換され、isWordChangedの判断がおかしくなることがあるので、
    // 入力後に自動で変換するようにする
    surface.value = convertHankakuToZenkaku(text);

    // 将来的な複数アクセント句対応のため、現状は最初の項目のみ更新
    if (pronunciationItems.value.length > 0) {
      pronunciationItems.value[0].surface = surface.value;
    }
    updateCombinedSurface();
  }

  // アクセント変更の処理
  async function changeAccent(_: number, accent: number): Promise<void> {
    const userOrderedCharacterInfos = store.getters.USER_ORDERED_CHARACTER_INFOS("talk");
    if (userOrderedCharacterInfos == undefined)
      throw new Error("assert USER_ORDERED_CHARACTER_INFOS");
    if (store.state.engineIds.length === 0)
      throw new Error("assert engineId.length > 0");
    const characterInfo = userOrderedCharacterInfos[0].metas;
    const { engineId, styleId } = characterInfo.styles[0];

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

      // 将来的な複数アクセント句対応のため、現状は最初の項目のみ更新
      if (pronunciationItems.value.length > 0) {
        pronunciationItems.value[0].accentPhrase = accentPhrase.value;
      }
    }
  }

  // 状態変更系
  function toWordEditingState(): void {
    wordEditing.value = true;
  }

  function toWordSelectedState(): void {
    wordEditing.value = false;
    lastSelectedId.value = selectedId.value;
  }

  function toInitialState(): void {
    isNewWordEditing.value = false;
    wordEditing.value = false;
    selectedId.value = "";
    surface.value = "";
    void setYomi("");
    wordType.value = defaultWordType;
    wordPriority.value = defaultDictPriority;

    // 初期状態では発音アイテムを初期化
    pronunciationItems.value = [{ surface: "", yomi: "" }];

    // 辞書の最初の項目を選択する
    if (Object.keys(userDict.value).length > 0) {
      // 前回選択していた項目があればそれを選択、なければ最初の項目を選択
      const targetKey = lastSelectedId.value && userDict.value[lastSelectedId.value]
        ? lastSelectedId.value
        : Object.keys(userDict.value)[0];
      selectWord(targetKey);
    }
  }

  // 選択処理
  function selectWord(id: string): void {
    selectedId.value = id;
    surface.value = userDict.value[id].surface;
    void setYomi(userDict.value[id].yomi, true);
    wordType.value = getWordTypeFromPartOfSpeech(userDict.value[id]);
    wordPriority.value = userDict.value[id].priority;
    toWordSelectedState();
    toWordEditingState();
  }

  // 新規単語追加時の処理
  function newWord(): void {
    isNewWordEditing.value = true;
    selectedId.value = "";
    surface.value = "";
    void setYomi("");
    wordType.value = defaultWordType;
    wordPriority.value = defaultDictPriority;

    // 発音アイテムを初期化
    pronunciationItems.value = [{ surface: "", yomi: "" }];

    toWordEditingState();
  }

  // 複数アクセント句対応のための追加機能
  function addPronunciationItem(): void {
    pronunciationItems.value.push({ surface: "", yomi: "" });
    updateCombinedSurface();
  }

  function removePronunciationItem(index: number): void {
    if (pronunciationItems.value.length > 1) {
      pronunciationItems.value.splice(index, 1);
      updateCombinedSurface();
    }
  }

  // キャンセル処理
  function cancel(): void {
    toInitialState();
  }

  // 辞書ダイアログで利用する状態とロジックをまとめて返す
  return {
    // 状態
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
    combinedSurface,
    pronunciationItems,
    isWordChanged,

    // 関数
    loadUserDict,
    createUILockAction,
    isYomiValid,
    setSurface,
    setYomi,
    updateCombinedSurface,
    computeRegisteredAccent,
    getWordTypeFromPartOfSpeech,
    addWord,
    updateWord,
    deleteWord,
    loadWord,
    changeAccent,
    toInitialState,
    toWordEditingState,
    toWordSelectedState,
    newWord,
    selectWord,
    cancel,

    // 複数アクセント句用の追加機能
    addPronunciationItem,
    removePronunciationItem,
  };
}