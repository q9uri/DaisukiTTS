<template>
  <QDialog v-model="dialogOpened" maximized transitionShow="jump-up" transitionHide="jump-down"
    class="setting-dialog transparent-backdrop">
    <QLayout container view="hHh Lpr fFf" class="bg-background">
      <QPageContainer>
        <QHeader class="q-py-sm">
          <QToolbar>
            <!-- close button -->
            <QBtn round flat icon="sym_r_close" color="display" @click="toDialogClosedState" />
            <QToolbarTitle class="text-display">
              音声合成モデルの管理 <span class="q-ml-sm text-caption">合計 {{ aivmCount }} モデル</span>
            </QToolbarTitle>
            <QBtn outline icon="sym_r_search" label="音声合成モデルを探す" textColor="display"
              class="text-bold q-mr-sm" @click="openExternalLink" />
            <QBtn outline icon="sym_r_upload" label="インストール / 更新" textColor="display" class="text-bold" @click="isInstalling = true" />
          </QToolbar>
        </QHeader>
        <QPage class="row no-wrap">
          <div class="col-4" style="position: relative; min-width: 260px; flex-shrink: 0; border-right: solid 1px var(--color-surface);">
            <div
              v-if="isInstalling"
              class="model-list-disable-overlay"
              @click="cancelInstall"
            ></div>
            <QList class="model-list">
              <QItem v-for="aivmInfo in Object.values(aivmInfoDict)" :key="aivmInfo.manifest.uuid" v-ripple class="q-pr-none" clickable
                :active="activeAivmUuid === aivmInfo.manifest.uuid"
                :class="{ 'loaded-model': aivmInfo.isLoaded }"
                @click="activeAivmUuid = aivmInfo.manifest.uuid">
                <QItemSection avatar>
                  <QAvatar rounded color="primary">
                    <img :src="aivmInfo.manifest.speakers[0].icon" />
                  </QAvatar>
                </QItemSection>
                <QItemSection>
                  <QItemLabel class="text-display">
                    {{ aivmInfo.manifest.name }}
                    <QIcon v-if="aivmInfo.isLoaded" name="sym_r_power" size="16px" class="power-icon text-power-on" />
                  </QItemLabel>
                  <QItemLabel caption class="engine-path">
                    {{ aivmInfo.manifest.speakers.length }} Speakers / Version {{ aivmInfo.manifest.version }}
                    <QBadge v-if="aivmInfo.isUpdateAvailable" color="primary"
                      style="margin-left: 4px; margin-top: 2px; font-size: 10.5px;">Update!</QBadge>
                  </QItemLabel>
                </QItemSection>
              </QItem>
            </QList>
          </div>
          <div v-if="activeAivmInfo && !isInstalling" class="model-detail" style="width: 100%;">
            <!-- タブは複数の話者がモデルに含まれる場合のみ表示する -->
            <QTabs v-if="activeAivmInfo && activeAivmInfo.manifest.speakers.length > 1" v-model="activeSpeakerIndex"
              dense activeColor="primary" @update:modelValue="stopAllAudio">
              <QTab v-for="(speaker, index) of activeAivmInfo.manifest.speakers" :key="speaker.uuid" :name="index"
                style="text-transform: none !important;">
                話者{{ index + 1 }} ({{ speaker.name }})
              </QTab>
            </QTabs>
            <QTabPanels v-model="activeSpeakerIndex" class="bg-background">
              <QTabPanel v-for="(speaker, index) of activeAivmInfo.manifest.speakers" :key="speaker.uuid" :name="index">
                <div class="model-detail-content" :class="{'model-detail-content--multi-speaker': activeAivmInfo.manifest.speakers.length >= 2}">
                  <div class="q-mt-sm row items-center">
                    <div class="col-auto" style="font-size: 20px; font-weight: bold;">
                      <span>{{ activeAivmInfo.manifest.name }}</span>
                      <!-- 音声合成モデル名と現在の話者名が異なる場合のみ、話者名を追加する -->
                      <span v-if="activeAivmInfo.manifest.name !== speaker.name">
                        - {{ speaker.name }}
                      </span>
                    </div>
                    <div class="col-auto q-ml-auto" style="font-size: 13.5px; color: #D2D3D4;">
                      <span>Version {{ activeAivmInfo.manifest.version }}</span>
                      <!-- プライベートモデルでない場合は AivisHub へのリンクを表示 -->
                      <a v-if="!activeAivmInfo.isPrivateModel"
                         :href="`https://hub.aivis-project.com/aivm-models/${activeAivmInfo.manifest.uuid}`"
                         target="_blank"
                         class="q-ml-xs">(AivisHub)</a>
                      <!-- プライベートモデルの場合は (Private) を表示 -->
                      <span v-else class="q-ml-xs">(Private)</span>
                      <span> / {{ formatBytes(activeAivmInfo.fileSize) }}</span>
                      <!-- アップデートがある場合は更新メッセージを表示 -->
                      <a v-if="activeAivmInfo.isUpdateAvailable" class="q-ml-xs text-primary"
                        :href="`https://hub.aivis-project.com/aivm-models/${activeAivmInfo.manifest.uuid}`"
                        target="_blank">
                        (Version {{ activeAivmInfo.latestVersion }} に更新できます)
                      </a>
                    </div>
                  </div>
                  <div class="row items-center" style="margin-top: 12px;">
                    <div class="col-auto q-mr-sm" style="font-size: 15px; font-weight: bold;">
                      {{ speaker.styles.length }}スタイル
                    </div>
                    <div class="col-auto" style="font-size: 13.5px; font-weight: bold; color: #D2D3D4;">
                      {{ speaker.styles.map(style => style.name).join(' / ') }}
                    </div>
                  </div>
                  <div class="row items-center" style="margin-top: 12px; font-size: 12.5px; color: #D2D3D4;">
                    <QIcon style="margin-right: 4px;" name="sym_r_manufacturing" /> Model Architecture: {{ activeAivmInfo.manifest.modelArchitecture }}
                    <QIcon style="margin-right: 4px; margin-left: 12px;" name="sym_r_description" /> Model Format: {{ activeAivmInfo.manifest.modelFormat }}
                  </div>
                  <div class="row items-center" style="margin-top: 4px; font-size: 12.5px; color: #D2D3D4;">
                    <QIcon style="margin-right: 4px;" name="sym_r_person" />
                    {{ activeAivmInfo.manifest.creators!.length >= 2 ? 'Creators: ' : 'Creator: ' }}
                    {{ activeAivmInfo.manifest.creators!.length >= 1 ? activeAivmInfo.manifest.creators!.join(' / ') : '不明' }}
                  </div>
                  <div class="q-mt-md" style="font-size: 13.5px; color: #D2D3D4; white-space: pre-wrap; word-wrap: break-word; line-height: 1.7;">
                    <span v-if="activeAivmInfo.manifest.description === ''">
                      （この音声合成モデルの説明は提供されていません）
                    </span>
                    <!-- eslint-disable-next-line vue/no-v-html -->
                    <span v-else v-html="linkify(activeAivmInfo.manifest.description)"></span>
                  </div>
                  <div class="q-mt-md" style="margin-bottom: 12px; font-size: 17px; font-weight: bold;">ボイスサンプル</div>
                  <div class="row" style="gap: 12px;">
                    <div v-for="style in speaker.styles" :key="style.localId" class="col-12">
                      <div class="style-card">
                        <div class="style-content">
                          <div class="style-icon-container">
                            <img class="style-icon" :src="style.icon ? style.icon : speaker.icon" />
                            <div class="style-name">{{ style.name }}</div>
                          </div>
                          <div class="voice-samples-container">
                            <div v-if="style.voiceSamples!.length === 0" class="sample-transcript">
                              （このスタイルのボイスサンプルは提供されていません）
                            </div>
                            <div v-for="(sample, voiceSampleIndex) in style.voiceSamples" :key="voiceSampleIndex" class="voice-sample">
                              <div
                                class="play-button"
                                :class="{ 'playing': audioPlaying[`${speaker.uuid}-${style.localId}-${voiceSampleIndex}`] }"
                                @click="toggleAudio(speaker.uuid, style.localId, voiceSampleIndex, sample.audio)"
                              >
                                <QIcon
                                  :name="audioPlaying[`${speaker.uuid}-${style.localId}-${voiceSampleIndex}`] ? 'sym_r_stop' : 'sym_r_volume_up'"
                                  size="25px"
                                  color="white"
                                />
                              </div>
                              <div class="sample-transcript">{{ sample.transcript }}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="fixed-bottom-buttons">
                  <QSpace />
                  <QBtn v-if="activeAivmInfo.isUpdateAvailable" outline icon="sym_r_update"
                    label="アップデート" textColor="primary" class="text-no-wrap text-bold q-mr-sm"
                    @click="updateAivmModel" />
                  <QBtn outline :icon="activeAivmInfo.isLoaded ? 'sym_r_power_off' : 'sym_r_power'"
                    :label="activeAivmInfo.isLoaded ? 'モデルをアンロード' : 'モデルをロード'"
                    :textColor="activeAivmInfo.isLoaded ? 'power-off' : 'power-on'"
                    class="text-no-wrap text-bold q-mr-sm"
                    @click="toggleModelLoad" />
                  <QBtn outline icon="sym_r_delete" label="アンインストール" textColor="warning" class="text-no-wrap text-bold"
                    @click="unInstallAivmModel" />
                </div>
              </QTabPanel>
            </QTabPanels>
          </div>
          <div v-if="isInstalling" class="model-detail q-px-lg q-pt-lg column" style="width: 100%; padding-bottom: 14px;">
            <div class="text-h5">音声合成モデルのインストール / 更新</div>
            <div class="q-mt-lg">
              <QBtnToggle
                v-model="installMethod"
                :options="[
                  { label: 'ファイルからインストール', value: 'file' },
                  { label: 'URL からインストール', value: 'url' },
                ]"
                color="surface"
                unelevated
                textColor="display"
                toggleColor="primary"
                toggleTextColor="display-on-primary"
              />
            </div>
            <div v-if="installMethod === 'file'">
              <div class="q-mt-lg">
                PC 内の AIVMX ファイル (.aivmx) を選択して、音声合成モデルをインストール / 更新します。
              </div>
              <div class="q-mt-md">
                <QFile v-model="selectedFile" label="AIVMX ファイル (.aivmx) を選択" accept=".aivmx" dense
                  @click.stop="selectedFile = null" @update:modelValue="(file: File) => selectedFile = file">
                  <template #prepend>
                    <QIcon name="sym_r_attach_file" />
                  </template>
                  <template #append>
                    <QIcon name="sym_r_close" class="cursor-pointer" @click.stop="selectedFile = null" />
                  </template>
                </QFile>
              </div>
            </div>
            <div v-else>
              <div class="q-mt-lg" style="line-height: 1.65;">
                AIVMX ファイルのダウンロード URL を指定して、音声合成モデルをインストール / 更新します。<br>
                AivisHub のモデル詳細ページの URL を指定することもできます。
              </div>
              <div class="q-mt-sm q-mt-md">
                <QInput v-model="installUrl" dense
                  label="例: https://hub.aivis-project.com/aivm-models/(音声合成モデルのUUID)"
                  :rules="[
                    (url) => isValidUrl(url) || 'URL が不正です。',
                  ]"
                  />
              </div>
            </div>
            <div class="row q-mt-auto">
              <QSpace />
              <QBtn outline icon="sym_r_close" label="キャンセル" textColor="display" class="text-no-wrap text-bold q-mr-sm"
                @click="cancelInstall" />
              <QBtn outline icon="sym_r_upload" label="インストール / 更新" textColor="primary" class="text-no-wrap text-bold"
                :disabled="!canInstall" @click="installModel" />
            </div>
          </div>
        </QPage>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>
<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from "vue";
import linkifyHtml from "linkify-html";

import {
  hideAllLoadingScreen,
  showLoadingScreen,
} from "@/components/Dialog/Dialog";
import { formatBytes } from "@/helpers/fileHelper";
import { createLogger } from "@/helpers/log";
import { AivmInfo, ResponseError } from "@/openapi";
import { useStore } from "@/store";

const dialogOpened = defineModel<boolean>("dialogOpened", { default: false });

const log = createLogger("ModelManageDialog");

const store = useStore();

// ダイアログが閉じている状態
const toDialogClosedState = () => {
  dialogOpened.value = false;
};

// API インスタンスを取得する関数
// VOICEVOX のお作法ではこうやらないと API を呼べないっぽい…
const getApiInstance = async () => {
  return await store.actions.INSTANTIATE_ENGINE_CONNECTOR({ engineId: store.getters.DEFAULT_ENGINE_ID });
};

// インストール済み AIVM 音声合成モデルの情報
const aivmInfoDict = ref<{ [key: string]: AivmInfo }>({});

// インストール済み AIVM 音声合成モデルの個数
const aivmCount = computed(() => Object.keys(aivmInfoDict.value).length);

// インストール済み AIVM 音声合成モデルの情報を取得する関数
const getAivmInfos = async () => {
  // 初回のみ読み込み中のローディングを表示する
  if (Object.keys(aivmInfoDict.value).length === 0) {
    showLoadingScreen({
      message: "読み込み中...",
    });
  }
  const res = await getApiInstance().then((instance) => instance.invoke("getInstalledAivmInfos")({}));
  aivmInfoDict.value = res;
  // 初回のみアクティブな AIVM 音声合成モデルの UUID を設定
  if (activeAivmUuid.value == null && Object.keys(aivmInfoDict.value).length > 0) {
    activeAivmUuid.value = Object.values(aivmInfoDict.value)[0].manifest.uuid;
  }
  // この時点で activeAivmUuid に対応する AIVM 音声合成モデルが存在しない場合は (削除されたなど) 、上記同様に最初の AIVM 音声合成モデルをアクティブにする
  if (activeAivmUuid.value != null && !(activeAivmUuid.value in aivmInfoDict.value)) {
    activeAivmUuid.value = Object.values(aivmInfoDict.value)[0].manifest.uuid;
  }
  if (Object.keys(aivmInfoDict.value).length > 0) {
    void hideAllLoadingScreen();
  }
};

// ダイヤログが開かれた時
watch(dialogOpened, () => {
  if (dialogOpened.value) {
    void getAivmInfos();
    installMethod.value = "file";
    selectedFile.value = null;
    installUrl.value = "";
    isInstalling.value = false;
  }
});

// アクティブな AIVM 音声合成モデルの UUID
const activeAivmUuid = ref<string | null>(null);

// アクティブな AIVM 音声合成モデルの情報
const activeAivmInfo = computed(() => {
  return activeAivmUuid.value ? aivmInfoDict.value[activeAivmUuid.value] : null;
});

// アクティブな AIVM 音声合成モデルの話者タブのインデックス
// QTab / QTabPanel の name 属性の値と一致する
const activeSpeakerIndex = ref(0);

// 音声再生中かどうか
const audioPlaying = ref<{ [key: string]: boolean }>({});
// 音声再生用の Audio 要素
const audioElements: { [key: string]: HTMLAudioElement } = {};

// すべての音声を停止する
const stopAllAudio = () => {
  Object.keys(audioPlaying.value).forEach(key => {
    if (audioPlaying.value[key]) {
      audioElements[key].pause();
      audioElements[key].currentTime = 0;
      audioPlaying.value[key] = false;
    }
  });
};

// 音声再生を切り替える
const toggleAudio = (speakerUuid: string, styleLocalId: number, sampleIndex: number, audioDataUrl: string) => {
  const key = `${speakerUuid}-${styleLocalId}-${sampleIndex}`;
  if (!audioElements[key]) {
    audioElements[key] = new Audio(audioDataUrl);
    audioElements[key].addEventListener("ended", () => {
      audioPlaying.value[key] = false;
    });
  }

  if (audioPlaying.value[key]) {
    audioElements[key].pause();
    audioElements[key].currentTime = 0;
    audioPlaying.value[key] = false;
  } else {
    stopAllAudio();
    void audioElements[key].play();
    audioPlaying.value[key] = true;
  }
};

// 外部リンクを開く
const openExternalLink = () => {
  window.open("https://hub.aivis-project.com/", "_blank");
};

const isInstalling = ref(false);
const installMethod = ref("file");
const selectedFile = ref<File | null>(null);
const installUrl = ref("");

const isValidUrl = (url: string): boolean => {
  return /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/i.test(url);
};

const canInstall = computed(() => {
  return (installMethod.value === "file" && selectedFile.value != null) ||
         (installMethod.value === "url" && installUrl.value.trim() !== "" && isValidUrl(installUrl.value));
});

const cancelInstall = () => {
  isInstalling.value = false;
  selectedFile.value = null;
  installUrl.value = "";
};

// 音声合成モデルの追加・更新・削除が起きた起きた際に話者・スタイル一覧をリロードする
const reloadCharacterAndStyle = async () => {
  // 話者・スタイル一覧を再読み込み
  await store.actions.LOAD_CHARACTER({ engineId: store.getters.DEFAULT_ENGINE_ID });
  await store.actions.LOAD_DEFAULT_STYLE_IDS();
  // プリセットを再作成
  await store.actions.CREATE_ALL_DEFAULT_PRESET();
  // 新しくインストールされた音声合成モデル内話者の UUID が userCharacterOrder にまだ登録されていない場合、
  // CharacterButton 内メニューで新しい話者が一番上に表示されて煩わしいため、ここで新しい話者の UUID を userCharacterOrder の末尾に登録する
  const newCharacters = await store.actions.GET_NEW_CHARACTERS();
  if (newCharacters.length > 0) {
    const newUserCharacterOrder = [...store.state.userCharacterOrder, ...newCharacters];
    await store.actions.SET_USER_CHARACTER_ORDER(newUserCharacterOrder);
  }
};

// 音声合成モデルをインストールする
const installModel = async () => {
  showLoadingScreen({
    message: "インストールしています...",
  });
  try {
    const apiInstance = await getApiInstance();
    if (installMethod.value === "file" && selectedFile.value) {
      await apiInstance.invoke("installModel")({ file: selectedFile.value });
    } else if (installMethod.value === "url") {
      await apiInstance.invoke("installModel")({ url: installUrl.value });
    }
    // 話者・スタイル一覧を再読み込み
    await reloadCharacterAndStyle();
    void store.actions.SHOW_MESSAGE_DIALOG({
      type: "info",
      title: "インストールが完了しました",
      message: "音声合成モデルが正常にインストールされました。",
    });
    cancelInstall();
  } catch (error) {
    log.error(error);
    if (error instanceof ResponseError) {
      void store.actions.SHOW_ALERT_DIALOG({
        title: "インストールに失敗しました",
        message: "音声合成モデルのインストールに失敗しました。\n" +
                 `(HTTP Error ${error.response.status} / ${await error.response.text()})`,
      });
    } else {
      // assert characterInfo !== undefined エラーを無視
      if (error instanceof Error && error.message === "assert characterInfo !== undefined") {
        // 話者・スタイル一覧を再読み込み
        await reloadCharacterAndStyle();
      } else {
        void store.actions.SHOW_ALERT_DIALOG({
          title: "インストールに失敗しました",
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          message: `音声合成モデルのインストールに失敗しました。(${error})`,
        });
      }
    }
  } finally {
    await getAivmInfos();  // 再取得
    hideAllLoadingScreen();
  }
};

// 音声合成モデルをアンインストールする
const unInstallAivmModel = async () => {
  if (activeAivmUuid.value == null) {
    throw new Error("aivm model is not selected");
  }
  const result = await store.actions.SHOW_WARNING_DIALOG({
    title: "音声合成モデルをアンインストールしますか？",
    message: `音声合成モデル「${activeAivmInfo.value?.manifest.name}」をアンインストールします。\n` +
             "アンインストールすると、この音声合成モデル内の話者/スタイルは再度インストールするまで使えなくなります。",
    actionName: "アンインストールする",
    isWarningColorButton: true,
  });
  if (result === "OK") {
    showLoadingScreen({
      message: "アンインストールしています...",
    });
    try {
      await getApiInstance().then((instance) =>
        instance.invoke("uninstallModel")({ aivmUuid: activeAivmUuid.value! }));
      // 話者・スタイル一覧を再読み込み
      await reloadCharacterAndStyle();
    } catch (error) {
      log.error(error);
      if (error instanceof ResponseError) {
        void store.actions.SHOW_ALERT_DIALOG({
          title: "アンインストールに失敗しました",
          message: `音声合成モデル「${activeAivmInfo.value?.manifest.name}」のアンインストールに失敗しました。\n` +
                   `(HTTP Error ${error.response.status} / ${await error.response.text()})`,
        });
      } else {
        // assert characterInfo !== undefined エラーを無視
        if (error instanceof Error && error.message === "assert characterInfo !== undefined") {
          // 話者・スタイル一覧を再読み込み
          await reloadCharacterAndStyle();
        } else {
          void store.actions.SHOW_ALERT_DIALOG({
            title: "アンインストールに失敗しました",
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            message: `音声合成モデル「${activeAivmInfo.value?.manifest.name}」のアンインストールに失敗しました。(${error})`,
          });
        }
      }
    } finally {
      await getAivmInfos();  // 再取得
      hideAllLoadingScreen();
    }
  }
};

// モデルのロード/アンロードを切り替える
const toggleModelLoad = async () => {
  if (activeAivmUuid.value == null) {
    throw new Error("aivm model is not selected");
  }

  showLoadingScreen({
    message: activeAivmInfo.value?.isLoaded ? "モデルをアンロードしています..." : "モデルをロードしています...",
  });

  try {
    const apiInstance = await getApiInstance();
    if (activeAivmInfo.value?.isLoaded) {
      await apiInstance.invoke("unloadModel")({ aivmUuid: activeAivmUuid.value });
    } else {
      await apiInstance.invoke("loadModel")({ aivmUuid: activeAivmUuid.value });
    }
  } catch (error) {
    log.error(error);
    if (error instanceof ResponseError) {
      void store.actions.SHOW_ALERT_DIALOG({
        title: activeAivmInfo.value?.isLoaded ? "アンロードに失敗しました" : "ロードに失敗しました",
        message: `音声合成モデル「${activeAivmInfo.value?.manifest.name}」の${activeAivmInfo.value?.isLoaded ? "アンロード" : "ロード"}に失敗しました。\n` +
                 `(HTTP Error ${error.response.status} / ${await error.response.text()})`,
      });
    } else {
      void store.actions.SHOW_ALERT_DIALOG({
        title: activeAivmInfo.value?.isLoaded ? "アンロードに失敗しました" : "ロードに失敗しました",
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        message: `音声合成モデル「${activeAivmInfo.value?.manifest.name}」の${activeAivmInfo.value?.isLoaded ? "アンロード" : "ロード"}に失敗しました。(${error})`,
      });
    }
  } finally {
    await getAivmInfos();  // 再取得
    hideAllLoadingScreen();
  }
};

// モデルをアップデートする
const updateAivmModel = async () => {
  if (activeAivmUuid.value == null) {
    throw new Error("aivm model is not selected");
  }

  const result = await store.actions.SHOW_CONFIRM_DIALOG({
    title: "音声合成モデルをアップデートしますか？",
    message: `音声合成モデル「${activeAivmInfo.value?.manifest.name}」を Version ${activeAivmInfo.value?.latestVersion} へアップデートします。\n` +
             "アップデート後、前のバージョンに戻すことはできません。",
    actionName: "アップデートする",
  });

  if (result === "OK") {
    showLoadingScreen({
      message: "アップデートしています...",
    });

    try {
      const apiInstance = await getApiInstance();
      await apiInstance.invoke("updateModel")({ aivmUuid: activeAivmUuid.value });
      // 話者・スタイル一覧を再読み込み
      await reloadCharacterAndStyle();
      void store.actions.SHOW_MESSAGE_DIALOG({
        type: "info",
        title: "アップデートが完了しました",
        message: "音声合成モデルが正常にアップデートされました。",
      });
    } catch (error) {
      log.error(error);
      if (error instanceof ResponseError) {
        void store.actions.SHOW_ALERT_DIALOG({
          title: "アップデートに失敗しました",
          message: `音声合成モデル「${activeAivmInfo.value?.manifest.name}」のアップデートに失敗しました。\n` +
                   `(HTTP Error ${error.response.status} / ${await error.response.text()})`,
        });
      } else {
        // assert characterInfo !== undefined エラーを無視
        if (error instanceof Error && error.message === "assert characterInfo !== undefined") {
          // 話者・スタイル一覧を再読み込み
          await reloadCharacterAndStyle();
        } else {
          void store.actions.SHOW_ALERT_DIALOG({
            title: "アップデートに失敗しました",
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            message: `音声合成モデル「${activeAivmInfo.value?.manifest.name}」のアップデートに失敗しました。(${error})`,
          });
        }
      }
    } finally {
      await getAivmInfos();  // 再取得
      hideAllLoadingScreen();
    }
  }
};

// コンポーネントがアンマウントされる時に音声を停止し、イベントリスナーを削除する
onUnmounted(() => {
  Object.values(audioElements).forEach(audio => {
    audio.pause();
    audio.currentTime = 0;
    audio.removeEventListener("ended", () => {});
  });
});

// URL をリンク化する関数
const linkify = (text: string | undefined): string => {
  if (!text) return "";
  const result = linkifyHtml(text, {
    defaultProtocol: "https",
    target: "_blank",
  });

  return result;
};

</script>
<style lang="scss" scoped>

@use "@/styles/colors" as colors;
@use "@/styles/variables" as vars;

.q-item--active {
  background: hsl(206 66% 32% / 1);
  border-right: 4px solid colors.$primary;
}

.loaded-model:not(.q-item--active) {
  background: rgba(53, 227, 147, 0.1);
}

.model-list {
  height: calc(
    100vh - #{vars.$menubar-height + vars.$toolbar-height +
      vars.$window-border-width}
  );
  overflow-y: auto;
}

.text-power-on {
  color: #86df9f;
}

.text-power-off {
  color: #dfd686;
}

.model-detail {
  user-select: text;

  .q-tab-panel {
    padding: 0 !important;
  }

  .model-detail-content {
    height: calc(
      100vh - #{vars.$menubar-height + vars.$toolbar-height +
        vars.$window-border-width} - 66px
    );
    padding: 16px;
    overflow-y: auto;

    &--multi-speaker {
      height: calc(
        100vh - #{vars.$menubar-height + vars.$toolbar-height +
          vars.$window-border-width} - 66px - 36px
      );
    }
  }

  .fixed-bottom-buttons {
    display: flex;
    justify-content: flex-end;
    padding: 16px;
    padding-top: 14px;
    height: 66px;
    border-top: 2px solid var(--color-splitter);
  }
}

.model-list-disable-overlay {
  background-color: rgba($color: #000000, $alpha: 0.4);
  width: 100%;
  height: 100%;
  position: absolute;
  z-index: 10;
}

.bg-surface {
  background: #363A3F;
}

.style-card {
  padding: 12px 20px;
  background: #363A3F;
  box-shadow: 0px 1px 4px rgba(0, 0, 0, 0.25);
  border-radius: 12px;
  overflow: hidden;
  border: 1px #3B3E43 solid;
}

.style-content {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
}

.style-icon-container {
  flex-direction: column;
  justify-content: center;
  align-items: center;
  max-width: 100px;
  gap: 10px;
  display: inline-flex;
}

.style-icon {
  width: 100px;
  height: 100px;
  clip-path: vars.$squircle;
  background-color: var(--color-splitter);
}

.style-name {
  text-align: center;
  color: #FBEEEA;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.6;
  word-wrap: break-word;
}

.voice-samples-container {
  flex: 1 1 0;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
  gap: 4px;
  display: inline-flex;
}

.voice-sample {
  align-self: stretch;
  background: #363A3F;
  justify-content: flex-start;
  align-items: center;
  gap: 12px;
  display: inline-flex;
  margin-bottom: 8px;
}

.play-button {
  width: 45px;
  height: 45px;
  background: #41A2EC;
  box-shadow: 0px 1px 4px rgba(0, 0, 0, 0.25);
  border-radius: 26px;
  overflow: hidden;
  border: 1px #3B3E43 solid;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.2s ease;

  &:hover {
    background: rgb(130, 201, 255);
    transform: scale(1.05);
  }
}

.sample-transcript {
  flex: 1 1 0;
  color: white;
  font-size: 13.50px;
  font-weight: 400;
  line-height: 1.6;
  word-wrap: break-word;
}

.power-icon {
  margin-top: -2px;
  vertical-align: middle;
}

:deep(a) {
  color: #41A2EC;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

</style>