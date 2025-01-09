import { createPartialStore } from "./vuex";
import { UserDictWord, UserDictWordToJSON } from "@/openapi";
import { DictionaryStoreState, DictionaryStoreTypes } from "@/store/type";

export const dictionaryStoreState: DictionaryStoreState = {};

export const dictionaryStore = createPartialStore<DictionaryStoreTypes>({
  LOAD_USER_DICT: {
    async action({ actions }, { engineId }) {
      const engineDict = await actions
        .INSTANTIATE_ENGINE_CONNECTOR({
          engineId,
        })
        .then((instance) => instance.invoke("getUserDictWordsUserDictGet")({}));

      // 50音順にソートするために、一旦arrayにする
      const dictArray = Object.keys(engineDict).map((k) => {
        return { key: k, ...engineDict[k] };
      });
      dictArray.sort((a, b) => {
        if (a.yomi > b.yomi) {
          return 1;
        } else {
          return -1;
        }
      });
      const dictEntries: [string, UserDictWord][] = dictArray.map((v) => {
        const { key, ...newV } = v;
        return [key, newV];
      });
      return Object.fromEntries(dictEntries);
    },
  },

  LOAD_ALL_USER_DICT: {
    async action({ actions, getters }) {
      // 事前にソート済みのエンジンの ID リストを取得する (AivisSpeech Engine が常に先頭に来るようにする)
      const engineIds = getters.GET_SORTED_ENGINE_INFOS.map((engine) => engine.uuid);
      const defaultEngineId = getters.DEFAULT_ENGINE_ID;
      const allDict = await Promise.all(
        engineIds.map((engineId) => {
          return actions.LOAD_USER_DICT({ engineId });
        }),
      );

      // デフォルトエンジンの辞書をベースにする
      const defaultEngineIndex = engineIds.indexOf(defaultEngineId);
      if (defaultEngineIndex === -1) {
        throw new Error("Default engine not found");
      }
      const defaultDict = allDict[defaultEngineIndex];
      const mergedDictMap = new Map<string, [string, UserDictWord]>();
      const usedPairs = new Set<string>();  // 使用済みの読み-表層形ペアを記録

      // まずデフォルトエンジンの辞書をすべて登録
      for (const [id, dictItem] of Object.entries(defaultDict)) {
        const pairKey = `${dictItem.yomi}-${dictItem.surface}`;
        mergedDictMap.set(id, [id, dictItem]);
        usedPairs.add(pairKey);
      }

      // 追加エンジンからは新規項目のみを追加
      // 厳密な双方向同期は最終更新タイムスタンプなどのフィールドがない以上実装不可能ため、
      // 同じ項目があって値だけ追加エンジン側で異なる場合は、常にデフォルトエンジンの値を優先する仕様とした
      for (let i = 0; i < allDict.length; i++) {
        if (i === defaultEngineIndex) continue;  // デフォルトエンジンはスキップ
        const dict = allDict[i];
        for (const [id, dictItem] of Object.entries(dict)) {
          const pairKey = `${dictItem.yomi}-${dictItem.surface}`;
          // 既存のエントリがない場合のみ追加（新規項目）
          // ただし、その読み-表層形ペアが既に使用されている場合は追加しない
          if (!mergedDictMap.has(id) && !usedPairs.has(pairKey)) {
            mergedDictMap.set(id, [id, dictItem]);
            usedPairs.add(pairKey);
          }
        }
      }

      // 50音順でソート
      const mergedDict = [...mergedDictMap.values()];
      mergedDict.sort((a, b) => {
        if (a[1].yomi > b[1].yomi) {
          return 1;
        } else {
          return -1;
        }
      });
      return Object.fromEntries(mergedDict);
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
          return await instance.invoke("addUserDictWordUserDictWordPost")({
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

  REWRITE_WORD: {
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
          instance.invoke("rewriteUserDictWordUserDictWordWordUuidPut")({
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
      for (const engineId of state.engineIds) {
        await actions
          .INSTANTIATE_ENGINE_CONNECTOR({
            engineId,
          })
          .then((instance) =>
            instance.invoke("deleteUserDictWordUserDictWordWordUuidDelete")({
              wordUuid,
            }),
          );
      }
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
      const mergedDict = await actions.LOAD_ALL_USER_DICT();

      // マージした辞書を各エンジンにインポートする
      for (const engineId of engineIds) {
        // エンジンの辞書の ID リストを取得する
        const dictIdSet = await actions
          .INSTANTIATE_ENGINE_CONNECTOR({
            engineId,
          })
          .then(
            async (instance) =>
              new Set(
                Object.keys(
                  await instance.invoke("getUserDictWordsUserDictGet")({}),
                ),
              ),
          );
        // if (Object.keys(mergedDict).some((id) => !dictIdSet.has(id))) {
        await actions
          .INSTANTIATE_ENGINE_CONNECTOR({
            engineId,
          })
          .then((instance) =>
            // マージした辞書をエンジンにインポートする。
            instance.invoke("importUserDictWordsImportUserDictPost")({
              override: true,
              requestBody: Object.fromEntries(
                Object.entries(mergedDict).map(([k, v]) => [
                  k,
                  (() => {
                    // AivisSpeech Engine の場合はそのままインポートする
                    if (engineId === defaultEngineId) {
                      return UserDictWordToJSON(v) as { [key: string]: string };
                    }
                    // (API 互換性対策) AivisSpeech Engine 以外のエンジンへのインポートで、かつ固有名詞の場合は、
                    // context_id: 1348 、partOfSpeechDetail1: "固有名詞" に、partOfSpeechDetail2: "一般" 、partOfSpeechDetail3: "*" に固定する
                    if (v.partOfSpeech !== "名詞" || v.partOfSpeechDetail1 !== "固有名詞") {
                      return UserDictWordToJSON(v) as { [key: string]: string };  // 固有名詞でない場合はそのままインポートする
                    }
                    return UserDictWordToJSON({
                      ...v,
                      contextId: 1348,  // 名詞,固有名詞,一般,* の OpenJTalk 上での文脈 ID
                      partOfSpeechDetail1: "固有名詞",
                      partOfSpeechDetail2: "一般",
                      partOfSpeechDetail3: "*",
                    }) as { [key: string]: string };
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
        const removedDictIdSet = new Set(dictIdSet);
        // マージされた辞書にあるIDを削除する。
        // これにより、マージ処理で削除された項目のIDが残る。
        for (const id of Object.keys(mergedDict)) {
          if (removedDictIdSet.has(id)) {
            removedDictIdSet.delete(id);
          }
        }

        await actions
          .INSTANTIATE_ENGINE_CONNECTOR({ engineId })
          .then((instance) => {
            // マージ処理で削除された項目をエンジンから削除する。
            void Promise.all(
              [...removedDictIdSet].map((id) =>
                instance.invoke("deleteUserDictWordUserDictWordWordUuidDelete")(
                  {
                    wordUuid: id,
                  },
                ),
              ),
            );
          });
      }
    },
  },
});
