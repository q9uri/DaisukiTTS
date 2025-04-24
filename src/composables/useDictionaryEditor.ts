import { ref, computed } from "vue";
import {
  createKanaRegex,
  convertHankakuToZenkaku,
  convertHiraToKana,
  convertLongVowel,
  getWordTypeFromPartOfSpeech,
} from "@/domain/japanese";
import { AccentPhrase, UserDictWord, WordTypes } from "@/openapi";
import { useStore } from "@/store";


export interface WordAccentPhraseItem {
  surface: string;
  pronunciation: string;
  accentPhrase?: AccentPhrase;
  isValid: boolean;  // pronunciation がひらがな/カタカナのみから構成されているかどうか
}

const defaultWordType = WordTypes.ProperNoun;
const defaultDictPriority = 5;

export function useDictionaryEditor(initialSurface = "", initialPronunciation = "") {
  const store = useStore();

  // 編集状態の管理
  const uiLocked = ref(false);  // ダイアログ内で store.getters.UI_LOCKED は常に true なので独自に管理
  const loadingDictState = ref<null | "loading" | "synchronizing">(null);
  const userDict = ref<Record<string, UserDictWord>>({});
  const isWordEditing = ref(false);
  const isNewWordEditing = ref(false);
  const selectedId = ref("");
  const lastSelectedId = ref("");
  const wordAccentPhraseItems = ref<WordAccentPhraseItem[]>([
    { surface: initialSurface, pronunciation: initialPronunciation, isValid: true }
  ]);
  const wordType = ref<WordTypes>(defaultWordType);
  const wordPriority = ref(defaultDictPriority);

  // 状態が変更されているかどうかを判定する
  const isWordChanged = computed((): boolean => {
    if (selectedId.value === "") {
      // 新規単語の場合
      if (wordAccentPhraseItems.value.length === 0) {
        return false;
      }

      // 少なくとも1つの有効な項目があるかチェック
      return wordAccentPhraseItems.value.some(item =>
        item.surface !== "" &&
        item.pronunciation !== "" &&
        item.accentPhrase != undefined
      );
    }

    // 一旦代入することで、userDictそのものが更新された時もcomputedするようにする
    const dict = userDict.value;
    const dictData = dict[selectedId.value];
    if (!dictData) {
      return false;
    }

    // 現在保存されているデータとの差分があれば true を返す
    // dictData.surface (string) はエンジン側で正規化されているため、
    // dictData.stem (string[]) を連結した文字列と、WordAccentPhraseItem.surface を連結した文字列が一致しない場合がある
    // そのため、ここでは dictData.stem を連結した文字列と、WordAccentPhraseItem.surface を連結した文字列を比較して差分を判定する
    return dictData.stem.join("") !== wordAccentPhraseItems.value.map(item => item.surface).join("") ||
      dictData.pronunciation.join("") !== wordAccentPhraseItems.value.map(item => item.pronunciation).join("") ||
      !dictData.accentType.every((accent, index) => accent === computeRegisteredAccent(index)) ||
      getWordTypeFromPartOfSpeech(dictData) !== wordType.value ||
      dictData.priority !== wordPriority.value;
  });

  // UI をロックした状態で行う処理をラップする関数
  const createUILockAction = async function <T>(action: Promise<T>) {
    uiLocked.value = true;
    try {
      return await action;
    } finally {
      uiLocked.value = false;
    }
  };

  // accent phrase にある accent と実際に登録するアクセントには差が生まれる
  // アクセントが自動追加される「ガ」に指定されている場合、
  // 実際に登録する accent の値は0となるので、そうなるように処理する
  const computeRegisteredAccent = (accentPhraseIndex = 0) => {
    const item = wordAccentPhraseItems.value[accentPhraseIndex];
    if (!item?.accentPhrase) return 0;  // エラーにさせないために0を返す
    let accent = item.accentPhrase.accent;
    accent = accent === item.accentPhrase.moras.length ? 0 : accent;
    return accent;
  };

  // computeRegisteredAccent の逆
  // 辞書から得た accent が0の場合に、自動で追加される「ガ」の位置にアクセントを表示させるように処理する
  const computeDisplayAccent = (accentPhraseIndex = 0) => {
    if (!wordAccentPhraseItems.value[accentPhraseIndex]?.accentPhrase || !selectedId.value) return 0;  // エラーにさせないために0を返す
    let accent = userDict.value[selectedId.value].accentType[accentPhraseIndex];
    accent = accent === 0 ? wordAccentPhraseItems.value[accentPhraseIndex].accentPhrase.moras.length : accent;
    return accent;
  };

  // 現在エンジン側に保持されているユーザー辞書を読み込む
  async function loadUserDict(): Promise<void> {
    if (store.state.engineIds.length === 0)
      throw new Error("assert engineId.length > 0");

    loadingDictState.value = "loading";
    try {
      userDict.value = await createUILockAction(
        store.actions.LOAD_ALL_USER_DICT(),
      );
    } catch (error) {
      await store.actions.SHOW_ALERT_DIALOG({
        title: "辞書の取得に失敗しました",
        message: "音声合成エンジンの再起動をお試しください。",
      });
      throw error;
    }
    loadingDictState.value = "synchronizing";
    try {
      await createUILockAction(store.actions.SYNC_ALL_USER_DICT());
    } catch (error) {
      await store.actions.SHOW_ALERT_DIALOG({
        title: "辞書の同期に失敗しました",
        message: "音声合成エンジンの再起動をお試しください。",
      });
      throw error;
    }
    loadingDictState.value = null;
  }

  // 現在状態で保持している単語をエンジン側に追加する
  async function addWordToEngine(): Promise<string> {
    if (!wordAccentPhraseItems.value[0]?.accentPhrase)
      throw new Error("accentPhrase === undefined");
    const accentPositions: number[] = [];
    for (let i = 0; i < wordAccentPhraseItems.value.length; i++) {
      accentPositions.push(computeRegisteredAccent(i));
    }

    try {
      const wordUuid = await createUILockAction(
        store.actions.ADD_WORD({
          surface: wordAccentPhraseItems.value.map(item => item.surface),
          pronunciation: wordAccentPhraseItems.value.map(item => item.pronunciation),
          accentType: accentPositions,
          wordType: wordType.value,
          priority: wordPriority.value,
        }),
      );
      return wordUuid;
    } catch (error) {
      await store.actions.SHOW_ALERT_DIALOG({
        title: "単語の登録に失敗しました",
        message: "エンジンの再起動をお試しください。",
      });
      throw error;
    }
  }

  // 現在状態で保持している単語をエンジン側に反映・更新する
  async function updateWordToEngine(wordId: string): Promise<void> {
    if (!wordAccentPhraseItems.value[0]?.accentPhrase)
      throw new Error("accentPhrase === undefined");
    const accentPositions: number[] = [];
    for (let i = 0; i < wordAccentPhraseItems.value.length; i++) {
      accentPositions.push(computeRegisteredAccent(i));
    }

    try {
      await store.actions.UPDATE_WORD({
        wordUuid: wordId,
        surface: wordAccentPhraseItems.value.map(item => item.surface),
        pronunciation: wordAccentPhraseItems.value.map(item => item.pronunciation),
        accentType: accentPositions,
        wordType: wordType.value,
        priority: wordPriority.value,
      });
    } catch (error) {
      await store.actions.SHOW_ALERT_DIALOG({
        title: "単語の更新に失敗しました",
        message: "エンジンの再起動をお試しください。",
      });
      throw error;
    }
  }

  // 現在状態で保持している単語をエンジン側から削除する
  async function deleteWordFromEngine(wordId: string): Promise<void> {
    try {
      await createUILockAction(
        store.actions.DELETE_WORD({
          wordUuid: wordId,
        }),
      );
    } catch (error) {
      await store.actions.SHOW_ALERT_DIALOG({
        title: "単語の削除に失敗しました",
        message: "音声合成エンジンの再起動をお試しください。",
      });
      throw error;
    }
  }

  // 指定されたアクセント句の表層形を更新する
  function updateSurface(surface: string, accentPhraseIndex = 0): void {
    // surfaceを全角化する
    // 入力は半角でも問題ないが、登録時に全角に変換され、isWordChangedの判断がおかしくなることがあるので、
    // 入力後に自動で変換するようにする
    const convertedText = convertHankakuToZenkaku(surface);

    // 指定されたインデックスが存在しない場合は作成
    while (wordAccentPhraseItems.value.length <= accentPhraseIndex) {
      wordAccentPhraseItems.value.push({
        surface: "",
        pronunciation: "",
        isValid: true,
      });
    }

    wordAccentPhraseItems.value[accentPhraseIndex].surface = convertedText;
  }

  // 指定されたアクセント句の発音を更新する
  async function updatePronunciation(pronunciation: string, accentPhraseIndex = 0, changeWord?: boolean): Promise<void> {
    // ユーザーによるソート順で一番先頭にあたるキャラクターの EngineId, StyleId を取得する
    const userOrderedCharacterInfos = store.getters.USER_ORDERED_CHARACTER_INFOS("talk");
    if (userOrderedCharacterInfos == undefined)
      throw new Error("assert USER_ORDERED_CHARACTER_INFOS");
    if (store.state.engineIds.length === 0)
      throw new Error("assert engineId.length > 0");
    const characterInfo = userOrderedCharacterInfos[0].metas;
    const { engineId, styleId } = characterInfo.styles[0];

    // テキスト長が0の時にエラー表示にならないように、テキスト長を考慮する
    const kanaRegex = createKanaRegex();
    const isValid = !pronunciation.length || kanaRegex.test(pronunciation);

    // 指定されたインデックスが存在しない場合は作成
    while (wordAccentPhraseItems.value.length <= accentPhraseIndex) {
      wordAccentPhraseItems.value.push({
        surface: "",
        pronunciation: "",
        isValid: true,
      });
    }

    // 現在の項目
    const currentItem = wordAccentPhraseItems.value[accentPhraseIndex];
    currentItem.isValid = isValid;

    // 読みが変更されていない場合は、アクセントフレーズに変更を加えない
    // ただし、読みが同じで違う単語が存在する場合が考えられるので、changeWord フラグを考慮する
    // 「ガ」が自動挿入されるので、それを考慮して slice している
    if (
      pronunciation ===
        currentItem.accentPhrase?.moras
          .map((v) => v.text)
          .join("")
          .slice(0, -1) &&
      !changeWord
    ) {
      return;
    }

    if (isValid && pronunciation.length) {
      pronunciation = convertHiraToKana(pronunciation);
      pronunciation = convertLongVowel(pronunciation);

      // 現在の項目が最後の要素の場合のみ「ガ」を追加する
      const isLastItem = accentPhraseIndex === wordAccentPhraseItems.value.length - 1;
      const textToFetch = isLastItem ? pronunciation + "ガ'" : pronunciation + "'";

      const fetchedAccentPhrase = (
        await store.actions.FETCH_ACCENT_PHRASES({
          text: textToFetch,
          engineId,
          styleId,
          isKana: true,
        })
      )[0];

      currentItem.accentPhrase = fetchedAccentPhrase;

      if (selectedId.value && userDict.value[selectedId.value].pronunciation[accentPhraseIndex] === pronunciation) {
        currentItem.accentPhrase.accent = computeDisplayAccent(accentPhraseIndex);
      }
    } else {
      currentItem.accentPhrase = undefined;
    }

    currentItem.pronunciation = pronunciation;
  }

  // 指定されたアクセント句のアクセント位置を変更する
  async function changeAccentPosition(accentPhraseIndex: number, accent: number): Promise<void> {
    // ユーザーによるソート順で一番先頭にあたるキャラクターの EngineId, StyleId を取得する
    const userOrderedCharacterInfos = store.getters.USER_ORDERED_CHARACTER_INFOS("talk");
    if (userOrderedCharacterInfos == undefined)
      throw new Error("assert USER_ORDERED_CHARACTER_INFOS");
    if (store.state.engineIds.length === 0)
      throw new Error("assert engineId.length > 0");
    const characterInfo = userOrderedCharacterInfos[0].metas;
    const { engineId, styleId } = characterInfo.styles[0];

    // 指定されたインデックスが存在する場合のみ処理
    if (accentPhraseIndex < wordAccentPhraseItems.value.length && wordAccentPhraseItems.value[accentPhraseIndex].accentPhrase) {
      const item = wordAccentPhraseItems.value[accentPhraseIndex];
      item.accentPhrase!.accent = accent;

      // アクセント位置変更後の音高・音素長などのモーラ情報を取得し、既存のアクセント句情報を更新する
      item.accentPhrase = (
        await createUILockAction(
          store.actions.FETCH_MORA_DATA({
            accentPhrases: [item.accentPhrase!],
            engineId,
            styleId,
          }),
        )
      )[0];
    }
  }

  // 新しいアクセント句を追加する
  function addWordAccentPhraseItem(): void {
    wordAccentPhraseItems.value.push({
      surface: "",
      pronunciation: "",
      isValid: true,
    });
    // 追加したアクセント句を含め、すべてのアクセント句の発音を更新する
    // そうしないと、常に wordAccentPhraseItems の最後の要素にのみ「ガ」を付与する挙動が維持できない
    for (let i = 0; i < wordAccentPhraseItems.value.length; i++) {
      void updatePronunciation(wordAccentPhraseItems.value[i].pronunciation, i, true);
    }
  }

  // 指定されたアクセント句を削除する
  function removeWordAccentPhraseItem(accentPhraseIndex: number): void {
    if (wordAccentPhraseItems.value.length > 1) {
      wordAccentPhraseItems.value.splice(accentPhraseIndex, 1);
      // 追加したアクセント句を含め、すべてのアクセント句の発音を更新する
      // そうしないと、常に wordAccentPhraseItems の最後の要素にのみ「ガ」を付与する挙動が維持できない
      for (let i = 0; i < wordAccentPhraseItems.value.length; i++) {
        void updatePronunciation(wordAccentPhraseItems.value[i].pronunciation, i, true);
      }
    }
  }

  // ダイヤログを新規追加状態に変更する
  function toWordAddingState(): void {
    // 新規追加状態に設定
    isNewWordEditing.value = true;
  }

  // ダイヤログを編集状態に変更する
  function toWordEditingState(): void {
    // 編集状態に設定
    isWordEditing.value = true;
  }

  // ダイヤログを選択状態に変更する
  function toWordSelectedState(): void {
    // 新規追加状態を解除
    isNewWordEditing.value = false;
    // 編集状態を解除
    isWordEditing.value = false;
    // 選択していた項目を記録
    lastSelectedId.value = selectedId.value;
  }

  // ダイヤログを初期状態に戻す
  function toInitialState(): void {
    // 編集状態を解除
    isWordEditing.value = false;
    // 新規追加状態を解除
    isNewWordEditing.value = false;
    // 状態を初期化
    selectedId.value = "";
    wordAccentPhraseItems.value = [{ surface: "", pronunciation: "", isValid: true }];
    wordType.value = defaultWordType;
    wordPriority.value = defaultDictPriority;

    // 辞書に単語が1個以上登録されている場合のみ
    if (Object.keys(userDict.value).length > 0) {
      // 前回選択していた項目があればそれを選択、なければ最初の項目を選択
      const targetKey = lastSelectedId.value && userDict.value[lastSelectedId.value]
        ? lastSelectedId.value
        : Object.keys(userDict.value)[0];
      selectWord(targetKey);
    }
  }

  // 新しい単語を追加できるように状態を変更する
  function addNewWord(): void {
    // 状態を初期化
    selectedId.value = "";
    wordAccentPhraseItems.value = [{
      surface: "",
      pronunciation: "",
      isValid: true,
    }];
    wordType.value = defaultWordType;
    wordPriority.value = defaultDictPriority;

    // 新規追加状態に設定
    toWordAddingState();
    // 編集状態に設定
    toWordEditingState();
  }

  // 指定された ID の単語を選択する
  function selectWord(id: string): void {
    // id が空文字または辞書データが存在しないときは初期状態に戻す
    if (id === "" || !userDict.value[id]) {
      toInitialState();
      return;
    }

    // 選択に合わせて状態を更新
    selectedId.value = id;
    wordAccentPhraseItems.value = [];
    // UserDictWord の stem と pronunciation はアクセント句ごとに分割されているので、WordAccentPhraseItem に変換する
    for (let i = 0; i < userDict.value[id].stem.length; i++) {
      wordAccentPhraseItems.value.push({
        surface: userDict.value[id].stem[i],
        pronunciation: userDict.value[id].pronunciation[i],
        isValid: true,
      });
    }
    // アクセント句がない場合は空のアイテムを追加（通常発生しないはず）
    if (wordAccentPhraseItems.value.length === 0) {
      wordAccentPhraseItems.value.push({
        surface: userDict.value[id].surface,
        pronunciation: "",
        isValid: true,
      });
    }
    wordType.value = getWordTypeFromPartOfSpeech(userDict.value[id]);
    wordPriority.value = userDict.value[id].priority;

    // 発音を更新（この処理でエンジン側から AccentPhrase が取得される）
    for (let i = 0; i < wordAccentPhraseItems.value.length; i++) {
      void updatePronunciation(wordAccentPhraseItems.value[i].pronunciation, i, true);
    }

    // 選択状態に設定
    toWordSelectedState();
    // 編集状態に設定
    toWordEditingState();
  }

  // 辞書ダイアログで利用する状態とロジックをまとめて返す
  return {
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
  };
}
