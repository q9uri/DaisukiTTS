/**
 * 日本語のひらがなやカタカナなどを扱う
 */

import { UserDictWord, WordTypes } from "@/openapi";


/** 読み仮名を検出するための正規表現を生成する */
export const createKanaRegex = (includeSeparation?: boolean): RegExp => {
  // 以下の文字のみで構成される場合、「読み仮名」としてこれを処理する
  // includeSeparationがtrueの時は、読点(U+3001)とクエスチョン(U+FF1F)も含む
  //  * ひらがな(U+3041~U+3094)
  //  * カタカナ(U+30A1~U+30F4)
  //  * 全角長音(U+30FC)
  if (includeSeparation) {
    return /^[\u3041-\u3094\u30A1-\u30F4\u30FC\u3001\uFF1F]+$/;
  }
  return /^[\u3041-\u3094\u30A1-\u30F4\u30FC]+$/;
};

/** 半角文字を全角文字に変換する */
export const convertHankakuToZenkaku = (text: string): string => {
  // " "などの目に見えない文字をまとめて全角スペース(0x3000)に置き換える
  text = text.replace(/\p{Z}/gu, () => String.fromCharCode(0x3000));

  // "!"から"~"までの範囲の文字(数字やアルファベット)を全角に置き換える
  return text.replace(/[\u0021-\u007e]/g, (s) => {
    return String.fromCharCode(s.charCodeAt(0) + 0xfee0);
  });
};

/** ひらがなをカタカナにする */
export const convertHiraToKana = (text: string): string => {
  return text.replace(/[\u3041-\u3094]/g, (s) => {
    return String.fromCharCode(s.charCodeAt(0) + 0x60);
  });
};

/** ひらがなやカタカナに含まれる長音を母音に変換する */
export const convertLongVowel = (text: string): string => {
  return text
    .replace(/(?<=[アカサタナハマヤラワャァガザダバパ]ー*)ー/g, "ア")
    .replace(/(?<=[イキシチニヒミリィギジヂビピ]ー*)ー/g, "イ")
    .replace(/(?<=[ウクスツヌフムユルュゥヴグズヅブプ]ー*)ー/g, "ウ")
    .replace(/(?<=[エケセテネヘメレェゲゼデベペ]ー*)ー/g, "エ")
    .replace(/(?<=[オコソトノホモヨロヲョォゴゾドボポ]ー*)ー/g, "オ")
    .replace(/(?<=[ン]ー*)ー/g, "ン")
    .replace(/(?<=[ッ]ー*)ー/g, "ッ")
    .replace(/(?<=[あかさたなはまやらわゃぁがざだばぱ]ー*)ー/g, "あ")
    .replace(/(?<=[いきしちにひみりぃぎじぢびぴ]ー*)ー/g, "い")
    .replace(/(?<=[うくすつぬふむゆるゅぅぐずづぶぷ]ー*)ー/g, "う")
    .replace(/(?<=[えけせてねへめれぇげぜでべぺ]ー*)ー/g, "え")
    .replace(/(?<=[おこそとのほもよろをょぉごぞどぼぽ]ー*)ー/g, "お")
    .replace(/(?<=[ん]ー*)ー/g, "ん")
    .replace(/(?<=[っ]ー*)ー/g, "っ");
};

// 参考：https://github.com/VOICEVOX/voicevox_core/blob/0848630d81ae3e917c6ff2038f0b15bbd4270702/crates/voicevox_core/src/user_dict/word.rs#L83-L90
export const moraPattern = new RegExp(
  "(?:" +
    "[イ][ェ]|[ヴ][ャュョ]|[ウクグトド][ゥ]|[テデ][ィェャュョ]|[クグ][ヮ]|" + // rule_others
    "[キシチニヒミリギジヂビピ][ェャュョ]|[キニヒミリギビピ][ィ]|" + // rule_line_i
    "[クツフヴグ][ァ]|[ウクスツフヴグズ][ィ]|[ウクツフヴグ][ェォ]|" + // rule_line_u
    "[ァ-ヴー]|" + // rule_one_mora
    "[い][ぇ]|[ゔ][ゃゅょ]|[うくぐとど][ぅ]|[てで][ぃぇゃゅょ]|[くぐ][ゎ]|" + // rule_others
    "[きしちにひみりぎじぢびぴ][ぇゃゅょ]|[きにひみりぎびぴ][ぃ]|" + // rule_line_i
    "[くつふゔぐ][ぁ]|[うくすつふゔぐず][ぃ]|[うくつふゔぐ][ぇぉ]|" + // rule_line_u
    "[ぁ-ゔー]" + // rule_one_mora
    ")",
  "g",
);

/** 品詞フィールドから WordTypes を推定する */
export const getWordTypeFromPartOfSpeech = (dictData: UserDictWord | undefined): WordTypes => {
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

// 品詞ラベルの定義
export const wordTypeLabels = {
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
