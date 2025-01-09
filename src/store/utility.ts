import * as diff from "fast-array-diff";
import {
  CharacterInfo,
  PresetSliderKey,
  StyleInfo,
  StyleType,
  ToolbarButtonTagType,
} from "@/type/preload";
import { AccentPhrase, FramePhoneme, Mora } from "@/openapi";
import { cloneWithUnwrapProxy } from "@/helpers/cloneWithUnwrapProxy";
import { DEFAULT_TRACK_NAME, isVowel } from "@/sing/domain";
import { isMac } from "@/helpers/platform";
import { generateTextFileData } from "@/helpers/fileDataGenerator";

export const DEFAULT_STYLE_NAME = "ノーマル";
export const DEFAULT_PROJECT_NAME = "Untitled";

export const formatCharacterStyleName = (
  characterName: string,
  styleName = DEFAULT_STYLE_NAME,
  // eslint-disable-next-line no-irregular-whitespace
) => `${characterName}​（${styleName}）`;

export function sanitizeFileName(fileName: string): string {
  // \x00 - \x1f: ASCII 制御文字
  //   \x00: Null
  //   ...
  //   \x1f: Unit separator
  // \x22: "
  // \x2a: *
  // \x2f: /
  // \x3a: :
  // \x3c: <
  // \x3e: >
  // \x3f: ?
  // \x5c: \
  // \x7c: |
  // \x7f: DEL

  // eslint-disable-next-line no-control-regex
  const sanitizer = /[\x00-\x1f\x22\x2a\x2f\x3a\x3c\x3e\x3f\x5c\x7c\x7f]/g;

  return fileName.replace(sanitizer, "");
}

type SliderParameter = {
  max: () => number;
  min: () => number;
  step: () => number;
  scrollStep: () => number;
  scrollMinStep?: () => number;
};

/**
 * AudioInfoコンポーネントに表示されるパラメータ
 * TODO: src/domain/talk.ts辺りに切り出す
 */
export const SLIDER_PARAMETERS: Record<PresetSliderKey, SliderParameter> = {
  /**
   * 話速パラメータの定義
   */
  speedScale: {
    max: () => 2,
    min: () => 0.5,
    step: () => 0.01,
    scrollStep: () => 0.1,
    scrollMinStep: () => 0.01,
  },
  /**
   * スタイルの強さパラメータの定義
   */
  intonationScale: {
    max: () => 2,
    min: () => 0,
    step: () => 0.01,
    scrollStep: () => 0.1,
    scrollMinStep: () => 0.01,
  },
  /**
   * テンポの緩急パラメータの定義
   */
  tempoDynamicsScale: {
    max: () => 2,
    min: () => 0,
    step: () => 0.01,
    scrollStep: () => 0.1,
    scrollMinStep: () => 0.01,
  },
  /**
   * 音高パラメータの定義
   */
  pitchScale: {
    max: () => 0.15,
    min: () => -0.15,
    step: () => 0.01,
    scrollStep: () => 0.01,
  },
  /**
   *  音量パラメータの定義
   */
  volumeScale: {
    max: () => 2,
    min: () => 0,
    step: () => 0.01,
    scrollStep: () => 0.1,
    scrollMinStep: () => 0.01,
  },
  /**
   *  文内無音(倍率)パラメータの定義
   */
  pauseLengthScale: {
    max: () => 2,
    min: () => 0,
    step: () => 0.01,
    scrollStep: () => 0.1,
    scrollMinStep: () => 0.01,
  },
  /**
   *  開始無音パラメータの定義
   */
  prePhonemeLength: {
    max: () => 1.5,
    min: () => 0,
    step: () => 0.01,
    scrollStep: () => 0.1,
    scrollMinStep: () => 0.01,
  },
  /**
   *  終了無音パラメータの定義
   */
  postPhonemeLength: {
    max: () => 1.5,
    min: () => 0,
    step: () => 0.01,
    scrollStep: () => 0.1,
    scrollMinStep: () => 0.01,
  },
  /**
   *  モーフィングレートパラメータの定義
   */
  morphingRate: {
    max: () => 1,
    min: () => 0,
    step: () => 0.01,
    scrollStep: () => 0.1,
    scrollMinStep: () => 0.01,
  },
};

export const replaceTagIdToTagString = {
  index: "連番",
  characterName: "キャラ",
  styleName: "スタイル",
  text: "テキスト",
  date: "日付",
  projectName: "プロジェクト名",
  trackName: "トラック名",
};
const replaceTagStringToTagId: Record<string, string> = Object.entries(
  replaceTagIdToTagString,
).reduce((prev, [k, v]) => ({ ...prev, [v]: k }), {});

export const DEFAULT_AUDIO_FILE_NAME_TEMPLATE =
  "$連番$_$キャラ$（$スタイル$）_$テキスト$";
const DEFAULT_AUDIO_FILE_NAME_VARIABLES = {
  index: 0,
  characterName: "Anneli",
  text: "テキストテキストテキスト",
  styleName: DEFAULT_STYLE_NAME,
  date: currentDateString(),
  projectName: "VOICEVOXプロジェクト",
};

export const DEFAULT_SONG_AUDIO_FILE_NAME_TEMPLATE =
  "$連番$_$キャラ$（$スタイル$）_$トラック名$";
const DEFAULT_SONG_AUDIO_FILE_NAME_VARIABLES = {
  index: 0,
  characterName: "Anneli",
  trackName: DEFAULT_TRACK_NAME,
  styleName: DEFAULT_STYLE_NAME,
  date: currentDateString(),
  projectName: "VOICEVOXプロジェクト",
};

export function currentDateString(): string {
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  // NOTE: getMonth()は0から始まるので1を足す
  const month = (currentDate.getMonth() + 1).toString().padStart(2, "0");
  const date = currentDate.getDate().toString().padStart(2, "0");

  return `${year}${month}${date}`;
}

function replaceTag(
  template: string,
  replacer: Record<string, string>,
): string {
  const result = template.replace(/\$(.+?)\$/g, (match, p1: string) => {
    const replaceTagId = replaceTagStringToTagId[p1];
    if (replaceTagId == undefined) {
      return match;
    }
    return replacer[replaceTagId] ?? "";
  });

  return result;
}

/**
 * テキスト書き出し用のテキストを生成する。
 */
export function extractExportText(
  text: string,
  {
    enableMemoNotation,
    enableRubyNotation,
  }: { enableMemoNotation: boolean; enableRubyNotation: boolean },
): string {
  if (enableMemoNotation) {
    text = skipMemoText(text);
  }
  if (enableRubyNotation) {
    text = skipRubyReadingPart(text);
  }
  return text;
}

/**
 * 読み用のテキストを生成する。
 */
export function extractYomiText(
  text: string,
  {
    enableMemoNotation,
    enableRubyNotation,
  }: { enableMemoNotation: boolean; enableRubyNotation: boolean },
): string {
  if (enableMemoNotation) {
    text = skipMemoText(text);
  }
  if (enableRubyNotation) {
    text = skipRubyWritingPart(text);
  }
  return text;
}

function skipRubyReadingPart(text: string): string {
  // テキスト内の全ての{漢字|かんじ}パターンを探し、漢字部分だけを残す
  return text
    .replace(/\{([^|]*)\|([^}]*)\}/g, "$1")
    .replace(/｛([^|]*)｜([^}]*)｝/g, "$1");
}
function skipRubyWritingPart(text: string): string {
  // テキスト内の全ての{漢字|かんじ}パターンを探し、かんじ部分だけを残す
  return text
    .replace(/\{([^|]*)\|([^}]*)\}/g, "$2")
    .replace(/｛([^|]*)｜([^}]*)｝/g, "$2");
}
function skipMemoText(targettext: string): string {
  // []をスキップ
  return targettext.replace(/\[.*?\]/g, "").replace(/［.*?］/g, "");
}

/**
 * 調整したモーラのパラメーターがリセットされるのを防ぐ
 *
 * <例>
 * 「こんにちは」 -> 「こんばんは」と変更した場合、[]に囲まれる部分で変更前のモーラが転写される。
 * 「 [こん]ばん[は] 」
 */
export class TuningTranscription {
  beforeAccent: AccentPhrase[];
  afterAccent: AccentPhrase[];
  constructor(beforeAccent: AccentPhrase[], afterAccent: AccentPhrase[]) {
    this.beforeAccent = cloneWithUnwrapProxy(beforeAccent);
    this.afterAccent = cloneWithUnwrapProxy(afterAccent);
  }

  /**
   * 変更前と変更後のAccentPhraseに存在するモーラの差分を取得し
   * 変更内容を適用したモーラの配列を返す
   */
  private createTranscriptionSource() {
    const before = structuredClone(this.beforeAccent);
    const after = structuredClone(this.afterAccent);
    const beforeFlatArray = before.flatMap((accent) => accent.moras);
    const afterFlatArray = after.flatMap((accent) => accent.moras);

    // beforeFlatArrayとafterFlatArrayの特定の要素が一致するかどうかを判定する関数
    const matchRequirements = (beforeMora: Mora, afterMora: Mora) =>
      beforeMora?.text === afterMora?.text;

    const morasDiff = diff.getPatch(
      beforeFlatArray,
      afterFlatArray,
      matchRequirements,
    );

    return diff.applyPatch(beforeFlatArray, morasDiff);
  }

  /**
   * transcriptionSourceのモーラ配列のうち、テキストが一致するものを変更後のAccentPhraseの各モーラに適用する
   */
  private applyTranscriptionSource(
    transcriptionSource: Mora[],
  ): AccentPhrase[] {
    const after: AccentPhrase[] = structuredClone(this.afterAccent);
    let moraPatchIndex = 0;

    // AccentPhrasesから[ accentIndex ]["moras"][ moraIndex ]でモーラが得られる。
    for (let accentIndex = 0; accentIndex < after.length; accentIndex++) {
      for (
        let moraIndex = 0;
        moraIndex < after[accentIndex]["moras"].length;
        moraIndex++
      ) {
        if (
          after[accentIndex]["moras"][moraIndex].text ===
          transcriptionSource[moraPatchIndex]?.text
        ) {
          after[accentIndex]["moras"][moraIndex] =
            transcriptionSource[moraPatchIndex];
        }
        moraPatchIndex++;
      }
    }

    return after;
  }

  transcribe() {
    const transcriptionSource = this.createTranscriptionSource();
    return this.applyTranscriptionSource(transcriptionSource);
  }
}

/**
 * ２つのAccentPhrasesのテキスト内容が異なるかどうかを判定
 */
export function isAccentPhrasesTextDifferent(
  beforeAccent: AccentPhrase[],
  afterAccent: AccentPhrase[],
): boolean {
  if (beforeAccent.length !== afterAccent.length) return true;

  for (let accentIndex = 0; accentIndex < beforeAccent.length; accentIndex++) {
    if (
      beforeAccent[accentIndex].moras.length !==
        afterAccent[accentIndex].moras.length ||
      beforeAccent[accentIndex].pauseMora?.text !==
        afterAccent[accentIndex].pauseMora?.text
    )
      return true;

    for (
      let moraIndex = 0;
      moraIndex < beforeAccent[accentIndex].moras.length;
      moraIndex++
    ) {
      if (
        beforeAccent[accentIndex].moras[moraIndex].text !==
        afterAccent[accentIndex].moras[moraIndex].text
      ) {
        return true;
      }
    }
  }
  return false;
}

function formatCommonFileNameFromRawData(commonVars: {
  characterName: string;
  index: number;
  styleName: string;
  date: string;
  projectName: string;
}): {
    characterName: string;
    index: string;
    styleName: string;
    date: string;
    projectName: string;
  } {
  const characterName = sanitizeFileName(commonVars.characterName);
  const index = (commonVars.index + 1).toString().padStart(3, "0");
  const styleName = sanitizeFileName(commonVars.styleName);
  const date = commonVars.date;
  const projectName = sanitizeFileName(commonVars.projectName);
  return {
    characterName,
    index,
    styleName,
    date,
    projectName,
  };
}

export function buildAudioFileNameFromRawData(
  fileNamePattern = DEFAULT_AUDIO_FILE_NAME_TEMPLATE,
  vars = DEFAULT_AUDIO_FILE_NAME_VARIABLES,
): string {
  let pattern = fileNamePattern;
  if (pattern === "") {
    // ファイル名指定のオプションが初期値("")ならデフォルトテンプレートを使う
    pattern = DEFAULT_AUDIO_FILE_NAME_TEMPLATE;
  }

  let text = sanitizeFileName(vars.text);
  if (text.length > 10) {
    text = text.substring(0, 9) + "…";
  }

  const commonVars = formatCommonFileNameFromRawData(vars);

  return replaceTag(pattern, {
    ...commonVars,
    text,
  });
}

export function buildSongTrackAudioFileNameFromRawData(
  fileNamePattern = DEFAULT_SONG_AUDIO_FILE_NAME_TEMPLATE,
  vars = DEFAULT_SONG_AUDIO_FILE_NAME_VARIABLES,
): string {
  let pattern = fileNamePattern;
  if (pattern === "") {
    // ファイル名指定のオプションが初期値("")ならデフォルトテンプレートを使う
    pattern = DEFAULT_SONG_AUDIO_FILE_NAME_TEMPLATE;
  }

  let trackName = sanitizeFileName(vars.trackName);
  if (trackName.length > 10) {
    trackName = trackName.substring(0, 9) + "…";
  }

  const commonVars = formatCommonFileNameFromRawData(vars);

  return replaceTag(pattern, {
    ...commonVars,
    trackName,
  });
}

/**
 * オブジェクトごとに一意なキーを作る。
 * 一時的な利用のみを想定しているため、保存に利用すべきではない。
 */
export async function generateTempUniqueId(serializable: unknown) {
  const data = new TextEncoder().encode(JSON.stringify(serializable));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}

export const getToolbarButtonName = (tag: ToolbarButtonTagType): string => {
  const tag2NameObj: Record<ToolbarButtonTagType, string> = {
    PLAY_CONTINUOUSLY: "連続再生",
    PLAY: "選択音声を再生",
    STOP: "停止",
    EXPORT_AUDIO_SELECTED: "選択音声を書き出し",
    EXPORT_AUDIO_ALL: "全部書き出し",
    EXPORT_AUDIO_CONNECT_ALL: "音声をつなげて書き出し",
    SAVE_PROJECT: "プロジェクトを保存",
    UNDO: "元に戻す",
    REDO: "やり直す",
    IMPORT_TEXT: "テキスト読み込み",
    EMPTY: "空白",
    SPACER_1: "区切り1",
    SPACER_2: "区切り2",
    SPACER_3: "区切り3",
  };
  return tag2NameObj[tag];
};

export const getToolbarButtonIcon = (tag: ToolbarButtonTagType): string => {
  // Quasar では - ではなく _ を使う必要がある
  // ref: https://quasar.dev/vue-components/icon
  const tag2IconObj: Record<ToolbarButtonTagType, string> = {
    PLAY_CONTINUOUSLY: "sym_r_autoplay",
    PLAY: "sym_r_play_arrow",
    STOP: "sym_r_stop",
    EXPORT_AUDIO_SELECTED: "sym_r_outbound",
    EXPORT_AUDIO_ALL: "sym_r_export_notes",
    EXPORT_AUDIO_CONNECT_ALL: 'img:data:image/svg+xml;charset=utf8,<svg viewBox="0 0 13 14" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(%23clip0_2_4)"><path d="M10.7961 10.7601V11.7519C10.7961 11.8254 10.8236 11.8897 10.8787 11.9448C10.9338 11.9999 10.9981 12.0274 11.0715 12.0274C11.145 12.0274 11.2093 11.9999 11.2644 11.9448C11.3195 11.8897 11.347 11.8254 11.347 11.7519V10.099C11.347 10.0255 11.3195 9.96121 11.2644 9.90611C11.2093 9.85101 11.145 9.82346 11.0715 9.82346H9.41858C9.34512 9.82346 9.28084 9.85101 9.22574 9.90611C9.17064 9.96121 9.14309 10.0255 9.14309 10.099C9.14309 10.1724 9.17064 10.2367 9.22574 10.2918C9.28084 10.3469 9.34512 10.3745 9.41858 10.3745H10.4104L9.06044 11.7244C9.00534 11.7795 8.97779 11.8438 8.97779 11.9172C8.97779 11.9907 9.00534 12.055 9.06044 12.1101C9.11554 12.1652 9.17982 12.1927 9.25329 12.1927C9.32675 12.1927 9.39103 12.1652 9.44613 12.1101L10.7961 10.7601ZM10.2451 13.6804C9.48286 13.6804 8.83316 13.4118 8.29595 12.8746C7.75873 12.3373 7.49013 11.6876 7.49013 10.9254C7.49013 10.1632 7.75873 9.51353 8.29595 8.97632C8.83316 8.43911 9.48286 8.1705 10.2451 8.1705C11.0073 8.1705 11.657 8.43911 12.1942 8.97632C12.7314 9.51353 13 10.1632 13 10.9254C13 11.6876 12.7314 12.3373 12.1942 12.8746C11.657 13.4118 11.0073 13.6804 10.2451 13.6804Z" fill="%23FBEEEA"/><path fill-rule="evenodd" clip-rule="evenodd" d="M9.65093 2.61512L7.68494 0.649134C7.47397 0.438155 7.18782 0.319626 6.88945 0.319626H2.10543C1.48411 0.319626 0.980434 0.823298 0.980434 1.44463V11.1946C0.980434 11.816 1.48411 12.3196 2.10543 12.3196H7.08844C7.06335 12.2558 7.04031 12.1909 7.01939 12.1251C6.91026 11.8317 6.84 11.5195 6.81485 11.1946H2.10543V1.44463H5.85543V3.88213C5.85543 4.19279 6.10727 4.44463 6.41793 4.44463H8.85543V7.77702C9.20389 7.623 9.58271 7.52513 9.98043 7.49487V3.41061C9.98043 3.11224 9.86191 2.8261 9.65093 2.61512ZM8.76445 3.31963H6.98043V1.53561L8.76445 3.31963ZM5.48043 9.41281C5.48043 9.66338 5.17748 9.78887 5.00032 9.61168L4.16793 8.76852H3.51168C3.35636 8.76852 3.23043 8.64259 3.23043 8.48727V7.17477C3.23043 7.01945 3.35636 6.89352 3.51168 6.89352H4.16793L5.00032 6.02757C5.1775 5.85038 5.48043 5.97587 5.48043 6.22644V9.41281ZM6.44608 8.3082C6.65822 8.09031 6.65843 7.74259 6.44611 7.52448C5.92699 6.99123 6.73286 6.20621 7.25224 6.73977C7.88969 7.39461 7.89002 8.43767 7.25226 9.09291C6.74149 9.61759 5.91757 8.85116 6.44608 8.3082Z" fill="%23FBEEEA"/></g><defs><clipPath id="clip0_2_4"><rect width="13" height="14" fill="white"/></clipPath></defs></svg>',
    SAVE_PROJECT: "sym_r_save",
    UNDO: "sym_r_undo",
    REDO: "sym_r_redo",
    IMPORT_TEXT: "sym_r_upload_file",
    EMPTY: "",
    SPACER_1: "",
    SPACER_2: "",
    SPACER_3: "",
  };
  return tag2IconObj[tag];
};

/**
 * Macでの`command`キー、またはその他OSでの`Ctrl`キーが押されているなら`true`を返します。
 */
// ctrlKey = windowsのCtrl = macのControl
// metaKey = windowsのWin = macのCommand
// altKey = windowsのAlt = macのOption(問題なし)
export const isOnCommandOrCtrlKeyDown = (event: {
  metaKey: boolean;
  ctrlKey: boolean;
}) => (isMac && event.metaKey) || (!isMac && event.ctrlKey);

/**
 * スタイルがシングエディタで利用可能なスタイルかどうかを判定します。
 */
export const isSingingStyle = (styleInfo: StyleInfo) => {
  return (
    styleInfo.styleType === "frame_decode" ||
    styleInfo.styleType === "sing" ||
    styleInfo.styleType === "singing_teacher"
  );
};

/**
 * CharacterInfoの配列を、指定されたスタイルタイプでフィルタリングします。
 * singerLikeはソング系スタイルのみを残します。
 * talkはソング系スタイルをすべて除外します。
 * FIXME: 上記以外のフィルタリング機能はテストでしか使っていないので、しばらくそのままなら削除する
 */
export const filterCharacterInfosByStyleType = (
  characterInfos: CharacterInfo[],
  styleType: StyleType | "singerLike",
): CharacterInfo[] => {
  const withStylesFiltered: CharacterInfo[] = characterInfos.map(
    (characterInfo) => {
      const styles = characterInfo.metas.styles.filter((styleInfo) => {
        if (styleType === "singerLike") {
          return isSingingStyle(styleInfo);
        }
        // 過去のエンジンにはstyleTypeが存在しないので、「singerLike以外」をtalkとして扱っている。
        if (styleType === "talk") {
          return !isSingingStyle(styleInfo);
        }
        return styleInfo.styleType === styleType;
      });
      return { ...characterInfo, metas: { ...characterInfo.metas, styles } };
    },
  );

  const withoutEmptyStyles = withStylesFiltered.filter(
    (characterInfo) => characterInfo.metas.styles.length > 0,
  );

  return withoutEmptyStyles;
};

export async function generateLabelFileDataFromFramePhonemes(
  phonemes: FramePhoneme[],
  frameRate: number,
) {
  let labString = "";
  let timestamp = 0;

  const writeLine = (phonemeLengthSeconds: number, phoneme: string) => {
    labString += timestamp.toFixed() + " ";
    timestamp += phonemeLengthSeconds * 1e7; // 100ns単位に変換
    labString += timestamp.toFixed() + " ";
    labString += phoneme + "\n";
  };

  for (const phoneme of phonemes) {
    if (isVowel(phoneme.phoneme) && phoneme.phoneme !== "N") {
      writeLine(phoneme.frameLength / frameRate, phoneme.phoneme.toLowerCase());
    } else {
      writeLine(phoneme.frameLength / frameRate, phoneme.phoneme);
    }
  }

  return await generateTextFileData({ text: labString });
}
