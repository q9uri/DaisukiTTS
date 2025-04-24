import { createPartialStore } from "./vuex";
import { getWordTypeFromPartOfSpeech } from "@/domain/japanese";
import { UserDictWord, UserDictWordForCompat, UserDictWordToJSON, UserDictWordForCompatToJSON, WordTypes } from "@/openapi";
import { DictionaryStoreState, DictionaryStoreTypes } from "@/store/type";

export const dictionaryStoreState: DictionaryStoreState = {};

export const dictionaryStore = createPartialStore<DictionaryStoreTypes>({
  LOAD_USER_DICT: {
    async action({ actions, getters }, { engineId }) {
      const defaultEngineId = getters.DEFAULT_ENGINE_ID;
      const engineUserDict = (await actions
        .INSTANTIATE_ENGINE_CONNECTOR({
          engineId,
        })
        .then(async (instance) => {
          const userDict = await instance.invoke("getUserDictWords")({
            // enableCompoundAccent: true を指定すると、UserDictWord の
            // stem, yomi, pronunciation, accentType, moraCount が配列で返ってくる
            // enableCompoundAccent は今の所 AivisSpeech Engine 以外では対応していないため、
            // 他のエンジンでは常に false を指定する
            enableCompoundAccent: engineId === defaultEngineId,
          });
          // デフォルトエンジン (AivisSpeech Engine) 以外のエンジンでは、
          // UserDictWordForCompat 型から UserDictWord 型に変換する
          if (engineId !== defaultEngineId) {
            return Object.fromEntries(
              Object.entries(userDict as { [key: string]: UserDictWordForCompat }).map(([key, word]) => {
                // 文字列のフィールドを配列に変換
                return [
                  key,
                  {
                    ...word,
                    stem: [word.stem],
                    yomi: [word.yomi],
                    pronunciation: [word.pronunciation],
                    accentType: [word.accentType],
                    moraCount: word.moraCount != undefined ? [word.moraCount] : undefined,
                  } as UserDictWord,
                ];
              }),
              );
          }
          return userDict;
        })) as { [key: string]: UserDictWord };

      // 50音順にソートするために、一旦arrayにする
      const userDictArray = Object.keys(engineUserDict).map((k) => {
        return { key: k, ...engineUserDict[k] };
      });
      userDictArray.sort((a, b) => {
        // 発音表記の50音順でソート
        if (a.pronunciation.join("") > b.pronunciation.join("")) {
          return 1;
        } else {
          return -1;
        }
      });
      const userDictEntries: [string, UserDictWord][] = userDictArray.map((v) => {
        const { key, ...newV } = v;
        return [key, newV];
      });
      return Object.fromEntries(userDictEntries);
    },
  },

  LOAD_ALL_USER_DICT: {
    async action({ actions, getters }) {
      // 事前にソート済みのエンジンの ID リストを取得する (AivisSpeech Engine が常に先頭に来るようにする)
      const engineIds = getters.GET_SORTED_ENGINE_INFOS.map((engine) => engine.uuid);
      const defaultEngineId = getters.DEFAULT_ENGINE_ID;
      const allUserDict = await Promise.all(
        engineIds.map((engineId) => {
          return actions.LOAD_USER_DICT({ engineId });
        }),
      );

      // デフォルトエンジンの辞書をベースにする
      const defaultEngineIndex = engineIds.indexOf(defaultEngineId);
      if (defaultEngineIndex === -1) {
        throw new Error("Default engine not found");
      }
      const defaultUserDict = allUserDict[defaultEngineIndex];
      const mergedUserDictMap = new Map<string, [string, UserDictWord]>();
      const usedPairs = new Set<string>();  // 使用済みの読み-表層形ペアを記録

      // まずデフォルトエンジンの辞書をすべて登録
      for (const [id, dictItem] of Object.entries(defaultUserDict)) {
        // キーは 表層形-原型-読み(発音表記) のペアとする
        const pairKey = `${dictItem.surface}-${dictItem.stem.join("")}-${dictItem.pronunciation.join("")}`;
        mergedUserDictMap.set(id, [id, dictItem]);
        usedPairs.add(pairKey);
      }

      // 追加エンジンからは新規項目のみを追加
      // 厳密な双方向同期は最終更新タイムスタンプなどのフィールドがない以上実装不可能ため、
      // 同じ項目があって値だけ追加エンジン側で異なる場合は、常にデフォルトエンジンの値を優先する仕様とした
      for (let i = 0; i < allUserDict.length; i++) {
        if (i === defaultEngineIndex) continue;  // デフォルトエンジンはスキップ
        const dict = allUserDict[i];
        for (const [id, dictItem] of Object.entries(dict)) {
          // キーは 表層形-原型-読み(発音表記) のペアとする
          const pairKey = `${dictItem.surface}-${dictItem.stem.join("")}-${dictItem.pronunciation.join("")}`;
          // 既存の項目がない場合のみ追加（新規項目）
          // ただし、その 読み(発音表記)-表層形 のペアが既に使用されている場合は追加しない
          if (!mergedUserDictMap.has(id) && !usedPairs.has(pairKey)) {
            mergedUserDictMap.set(id, [id, dictItem]);
            usedPairs.add(pairKey);
          }
        }
      }

      // 50音順でソート
      const mergedUserDict = [...mergedUserDictMap.values()];
      mergedUserDict.sort((a, b) => {
        if (a[1].pronunciation.join("") > b[1].pronunciation.join("")) {
          return 1;
        } else {
          return -1;
        }
      });
      return Object.fromEntries(mergedUserDict);
    },
  },

  ADD_WORD: {
    async action(
      { actions, getters },
      { surface, pronunciation, accentType, wordType, priority },
    ) {
      // 同じ単語 ID で登録するために、まずデフォルトエンジン (AivisSpeech Engine) に追加したあと、他の全エンジンに同期する
      const defaultEngineId = getters.DEFAULT_ENGINE_ID;
      const wordUuid = await actions
        .INSTANTIATE_ENGINE_CONNECTOR({
          engineId: defaultEngineId,
        })
        .then(async (instance) => {
          return await instance.invoke("addUserDictWord")({
            surface,
            pronunciation,
            accentType,
            wordType,
            priority,
          });
        });

      // 変更を他の全エンジンに同期する
      await actions.SYNC_ALL_USER_DICT();

      return wordUuid;
    },
  },

  UPDATE_WORD: {
    async action(
      { state, actions, getters },
      { wordUuid, surface, pronunciation, accentType, wordType, priority },
    ) {
      if (state.engineIds.length === 0)
        throw new Error("At least one engine must be registered");

      // 実装のシンプル化のため、まずデフォルトエンジン (AivisSpeech Engine) で更新したあと、他の全エンジンに同期する
      const defaultEngineId = getters.DEFAULT_ENGINE_ID;
      await actions
        .INSTANTIATE_ENGINE_CONNECTOR({
          engineId: defaultEngineId,
        })
        .then((instance) =>
          instance.invoke("updateUserDictWord")({
            wordUuid,
            surface,
            pronunciation,
            accentType,
            wordType,
            priority,
          }),
        );

      // 変更を他の全エンジンに同期する
      await actions.SYNC_ALL_USER_DICT();
    },
  },

  DELETE_WORD: {
    async action({ state, actions }, { wordUuid }) {
      if (state.engineIds.length === 0)
        throw new Error("At least one engine must be registered");
      // すべてのエンジンから指定された単語 ID の項目を削除する
      for (const engineId of state.engineIds) {
        await actions
          .INSTANTIATE_ENGINE_CONNECTOR({
            engineId,
          })
          .then((instance) =>
            instance.invoke("deleteUserDictWord")({
              wordUuid,
            }),
          );
      }
    },
  },

  IMPORT_USER_DICT: {
    async action({ actions, getters }, { importedDict }) {
      const defaultEngineId = getters.DEFAULT_ENGINE_ID;
      // まずデフォルトエンジン (AivisSpeech Engine) にインポートする
      await actions.INSTANTIATE_ENGINE_CONNECTOR({
        engineId: defaultEngineId,
      }).then((instance) =>
        instance.invoke("importUserDictWords")({
          override: true,
          requestBody: Object.fromEntries(
            Object.entries(importedDict).map(([k, v]) => [
              k,
              (() => {
                // UserDictWord 型を JSON に変換してからリクエスト
                return UserDictWordToJSON(v) as { [key: string]: string };
                // 通常は OpenAPI クライアント側で camelCase から snake_case に変換されるはずだが、
                // この API の requestBody ではなぜかその変換が行われないため、手動で snake_case に変換している
                // これにより型が合わなくなるため、やむを得ず any を付与している
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
              })() as any,
            ]),
          ),
        }),
      );
      // 変更を他の全エンジンに同期する
      await actions.SYNC_ALL_USER_DICT();
    },
  },

  SYNC_ALL_USER_DICT: {
    async action({ actions, getters }) {
      const defaultEngineId = getters.DEFAULT_ENGINE_ID;
      // 事前にソート済みのエンジンの ID リストを取得する (AivisSpeech Engine が常に先頭に来るようにする)
      const engineIds = getters.GET_SORTED_ENGINE_INFOS.map((engine) => engine.uuid);
      // エンジン ID が1個のみ (= AivisSpeech Engine のみの場合) は何もしない
      if (engineIds.length === 1) return;

      // 全エンジンの現在のユーザー辞書をマージする
      const mergedUserDict = await actions.LOAD_ALL_USER_DICT();

      // マージした辞書を各エンジンにインポートする
      for (const engineId of engineIds) {

        // 各エンジンが現在保持している辞書の単語 ID リストを取得する
        const userDictWordIdSet = await actions
          .INSTANTIATE_ENGINE_CONNECTOR({
            engineId,
          })
          .then(
            async (instance) =>
              new Set(
                Object.keys(await instance.invoke("getUserDictWords")({})),
              ),
          );

        // if (Object.keys(mergedDict).some((id) => !dictIdSet.has(id))) {
        await actions
          .INSTANTIATE_ENGINE_CONNECTOR({
            engineId,
          })
          .then((instance) =>
            // マージした辞書をエンジンにインポートする。
            instance.invoke("importUserDictWords")({
              override: true,
              requestBody: Object.fromEntries(
                Object.entries(mergedUserDict).map(([k, v]) => [
                  k,
                  (() => {
                    // デフォルトエンジン (AivisSpeech Engine) の場合は UserDictWord 型のままインポートする
                    if (engineId === defaultEngineId) {
                      // UserDictWord 型を JSON に変換してからリクエスト
                      return UserDictWordToJSON(v) as { [key: string]: string };
                    }

                    // AivisSpeech Engine 以外のエンジンへは UserDictWord 型から UserDictWordForCompat 型への変換が必要
                    // API 互換性のため、配列型のフィールドを文字列・数値に変換する
                    // このロジックは AivisSpeech Engine 側の UserDictWord 型から UserDictWordForCompat 型への変換ロジックと同じ
                    const compatWord: UserDictWordForCompat = {
                      ...v,
                      // accentType を除く string[] は全て区切り文字なしで join
                      stem: v.stem.join(""),
                      yomi: v.yomi.join(""),
                      pronunciation: v.pronunciation.join(""),
                      // accentType は [0] を採用
                      accentType: v.accentType[0],
                      // moraCount は合算（存在する場合のみ）
                      moraCount: v.moraCount ? v.moraCount.reduce((sum, count) => sum + count, 0) : undefined,
                    };

                    // 品詞フィールドから WordTypes を推定する
                    const wordType = getWordTypeFromPartOfSpeech(v);
                    const needFixWordType: WordTypes[] = [
                      WordTypes.LocationName,
                      WordTypes.OrganizationName,
                      WordTypes.PersonName,
                      WordTypes.PersonFamilyName,
                      WordTypes.PersonGivenName,
                    ];
                    // 一部の WordTypes の値は AivisSpeech Engine 以外では対応していない
                    // API 互換性のため、対象の WordTypes だった場合固有名詞に固定する
                    if (needFixWordType.includes(wordType)) {
                      compatWord.contextId = 1348;  // 名詞,固有名詞,一般,* の OpenJTalk 上での文脈 ID
                      compatWord.partOfSpeechDetail1 = "固有名詞";
                      compatWord.partOfSpeechDetail2 = "一般";
                      compatWord.partOfSpeechDetail3 = "*";
                    }

                    // UserDictWordForCompat 型を JSON に変換してからリクエスト
                    return UserDictWordForCompatToJSON(compatWord) as { [key: string]: string };
                  // 通常は OpenAPI クライアント側で camelCase から snake_case に変換されるはずだが、
                  // この API の requestBody ではなぜかその変換が行われないため、手動で snake_case に変換している
                  // これにより型が合わなくなるため、やむを得ず any を付与している
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  })() as any,
                ]),
              ),
            }),
        );
        // }

        // マージされた辞書に存在する単語 ID を削除する
        // これにより、マージ処理により削除された項目の単語 ID が残る
        const removedUserDictWordIdSet = new Set(userDictWordIdSet);
        for (const id of Object.keys(mergedUserDict)) {
          if (removedUserDictWordIdSet.has(id)) {
            removedUserDictWordIdSet.delete(id);
          }
        }

        await actions
          .INSTANTIATE_ENGINE_CONNECTOR({ engineId })
          .then((instance) => {
            // マージ処理により削除された項目をエンジンから削除する
            void Promise.all(
              [...removedUserDictWordIdSet].map((id) =>
                instance.invoke("deleteUserDictWord")({
                  wordUuid: id,
                }),
              ),
            );
          });
      }
    },
  },
});
