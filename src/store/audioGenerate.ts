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
import { createLogger } from "@/helpers/log";
const log = createLogger("audioGenerate");

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
  // 音声合成対象のエンジン ID と、デフォルトのエンジン ID を取得
  const engineId = audioItem.voice.engineId;
  const defaultEngineId = (() => {
    for (const engineInfo of Object.values(state.engineInfos)) {
      if (engineInfo.isDefault === true) {
        return engineInfo.uuid;
      }
    }
    throw new Error("defaultEngineId is not defined");
  })();

  // AudioQuery に対応する一意の ID と EditorAudioQuery を取得
  // audioItem.query が設定済みの場合のみ、ここで outputSamplingRate, outputStereo, kana が設定される
  const result = await generateUniqueIdAndQuery(state, audioItem);
  let id = result[0];
  const audioQuery = result[1];
  if (audioQuery == undefined)
    throw new Error("audioQuery is not defined for audioItem");

  // 既に音声合成済みの音声データがキャッシュに存在する場合は、それを返す
  if (Object.prototype.hasOwnProperty.call(audioBlobCache, id)) {
    log.info("audioBlobCache hit! cache id: " + id);
    const blob = audioBlobCache[id];
    return { audioQuery, blob };
  }

  // EditorAudioQuery をエンジンの音声合成 API に渡せる AudioQuery に変換
  const engineAudioQuery = convertAudioQueryFromEditorToEngine(
    audioQuery,
    state.engineManifests[engineId].defaultSamplingRate,
  );

  // 音声合成対象の話者スタイル ID を取得
  const speaker = audioItem.voice.styleId;

  // エンジンの音声合成 API を呼び出す
  let blob: Blob;
  const startTime = performance.now() / 1000;  // performance.now() はミリ秒単位なのでミリ秒から秒に変換
  // FIXME: モーフィングが設定で無効化されていてもモーフィングが行われるので気づけるUIを作成する
  if (audioItem.morphingInfo != undefined) {
    if (!isMorphable(state, { audioItem })) throw new NotMorphableError();
    blob = await instance.invoke("synthesisMorphing")({
      audioQuery: engineAudioQuery,
      baseSpeaker: speaker,
      targetSpeaker: audioItem.morphingInfo.targetStyleId,
      morphRate: audioItem.morphingInfo.rate,
    });
  } else {
    blob = await instance.invoke("synthesis")({
      audioQuery: engineAudioQuery,
      speaker,
      enableInterrogativeUpspeak:
        state.experimentalSetting.enableInterrogativeUpspeak,
    });
  }

  // 音声合成にかかった時間を計測
  const synthesisTime = performance.now() / 1000 - startTime;
  log.info(`synthesis completed in ${synthesisTime} seconds.`);

  // 音声合成イベントを GA4 に記録
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

  // AivisSpeech Engine で生成した合成音声のみの特別対応
  // AivisSpeech Engine では、音声合成前の音素発音長の生成が技術的に不可能なため、各 Mora の母音発音長 (vowelLength) と
  // 子音発音長 (consonantLength) が常に 0.0 で返される  しかし、リップシンクロジックの動作のためにはこれらの値が適切に設定されている必要がある
  // そこで、生成された WAV の長さから前後の無音時間を差し引いた時間を全モーラ数で割り、1モーラ分の尺として割り当て AudioQuery に反映する実装とした
  // 変更された AudioQuery は、この関数の呼び出し元である audioStore の FETCH_AUDIO_FROM_AUDIO_ITEM により state に反映される
  // この実装により、AivisSpeech Engine でも VOICEVOX ENGINE と同様に AudioDetail.vue でのリップシンク再生が可能になる
  if (engineId === defaultEngineId) {
    try {
      // Blob を AudioContext でデコードして、WAV の duration (秒) を取得
      const arrayBuffer = await blob.arrayBuffer();
      const audioContext = new AudioContext();
      const decoded = await audioContext.decodeAudioData(arrayBuffer);
      const duration = decoded.duration;

      // 画面上早めにハイライトされるように、少しだけ尺を削るための定数 (magic!)
      // AivisSpeech Engine の実装上正確な音素単位の長さは取得できないためある程度のズレは避けられないが、
      // 視覚的には少し早めに次の音素の再生部分にハイライトされて行った方がストレスがない
      const audioDurationMagicDiff = 0.06;

      // duration は speedScale で速度調整された後の音声長を表す値だが、AudioQuery.accentPhrases 内のモーラの音素発声長は
      // speedScale の影響を受けず、常に等速換算で算出されている
      // この後の処理の互換性を高めるため、speedScale 倍することで等速換算の再生時間に変換してから処理を行う
      // pre/postPhonemeLength の値は speedScale の影響を受けるため、全体を speedScale 倍してしまって問題ない
      const totalDuration = duration * audioQuery.speedScale;

      // effectiveDuration は prePhonemeLength と postPhonemeLength と音声微調整分を除いた再生時間
      // エンジン側で後付けされている前後無音区間は1モーラ分の尺を算出するのに邪魔なので予め取り払っておく
      const effectiveDuration = Math.max(0, totalDuration - audioQuery.prePhonemeLength - audioQuery.postPhonemeLength - audioDurationMagicDiff);
      log.info(`Total duration: ${totalDuration}, Effective duration: ${effectiveDuration}`);

      // 特殊モーラ (pauseMora や句読点) の重み付け定数と、連続句読点の最大数
      const specialMoraWeight = 1.5;  // 特殊モーラ (pauseMora や句読点) の尺を 1.5 倍にする
      const maxConsecutivePunctuations = 2;  // 連続句読点の最大数
      let totalNormalMoras = 0;
      let totalSpecialMoras = 0;
      // 各アクセント句内のモーラ数を、句読点（"." または ","）は最大 maxConsecutivePunctuations まで special として重み付け
      for (const phrase of audioQuery.accentPhrases) {
        let consecutivePunctuations = 0;
        for (const mora of phrase.moras) {
          if (mora.text === "." || mora.text === ",") {
            consecutivePunctuations++;
            if (consecutivePunctuations <= maxConsecutivePunctuations) {
              totalSpecialMoras++;
            }
          } else {
            consecutivePunctuations = 0;
            totalNormalMoras++;
          }
        }
        if (phrase.pauseMora) {
          totalSpecialMoras++;
        }
      }

      // 重み付けを考慮した総モーラ数を計算
      const weightedTotalMoras = totalNormalMoras + (totalSpecialMoras * specialMoraWeight);

      // 1モーラ分の尺 (x1.0 で音声合成した場合) を計算（重み付けを考慮）
      const averageMoraLength = effectiveDuration / weightedTotalMoras;

      // 各 Mora に duration を割り当てる
      for (const phrase of audioQuery.accentPhrases) {
        let consecutivePunctuations = 0;
        for (const mora of phrase.moras) {
          if (mora.text === "." || mora.text === ",") {
            // 句点 (.) または読点 (,) の場合の処理
            // pauseMora だけだと連続する句読点や「.....」「!?!?!?」のような感情表現に対応する音素列を表現できないため、
            // AivisSpeech Engine から返された AudioQuery 上では常に句点は「.」、読点は「,」の通常のモーラとして返される
            consecutivePunctuations++;
            if (consecutivePunctuations <= maxConsecutivePunctuations) {
              // maxConsecutivePunctuations 以内の句読点は、通常のモーラよりも specialMoraWeight 倍の尺を割り当てる
              const moraDuration = averageMoraLength * specialMoraWeight;
              if (mora.consonant != undefined) {
                // 子音が存在する場合のみ、moraDuration の 20% を子音に割り当てる
                mora.consonantLength = moraDuration * 0.2;
                mora.vowelLength = moraDuration * 0.8;
              } else {
                mora.vowelLength = moraDuration;
              }
            } else {
              // maxConsecutivePunctuations を超える回数連続した句読点には尺を一切割り当てない
              // 例えば「。。。。。」と続く文章の場合、実際の発音は「。。」分で終わりなことが多いことを反映している
              if (mora.consonant != undefined) {
                // 子音が存在する場合のみ consonantLength にも 0 を設定する
                mora.consonantLength = 0;
                mora.vowelLength = 0;
              } else {
                mora.vowelLength = 0;
              }
            }
          } else {
            // 通常のモーラの場合
            consecutivePunctuations = 0;
            const moraDuration = averageMoraLength;
            if (mora.consonant != undefined) {
              // 子音が存在する場合のみ、moraDuration の 20% を子音に割り当てる
              mora.consonantLength = moraDuration * 0.2;
              mora.vowelLength = moraDuration * 0.8;
            } else {
              mora.vowelLength = moraDuration;
            }
          }
        }
        if (phrase.pauseMora) {
          // 無音モーラの場合は、句読点の記号モーラと同様に通常のモーラよりも specialMoraWeight 倍の尺を割り当てる
          phrase.pauseMora.consonantLength = 0;
          phrase.pauseMora.vowelLength = averageMoraLength * specialMoraWeight;
        }
      }

      // 上記変更で AudioQuery の内容に対応するユニーク ID も変更されるため、新しいユニーク ID を生成
      // ユニーク ID の生成には audioItem の内容が必要なため、事前に audioItem.query を変更した上で渡す
      audioItem.query = audioQuery;
      id = (await generateUniqueIdAndQuery(state, audioItem))[0];

      log.info("Heuristic duration assignment (for AivisSpeech Engine) completed.");
      console.info("AudioQuery.accentPhrases:", audioQuery.accentPhrases);  // メインプロセスに送るには量が多いのでブラウザコンソールのみに出力
    } catch (error) {
      log.error("Heuristic duration assignment (for AivisSpeech Engine) failed.", error);
    }
  }

  // 音声合成結果をキャッシュに保存
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

/**
 * AudioItem からキャッシュ ID と AudioQuery を生成する。
 * @param state 設定ストアの状態
 * @param audioItem 対象の AudioItem
 * @returns [キャッシュID, AudioQuery | undefined]
 */
export async function generateUniqueIdAndQuery(
  state: SettingStoreState,
  audioItem: AudioItem,
): Promise<[string, EditorAudioQuery | undefined]> {
  // 影響を与えないようにディープコピー
  const copiedAudioItem = JSON.parse(JSON.stringify(audioItem)) as AudioItem;
  const audioQuery = copiedAudioItem.query;
  if (audioQuery != undefined) {
    audioQuery.outputSamplingRate =
      state.engineSettings[copiedAudioItem.voice.engineId].outputSamplingRate;
    audioQuery.outputStereo = state.savingSetting.outputStereo;
    // AivisSpeech では音声合成時に AudioQuery.kana に読み上げテキストを指定する必要がある
    audioQuery.kana = copiedAudioItem.text;
  }

  const id = await generateTempUniqueId([
    copiedAudioItem.text,
    audioQuery,
    copiedAudioItem.voice,
    copiedAudioItem.morphingInfo,
    state.experimentalSetting.enableInterrogativeUpspeak, // このフラグが違うと、同じAudioQueryで違う音声が生成されるので追加
  ]);
  return [id, audioQuery];
}

/**
 * 指定されたキャッシュ ID に対応するキャッシュを削除する。
 * @param id 削除するキャッシュのID
 */
export function clearAudioBlobCache(id: string): void {
  if (Object.prototype.hasOwnProperty.call(audioBlobCache, id)) {
    delete audioBlobCache[id];
    log.info(`Cache cleared for id: ${id}`);
  } else {
    log.info(`Cache not found for id: ${id}, no need to clear.`);
  }
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
