<template>
  <QDialog
    v-model="dialogOpened"
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
              :disabled="isAddingEngine || uiLocked"
              @click="toDialogClosedState"
            />
            <QToolbarTitle class="text-display">
              音声合成エンジンの管理
            </QToolbarTitle>
            <QBtn
              outline
              icon="sym_r_add"
              label="追加"
              textColor="display"
              class="text-bold"
              :disable="uiLocked"
              @click="toAddEngineState"
            />
          </QToolbar>
        </QHeader>
        <QPage class="row">
          <div v-if="uiLockedState" class="ui-lock-popup">
            <div>
              <QSpinner color="primary" size="2.5rem" />
              <div style="margin-top: 12px">
                <template v-if="uiLockedState === 'addingEngine'">
                  音声合成エンジンを追加しています...
                </template>
                <template v-if="uiLockedState === 'deletingEngine'">
                  音声合成エンジンを削除しています...
                </template>
              </div>
            </div>
          </div>
          <div class="col-4 engine-list-col">
            <div
              v-if="isAddingEngine"
              class="engine-list-disable-overlay"
              @click="toInitialState"
            ></div>
            <QList class="engine-list">
              <template
                v-for="([type, engineIds], i) in Object.entries(
                  categorizedEngineIds,
                )"
                :key="`engine-list-${i}`"
              >
                <QSeparator v-if="i > 0" spaced />
                <QItemLabel header> {{ getEngineTypeName(type) }}</QItemLabel>
                <QItem
                  v-for="id in engineIds"
                  :key="id"
                  v-ripple
                  tag="label"
                  clickable
                  :active="selectedId === id"
                  activeClass="active-engine"
                  @click="selectEngine(id)"
                >
                  <QItemSection avatar>
                    <QAvatar rounded color="primary">
                      <img
                        v-if="engineIcons[id]"
                        :src="engineIcons[id]"
                        :alt="engineInfos[id].name"
                      />
                      <span v-else class="text-display-on-primary"> ? </span>
                    </QAvatar>
                  </QItemSection>
                  <QItemSection>
                    <QItemLabel class="text-display">{{
                      engineInfos[id].name
                    }}</QItemLabel>
                    <QItemLabel caption class="engine-path">{{
                      engineManifests[id] != undefined
                        ? engineManifests[id].brandName
                        : engineInfos[id].uuid
                    }}</QItemLabel>
                  </QItemSection>
                </QItem>
              </template>
            </QList>
          </div>

          <!-- 右側のpane -->
          <template v-if="isAddingEngine">
            <div class="col-8 no-wrap text-no-wrap">
              <div class="q-px-lg q-pt-lg column" style="width: 100%; height: 100%; padding-bottom: 14px;">
                <div class="text-h5">音声合成エンジンの追加</div>

                <div class="q-mt-lg">
                  <QBtnToggle
                    v-model="engineLoaderType"
                    :options="[
                      { value: 'vvpp', label: 'VVPP ファイル' },
                      { value: 'dir', label: '既存エンジン' },
                    ]"
                    color="surface"
                    unelevated
                    textColor="display"
                    toggleColor="primary"
                    toggleTextColor="display-on-primary"
                  />
                </div>

                <div class="q-mt-lg">
                  {{ engineLoaderType === 'vvpp' ? 'VVPP ファイルで音声合成エンジンをインストールします。' : 'PC 内にある音声合成エンジンを追加します。' }}
                </div>

                <div class="q-mt-md">
                  <QInput
                    v-if="engineLoaderType === 'vvpp'"
                    ref="vvppFilePathInput"
                    v-model="vvppFilePath"
                    label="VVPP ファイル (.vvpp) を選択"
                    dense
                    readonly
                    @click="selectVvppFile"
                  >
                    <template #append>
                      <QBtn
                        square
                        dense
                        flat
                        color="primary"
                        icon="sym_r_folder_open"
                        @click="selectVvppFile"
                      >
                        <QTooltip :delay="150" anchor="bottom left">
                          ファイル選択
                        </QTooltip>
                      </QBtn>
                    </template>
                  </QInput>
                  <QInput
                    v-else
                    ref="newEngineDirInput"
                    v-model="newEngineDir"
                    label="音声合成エンジンフォルダの場所"
                    dense
                    readonly
                    :error="
                      newEngineDirValidationState != undefined &&
                      newEngineDirValidationState !== 'ok'
                    "
                    @click="selectEngineDir"
                  >
                    <template #append>
                      <QBtn
                        square
                        dense
                        flat
                        color="primary"
                        icon="sym_r_folder_open"
                        @click="selectEngineDir"
                      >
                        <QTooltip :delay="150" anchor="bottom left">
                          フォルダ選択
                        </QTooltip>
                      </QBtn>
                    </template>
                    <template #error>
                      {{
                        newEngineDirValidationState
                          ? getEngineDirValidationMessage(
                              newEngineDirValidationState,
                            )
                          : undefined
                      }}
                    </template>
                  </QInput>
                </div>

                <div class="row q-mt-auto">
                  <QSpace />
                  <QBtn
                    outline
                    icon="sym_r_close"
                    label="キャンセル"
                    textColor="display"
                    class="text-no-wrap text-bold q-mr-sm"
                    @click="toInitialState"
                  />
                  <QBtn
                    outline
                    icon="sym_r_add"
                    label="追加"
                    textColor="primary"
                    class="text-no-wrap text-bold"
                    :disabled="!canAddEngine"
                    @click="addEngine"
                  />
                </div>
              </div>
            </div>
          </template>
          <div
            v-else-if="selectedId"
            class="col-8 no-wrap text-no-wrap engine-detail"
          >
            <div class="model-detail-content">
              <div class="q-px-md q-mt-md flex">
                <img
                  v-if="selectedId in engineIcons"
                  :src="engineIcons[selectedId]"
                  :alt="engineInfos[selectedId].name"
                  class="engine-icon"
                />
                <div v-else class="q-mt-sm inline-block">
                  <QAvatar rounded color="primary" size="2rem">
                    <span class="text-display-on-primary"> ? </span>
                  </QAvatar>
                </div>
                <div class="text-h5 q-ma-sm">
                  {{ engineInfos[selectedId].name }}
                </div>
              </div>

              <div class="no-wrap q-px-md">
                <ul>
                  <li>
                    バージョン：{{
                      engineVersions[selectedId]
                        ? engineVersions[selectedId]
                        : "（取得に失敗しました）"
                    }}
                  </li>
                  <li>
                    URL：
                    <a
                      v-if="engineManifests[selectedId]"
                      :href="engineManifests[selectedId].url"
                      class="text-display-hyperlink"
                      target="_blank"
                      >{{ engineManifests[selectedId].url }}</a
                    >
                    <span v-else>（取得に失敗しました）</span>
                  </li>
                </ul>
              </div>
              <div class="no-wrap q-px-md">
                <div class="text-h6 q-mx-sm q-mt-sm">機能</div>
                <ul
                  v-if="
                    engineManifests[selectedId] &&
                    engineManifests[selectedId].supportedFeatures
                  "
                  class="q-mt-sm"
                >
                  <template
                    v-for="(value, feature) in engineManifests[selectedId]
                      .supportedFeatures != null
                      ? engineManifests[selectedId].supportedFeatures
                      : null"
                    :key="feature"
                  >
                    <li
                      v-if="feature != 'manageLibrary'"
                      :class="value ? '' : 'text-warning'"
                    >
                      {{ getFeatureName(feature) }}：{{
                        value ? "対応" : "非対応"
                      }}
                    </li>
                  </template>
                </ul>
                <span v-else>（取得に失敗しました）</span>
              </div>
              <div class="no-wrap q-px-md">
                <div class="text-h6 q-mx-sm q-mt-sm">場所</div>
                <div
                  :class="
                    'q-mx-sm q-mt-sm q-mb-md' + (engineInfos[selectedId].path ? '' : ' disabled')
                  "
                >
                  <QInput
                    ref="pathInput"
                    v-model="engineDir"
                    disabled
                    dense
                    readonly
                  />
                </div>
              </div>
            </div>
            <div class="fixed-bottom-buttons">
              <QSpace />

              <QBtn
                outline
                icon="sym_r_delete"
                label="削除"
                textColor="warning"
                class="text-no-wrap text-bold q-mr-sm"
                :disable="
                  uiLocked || engineInfos[selectedId].isDefault
                "
                @click="deleteEngine"
              />
              <QBtn
                outline
                icon="sym_r_folder_open"
                label="フォルダを開く"
                textColor="display"
                class="text-no-wrap text-bold q-mr-sm"
                :disable="uiLocked || !engineInfos[selectedId].path"
                @click="openSelectedEngineDirectory"
              />
              <QBtn
                outline
                icon="sym_r_restart_alt"
                label="再起動"
                textColor="display"
                class="text-no-wrap text-bold q-mr-sm"
                :disable="uiLocked || engineStates[selectedId] === 'STARTING'"
                @click="restartSelectedEngine"
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
import { useStore } from "@/store";
import { EngineDirValidationResult, EngineId } from "@/type/preload";
import type { SupportedFeatures } from "@/openapi/models/SupportedFeatures";
import { useEngineIcons } from "@/composables/useEngineIcons";

type EngineLoaderType = "dir" | "vvpp";

const dialogOpened = defineModel<boolean>("dialogOpened");

const store = useStore();

const uiLockedState = ref<null | "addingEngine" | "deletingEngine">(null); // ダイアログ内でstore.getters.UI_LOCKEDは常にtrueなので独自に管理
const uiLocked = computed(() => uiLockedState.value != null);
const isAddingEngine = ref(false);
const engineLoaderType = ref<EngineLoaderType>("vvpp");

const lockUi = function <T>(
  lockType: "addingEngine" | "deletingEngine",
  action: Promise<T>,
): Promise<T> {
  uiLockedState.value = lockType;
  return action.finally(() => {
    uiLockedState.value = null;
  });
};

const categorizedEngineIds = computed(() => {
  const sortedEngineInfos = store.getters.GET_SORTED_ENGINE_INFOS;
  const result = {
    default: Object.values(sortedEngineInfos)
      .filter((info) => info.isDefault)
      .map((info) => info.uuid),
    plugin: Object.values(sortedEngineInfos)
      .filter((info) => !info.isDefault)
      .map((info) => info.uuid),
  };
  return Object.fromEntries(
    Object.entries(result).filter(([, ids]) => ids.length > 0),
  );
});
const engineInfos = computed(() => store.state.engineInfos);
const engineStates = computed(() => store.state.engineStates);

const engineIcons = useEngineIcons(() => store.state.engineManifests);
const engineManifests = computed(() => store.state.engineManifests);
const engineVersions = ref<Record<EngineId, string>>({});

watch(
  [engineInfos, engineStates, engineManifests],
  async () => {
    // FIXME: engineInfosをMapにする
    for (const idStr of Object.keys(engineInfos.value)) {
      const id = EngineId(idStr);
      if (engineStates.value[id] !== "READY") continue;
      if (engineVersions.value[id]) continue;
      const version = await store.actions
        .INSTANTIATE_ENGINE_CONNECTOR({ engineId: id })
        .then((instance) => instance.invoke("version")({}))
        .then((version) => {
          // OpenAPIのバグで"latest"のようにダブルクォーテーションで囲まれていることがあるので外す
          if (version.startsWith('"') && version.endsWith('"')) {
            return version.slice(1, -1);
          }
          return version;
        })
        .catch(() => null);
      if (!version) continue;
      engineVersions.value = {
        ...engineVersions.value,
        [id]: version,
      };
    }
  },
  { immediate: true },
);

const selectedId = ref<EngineId | undefined>(undefined);

const engineDir = computed(() => {
  if (selectedId.value == undefined) throw new Error("engine is not selected");
  return engineInfos.value[selectedId.value]?.path || "（組み込み）";
});

const getEngineTypeName = (name: string) => {
  const engineTypeMap = {
    default: "デフォルトエンジン",
    plugin: "追加エンジン",
  };
  return engineTypeMap[name as keyof typeof engineTypeMap];
};

const getFeatureName = (name: keyof SupportedFeatures) => {
  const featureNameMap: { [key in keyof Required<SupportedFeatures>]: string } =
    {
      adjustMoraPitch: "モーラごとの音高の調整",
      adjustPhonemeLength: "音素ごとの長さの調整",
      adjustSpeedScale: "全体の話速の調整",
      adjustPitchScale: "全体の音高の調整",
      adjustIntonationScale: "全体の抑揚の調整",
      adjustVolumeScale: "全体の音量の調整",
      adjustPauseLength: "句読点などの無音時間の調整",
      interrogativeUpspeak: "疑問文の自動調整",
      synthesisMorphing: "2種類のスタイルでモーフィングした音声を合成",
      sing: "歌唱音声合成",
      manageLibrary: "音声ライブラリのインストール・アンインストール",
      returnResourceUrl: "キャラクター情報のリソースを URL で返送",
    };
  return featureNameMap[name];
};

const getEngineDirValidationMessage = (result: EngineDirValidationResult) => {
  const messageMap: {
    [key in EngineDirValidationResult]: string | undefined;
  } = {
    directoryNotFound: "フォルダが見つかりませんでした。",
    notADirectory: "フォルダではありません。",
    manifestNotFound: "engine_manifest.json が見つかりませんでした。",
    invalidManifest: "engine_manifest.json の内容が不正です。",
    alreadyExists: "同じ ID の音声合成エンジンが既に登録されています。",
    ok: undefined,
  };
  return messageMap[result];
};

const addEngine = async () => {
  const result = await store.actions.SHOW_CONFIRM_DIALOG({
    title: "音声合成エンジンを追加しますか？",
    message:
      "この操作はコンピュータに損害を与える可能性があります。音声合成エンジンの配布元が信頼できない場合は追加しないでください。",
    actionName: "追加する",
    isPrimaryColorButton: true,
  });
  if (result === "OK") {
    if (engineLoaderType.value === "dir") {
      await lockUi(
        "addingEngine",
        store.actions.ADD_ENGINE_DIR({
          engineDir: newEngineDir.value,
        }),
      );

      void requireReload(
        "音声合成エンジンを追加しました。反映には再読み込みが必要です。",
      );
    } else {
      const success = await lockUi(
        "addingEngine",
        store.actions.INSTALL_VVPP_ENGINE(vvppFilePath.value),
      );
      if (success) {
        void requireReload(
          "音声合成エンジンを追加しました。反映には再読み込みが必要です。",
        );
      }
    }
  }
};
const deleteEngine = async () => {
  const engineId = selectedId.value;
  if (engineId == undefined) throw new Error("engine is not selected");

  const engineInfo = engineInfos.value[engineId];

  // 念の為デフォルトエンジンではないことを確認
  if (engineInfo.isDefault) {
    throw new Error("default engine cannot be deleted");
  }

  const result = await store.actions.SHOW_WARNING_DIALOG({
    title: "音声合成エンジンを削除しますか？",
    message: `音声合成エンジン「${engineInfo.name}」を削除します。`,
    actionName: "削除する",
    isWarningColorButton: true,
  });
  if (result === "OK") {
    switch (engineInfo.type) {
      case "path": {
        const engineDir = engineInfo.path;
        if (!engineDir)
          throw new Error("assert engineInfos[selectedId.value].path");
        await lockUi(
          "deletingEngine",
          store.actions.REMOVE_ENGINE_DIR({
            engineDir,
          }),
        );
        void requireReload(
          "音声合成エンジンを削除しました。反映には再読み込みが必要です。",
        );
        break;
      }
      case "vvpp": {
        const success = await lockUi(
          "deletingEngine",
          store.actions.UNINSTALL_VVPP_ENGINE(engineId),
        );
        if (success) {
          void requireReload("音声合成エンジンの削除には再読み込みが必要です。");
        }
        break;
      }
      default:
        throw new Error("assert engineInfos[selectedId.value].type");
    }
  }
};

const selectEngine = (id: EngineId) => {
  selectedId.value = id;
};

const openSelectedEngineDirectory = () => {
  if (selectedId.value == undefined)
    throw new Error("assert selectedId.value != undefined");
  void store.actions.OPEN_ENGINE_DIRECTORY({ engineId: selectedId.value });
};

const restartSelectedEngine = () => {
  if (selectedId.value == undefined)
    throw new Error("assert selectedId.value != undefined");
  void store.actions.RESTART_ENGINES({
    engineIds: [selectedId.value],
  });
  // ダイヤログを表示したままだと「音声合成エンジン起動中...」と表示している
  // EngineStartupOverlay.vue が隠れて見えないので、ダイヤログを閉じる
  dialogOpened.value = false;
};

const requireReload = async (message: string) => {
  const result = await store.actions.SHOW_CONFIRM_DIALOG({
    type: "warning-light",
    title: "再読み込みしますか？",
    message: message,
    actionName: "再読み込みする",
    cancel: "後で",
    isPrimaryColorButton: true,
  });
  toInitialState();
  if (result === "OK") {
    void store.actions.CHECK_EDITED_AND_NOT_SAVE({
      closeOrReload: "reload",
    });
  }
};

const newEngineDir = ref("");
const newEngineDirValidationState = ref<EngineDirValidationResult | null>(null);
const selectEngineDir = async () => {
  const path = await window.backend.showOpenDirectoryDialog({
    title: "音声合成エンジンのフォルダを選択",
  });
  if (path) {
    newEngineDir.value = path;
    if (path === "") {
      newEngineDirValidationState.value = null;
      return;
    }
    newEngineDirValidationState.value = await store.actions.VALIDATE_ENGINE_DIR(
      {
        engineDir: path,
      },
    );
  }
};

const vvppFilePath = ref("");
const selectVvppFile = async () => {
  const path = await window.backend.showOpenFileDialog({
    title: "vvpp ファイルを選択",
    name: "VOICEVOX Plugin Package",
    mimeType: "application/octet-stream",
    extensions: ["vvpp", "vvppp"],
    defaultPath: vvppFilePath.value,
  });
  if (path) {
    vvppFilePath.value = path;
  }
};

const canAddEngine = computed(() => {
  if (uiLocked.value) return false;
  if (engineLoaderType.value === "dir") {
    return (
      newEngineDir.value !== "" && newEngineDirValidationState.value === "ok"
    );
  } else if (engineLoaderType.value === "vvpp") {
    return vvppFilePath.value !== "";
  } else {
    return false;
  }
});

// ステートの移動
// 初期状態
const toInitialState = () => {
  selectedId.value = undefined;
  isAddingEngine.value = false;

  const defaultEngineId = findDefaultEngineId();
  if (defaultEngineId) {
    selectedId.value = defaultEngineId;
  }
};
// エンジン追加状態
const toAddEngineState = () => {
  isAddingEngine.value = true;
  selectedId.value = undefined;
  newEngineDirValidationState.value = null;
  newEngineDir.value = "";
  vvppFilePath.value = "";
};
// ダイアログが閉じている状態
const toDialogClosedState = () => {
  dialogOpened.value = false;
  isAddingEngine.value = false;
};

watch(dialogOpened, (newVal) => {
  if (newVal) {
    toInitialState();
  }
});

function findDefaultEngineId() {
  // 'default'タイプのエンジンIDを検索
  for (const [type, engineIds] of Object.entries(categorizedEngineIds.value)) {
    if (type === "default" && engineIds.length > 0) {
      return engineIds[0]; // デフォルトエンジンのIDを返す
    }
  }
  return undefined; // デフォルトエンジンが見つからない場合はundefinedを返す
}
</script>

<style lang="scss" scoped>
@use "@/styles/colors" as colors;
@use "@/styles/variables" as vars;

.engine-list-col {
  border-right: solid 1px colors.$surface;
  position: relative; // オーバーレイのため
  overflow-x: hidden;
}

.engine-list-header {
  margin: 1rem;

  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
  .engine-list-title {
    flex-grow: 1;
  }
}

.engine-list {
  // menubar-height + toolbar-height + window-border-width +
  // 82(title & buttons) + 30(margin 15x2)
  height: calc(
    100vh - #{vars.$menubar-height + vars.$toolbar-height +
      vars.$window-border-width + 82px + 38px}
  );
  width: 100%;
  overflow-y: auto;
}

.engine-path {
  overflow-wrap: break-word;
}

.active-engine {
  background: hsl(206 66% 32% / 1);
  border-right: 4px solid colors.$primary;
}

.engine-list-disable-overlay {
  background-color: rgba($color: #000000, $alpha: 0.4);
  width: 100%;
  height: 100%;
  position: absolute;
  z-index: 10;
}

.engine-detail {
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

.engine-icon {
  height: 2rem;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  border-radius: 5px;
}

.ui-lock-popup {
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
</style>
