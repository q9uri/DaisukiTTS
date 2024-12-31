import {
  AudioItem,
  AudioStoreState,
  EditorAudioQuery,
  FetchAudioResult,
  IEngineConnectorFactoryActionsMapper,
  SettingStoreState,
} from "./type";
import { convertAudioQueryFromEditorToEngine } from "./proxy";
import { generateTempUniqueId } from "./utility";
import { useAnalytics } from "@/composables/useAnalytics";

const audioBlobCache: Record<string, Blob> = {};

type Instance = {
  invoke: IEngineConnectorFactoryActionsMapper;
};

/**
 * エンジンで音声を合成する。音声のキャッシュ機構も備える。
 */
export async function fetchAudioFromAudioItem(
  state: AudioStoreState & SettingStoreState,
  instance: Instance,
  {
    audioItem,
  }: {
    audioItem: AudioItem;
  },
): Promise<FetchAudioResult> {
  const engineId = audioItem.voice.engineId;

  const [id, audioQuery] = await generateUniqueIdAndQuery(state, audioItem);
  if (audioQuery == undefined)
    throw new Error("audioQuery is not defined for audioItem");

  if (Object.prototype.hasOwnProperty.call(audioBlobCache, id)) {
    const blob = audioBlobCache[id];
    return { audioQuery, blob };
  }

  const speaker = audioItem.voice.styleId;

  const engineAudioQuery = convertAudioQueryFromEditorToEngine(
    audioQuery,
    state.engineManifests[engineId].defaultSamplingRate,
  );

  let blob: Blob;
  // FIXME: モーフィングが設定で無効化されていてもモーフィングが行われるので気づけるUIを作成する
  if (audioItem.morphingInfo != undefined) {
    if (!isMorphable(state, { audioItem })) throw new NotMorphableError();
    blob = await instance.invoke("synthesisMorphingSynthesisMorphingPost")({
      audioQuery: engineAudioQuery,
      baseSpeaker: speaker,
      targetSpeaker: audioItem.morphingInfo.targetStyleId,
      morphRate: audioItem.morphingInfo.rate,
    });
  } else {
    const startTime = performance.now() / 1000;  // ミリ秒から秒に変換
    blob = await instance.invoke("synthesisSynthesisPost")({
      audioQuery: engineAudioQuery,
      speaker,
      enableInterrogativeUpspeak:
        state.experimentalSetting.enableInterrogativeUpspeak,
    });
    const synthesisTime = (performance.now() / 1000) - startTime;
    void useAnalytics().trackEvent("aisp_synthesis", {
      // プライバシーの観点から、テキスト内容は送信しない
      engineId: audioItem.voice.engineId,
      speakerId: audioItem.voice.speakerId,
      styleId: audioItem.voice.styleId,
      speedScale: audioQuery.speedScale,
      intonationScale: audioQuery.intonationScale,
      tempoDynamicsScale: audioQuery.tempoDynamicsScale,
      pitchScale: audioQuery.pitchScale,
      volumeScale: audioQuery.volumeScale,
      prePhonemeLength: audioQuery.prePhonemeLength,
      postPhonemeLength: audioQuery.postPhonemeLength,
      synthesisTime: synthesisTime,
    });
  }
  audioBlobCache[id] = blob;
  return { audioQuery, blob };
}

export async function generateLabFromAudioQuery(
  audioQuery: EditorAudioQuery,
  offset?: number,
) {
  const speedScale = audioQuery.speedScale;

  let labString = "";
  let timestamp = offset ?? 0;

  labString += timestamp.toFixed() + " ";
  timestamp += (audioQuery.prePhonemeLength * 10000000) / speedScale;
  labString += timestamp.toFixed() + " ";
  labString += "pau" + "\n";

  audioQuery.accentPhrases.forEach((accentPhrase) => {
    accentPhrase.moras.forEach((mora) => {
      if (mora.consonantLength != undefined && mora.consonant != undefined) {
        labString += timestamp.toFixed() + " ";
        timestamp += (mora.consonantLength * 10000000) / speedScale;
        labString += timestamp.toFixed() + " ";
        labString += mora.consonant + "\n";
      }
      labString += timestamp.toFixed() + " ";
      timestamp += (mora.vowelLength * 10000000) / speedScale;
      labString += timestamp.toFixed() + " ";
      if (mora.vowel != "N") {
        labString += mora.vowel.toLowerCase() + "\n";
      } else {
        labString += mora.vowel + "\n";
      }
    });
    if (accentPhrase.pauseMora != undefined) {
      labString += timestamp.toFixed() + " ";
      timestamp +=
        (accentPhrase.pauseMora.vowelLength *
          audioQuery.pauseLengthScale *
          10000000) /
        speedScale;
      labString += timestamp.toFixed() + " ";
      labString += accentPhrase.pauseMora.vowel + "\n";
    }
  });

  labString += timestamp.toFixed() + " ";
  timestamp += (audioQuery.postPhonemeLength * 10000000) / speedScale;
  labString += timestamp.toFixed() + " ";
  labString += "pau" + "\n";

  return labString;
}

async function generateUniqueIdAndQuery(
  state: SettingStoreState,
  audioItem: AudioItem,
): Promise<[string, EditorAudioQuery | undefined]> {
  audioItem = JSON.parse(JSON.stringify(audioItem)) as AudioItem;
  const audioQuery = audioItem.query;
  if (audioQuery != undefined) {
    audioQuery.outputSamplingRate =
      state.engineSettings[audioItem.voice.engineId].outputSamplingRate;
    audioQuery.outputStereo = state.savingSetting.outputStereo;
    // AivisSpeech では音声合成時に AudioQuery.kana に読み上げテキストを指定する必要がある
    audioQuery.kana = audioItem.text;
  }

  const id = await generateTempUniqueId([
    audioItem.text,
    audioQuery,
    audioItem.voice,
    audioItem.morphingInfo,
    state.experimentalSetting.enableInterrogativeUpspeak, // このフラグが違うと、同じAudioQueryで違う音声が生成されるので追加
  ]);
  return [id, audioQuery];
}

export function isMorphable(
  state: AudioStoreState,
  {
    audioItem,
  }: {
    audioItem: AudioItem;
  },
) {
  if (audioItem.morphingInfo?.targetStyleId == undefined) return false;
  const { engineId, styleId } = audioItem.voice;
  const info =
    state.morphableTargetsInfo[engineId]?.[styleId]?.[
      audioItem.morphingInfo.targetStyleId
    ];
  if (info == undefined) return false;
  return info.isMorphable;
}

class NotMorphableError extends Error {
  constructor() {
    super("モーフィングの設定が無効です。");
  }
}

export function handlePossiblyNotMorphableError(e: unknown) {
  if (e instanceof NotMorphableError) {
    return e.message;
  } else {
    window.backend.logError(e);
    return;
  }
}
