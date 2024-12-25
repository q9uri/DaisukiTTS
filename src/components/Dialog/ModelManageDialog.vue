<template>
  <QDialog v-model="engineManageDialogOpenedComputed" maximized transitionShow="jump-up" transitionHide="jump-down"
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
                :active="activeAivmUuid === aivmInfo.manifest.uuid" @click="activeAivmUuid = aivmInfo.manifest.uuid">
                <QItemSection avatar>
                  <QAvatar rounded color="primary">
                    <img :src="aivmInfo.manifest.speakers[0].icon" />
                  </QAvatar>
                </QItemSection>
                <QItemSection>
                  <QItemLabel class="text-display">{{ aivmInfo.manifest.name }}</QItemLabel>
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
            <QTabPanels v-model="activeSpeakerIndex"
              animated class="bg-background">
              <QTabPanel v-for="(speaker, index) of activeAivmInfo.manifest.speakers" :key="speaker.uuid" :name="index">
                <div class="model-detail-content">
                  <div class="q-mt-sm row items-center">
                    <div class="col-auto" style="font-size: 20px; font-weight: bold;">
                      <span>{{ activeAivmInfo.manifest.name }}</span>
                      <!-- 音声合成モデル名と現在の話者名が異なる場合のみ、話者名を追加する -->
                      <span v-if="activeAivmInfo.manifest.name !== speaker.name">
                        - {{ speaker.name }}
                      </span>
                    </div>
                    <div class="col-auto q-ml-auto" style="font-size: 13.5px; color: #D2D3D4;">
                      <span>{{ activeAivmInfo.manifest.speakers.length }} Speakers / Version {{ activeAivmInfo.manifest.version }}</span>
                      <span v-if="activeAivmInfo.isUpdateAvailable" class="q-ml-xs text-primary">
                        (Version {{ activeAivmInfo.latestVersion }} に更新できます)
                      </span>
                    </div>
                  </div>
                  <div class="row items-center" style="margin-top: 12px;">
                    <div class="col-auto q-mr-sm" style="font-size: 15px; font-weight: bold;">
                      {{ activeAivmInfo.manifest.speakers.reduce((acc, speaker) => acc + speaker.styles.length, 0) }}スタイル
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
                  <div class="q-mt-md" style="font-size: 13.5px; color: #D2D3D4; white-space: pre-wrap; word-wrap: break-word;">
                    {{ activeAivmInfo.manifest.description === '' ?
                      '（この音声合成モデルの説明は提供されていません）' :
                      activeAivmInfo.manifest.description
                    }}
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
          <div v-if="isInstalling" class="model-detail q-pa-lg column" style="width: 100%;">
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
              <div class="q-mt-lg">
                AIVMX ファイルのダウンロード URL を指定して、音声合成モデルをインストール / 更新します。
              </div>
              <div class="q-mt-sm q-mt-md">
                <QInput v-model="installUrl" label="AIVMX ファイルのダウンロード URL を指定" dense :rules="[
                  (url) => /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/i.test(url) || 'URL が不正です。',
                ]" />
              </div>
            </div>
            <div class="row q-mt-auto right-pane-buttons">
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
import { AivmInfo, ResponseError } from "@/openapi";
import { useStore } from "@/store";

const store = useStore();

const props = defineProps<{
  modelValue: boolean;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", val: boolean): void;
}>();

const engineManageDialogOpenedComputed = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

// ダイアログが閉じている状態
const toDialogClosedState = () => {
  engineManageDialogOpenedComputed.value = false;
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
    void store.actions.SHOW_LOADING_SCREEN({
      message: "読み込み中...",
    });
  }
  const res = await getApiInstance().then((instance) => instance.invoke("getInstalledAivmInfosAivmModelsGet")({}));
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
    void store.actions.HIDE_ALL_LOADING_SCREEN();
  }
};

// ダイヤログが開かれた時
watch(engineManageDialogOpenedComputed, () => {
  if (engineManageDialogOpenedComputed.value) {
    void getAivmInfos();
    installMethod.value = 'file';
    selectedFile.value = null;
    installUrl.value = '';
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
    audioElements[key].addEventListener('ended', () => {
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
  window.open('https://hub.aivis-project.com/', '_blank');
};

const isInstalling = ref(false);
const installMethod = ref('file');
const selectedFile = ref<File | null>(null);
const installUrl = ref('');

const canInstall = computed(() => {
  return (installMethod.value === 'file' && selectedFile.value!= null) ||
         (installMethod.value === 'url' && installUrl.value.trim() !== '');
});

const cancelInstall = () => {
  isInstalling.value = false;
  selectedFile.value = null;
  installUrl.value = '';
};

// 音声合成モデルをインストールする
const installModel = async () => {
  void store.actions.SHOW_LOADING_SCREEN({
    message: "インストールしています...",
  });
  try {
    const apiInstance = await getApiInstance();
    if (installMethod.value === 'file' && selectedFile.value) {
      await apiInstance.invoke("installAivmAivmModelsInstallPost")({ file: selectedFile.value });
    } else if (installMethod.value === 'url') {
      await apiInstance.invoke("installAivmAivmModelsInstallPost")({ url: installUrl.value });
    }
    // インストール成功時の処理
    // 話者・スタイル一覧を再読み込み
    await store.actions.LOAD_CHARACTER({ engineId: store.getters.DEFAULT_ENGINE_ID });
    await store.actions.LOAD_DEFAULT_STYLE_IDS();
    // プリセットを再作成
    await store.actions.CREATE_ALL_DEFAULT_PRESET();
    void store.actions.SHOW_ALERT_DIALOG({
      title: "インストール完了",
      message: "音声合成モデルが正常にインストールされました。",
    });
    cancelInstall();
  } catch (error) {
    console.error(error);
    if (error instanceof ResponseError) {
      void store.actions.SHOW_ALERT_DIALOG({
        type: "error",
        title: "インストール失敗",
        message: `音声合成モデルのインストールに失敗しました。\n` +
                 `(HTTP Error ${error.response.status} / ${await error.response.text()})`,
      });
    } else {
      // assert characterInfo !== undefined エラーを無視
      if (error instanceof Error && error.message === 'assert characterInfo !== undefined') {
        // インストール成功時の処理を実行
        await store.actions.LOAD_CHARACTER({ engineId: store.getters.DEFAULT_ENGINE_ID });
        await store.actions.LOAD_DEFAULT_STYLE_IDS();
        await store.actions.CREATE_ALL_DEFAULT_PRESET();
      } else {
        void store.actions.SHOW_ALERT_DIALOG({
          type: "error",
          title: "インストール失敗",
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          message: `音声合成モデルのインストールに失敗しました。(${error})`,
        });
      }
    }
  } finally {
    await store.actions.HIDE_ALL_LOADING_SCREEN();
    void getAivmInfos();  // 再取得
  }
};

// 音声合成モデルをアンインストールする
const unInstallAivmModel = async () => {
  if (activeAivmUuid.value == null) {
    throw new Error("aivm model is not selected");
  }
  const result = await store.actions.SHOW_CONFIRM_DIALOG({
    title: "アンインストールの確認",
    message: `本当に音声合成モデル「${activeAivmInfo.value?.manifest.name}」をアンインストールしますか？\n` +
             'アンインストールすると、この音声合成モデル内の話者/スタイルは再度インストールするまで使えなくなります。',
    actionName: "アンインストール",
  });
  if (result === "OK") {
    void store.actions.SHOW_LOADING_SCREEN({
      message: "アンインストールしています...",
    });
    try {
      await getApiInstance().then((instance) =>
        instance.invoke("uninstallAivmAivmModelsAivmUuidUninstallDelete")({ aivmUuid: activeAivmUuid.value! }))
      // アンインストール成功時の処理
      // 話者・スタイル一覧を再読み込み
      await store.actions.LOAD_CHARACTER({ engineId: store.getters.DEFAULT_ENGINE_ID });
      await store.actions.LOAD_DEFAULT_STYLE_IDS();
      // プリセットを再作成
      await store.actions.CREATE_ALL_DEFAULT_PRESET();
    } catch (error) {
      console.error(error);
      if (error instanceof ResponseError) {
        void store.actions.SHOW_ALERT_DIALOG({
          type: "error",
          title: "アンインストール失敗",
          message: `音声合成モデル「${activeAivmInfo.value?.manifest.name}」のアンインストールに失敗しました。\n` +
                   `(HTTP Error ${error.response.status} / ${await error.response.text()})`,
        });
      } else {
        // assert characterInfo !== undefined エラーを無視
        if (error instanceof Error && error.message === 'assert characterInfo !== undefined') {
          // アンインストール成功時の処理を実行
          await store.actions.LOAD_CHARACTER({ engineId: store.getters.DEFAULT_ENGINE_ID });
          await store.actions.LOAD_DEFAULT_STYLE_IDS();
          await store.actions.CREATE_ALL_DEFAULT_PRESET();
        } else {
          void store.actions.SHOW_ALERT_DIALOG({
            type: "error",
            title: "アンインストール失敗",
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            message: `音声合成モデル「${activeAivmInfo.value?.manifest.name}」のアンインストールに失敗しました。(${error})`,
          });
        }
      }
    } finally {
      await store.actions.HIDE_ALL_LOADING_SCREEN();
      void getAivmInfos();  // 再取得
    }
  }
};

// モデルのロード/アンロードを切り替える
const toggleModelLoad = async () => {
  if (activeAivmUuid.value == null) {
    throw new Error('aivm model is not selected');
  }

  void store.actions.SHOW_LOADING_SCREEN({
    message: activeAivmInfo.value?.isLoaded ? 'モデルをアンロードしています...' : 'モデルをロードしています...',
  });

  try {
    const apiInstance = await getApiInstance();
    if (activeAivmInfo.value?.isLoaded) {
      await apiInstance.invoke('unloadAivmAivmModelsAivmUuidUnloadPost')({ aivmUuid: activeAivmUuid.value });
    } else {
      await apiInstance.invoke('loadAivmAivmModelsAivmUuidLoadPost')({ aivmUuid: activeAivmUuid.value });
    }
  } catch (error) {
    console.error(error);
    if (error instanceof ResponseError) {
      void store.actions.SHOW_ALERT_DIALOG({
        type: 'error',
        title: activeAivmInfo.value?.isLoaded ? 'アンロード失敗' : 'ロード失敗',
        message: `音声合成モデル「${activeAivmInfo.value?.manifest.name}」の${activeAivmInfo.value?.isLoaded ? 'アンロード' : 'ロード'}に失敗しました。\n` +
                 `(HTTP Error ${error.response.status} / ${await error.response.text()})`,
      });
    } else {
      void store.actions.SHOW_ALERT_DIALOG({
        type: 'error',
        title: activeAivmInfo.value?.isLoaded ? 'アンロード失敗' : 'ロード失敗',
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        message: `音声合成モデル「${activeAivmInfo.value?.manifest.name}」の${activeAivmInfo.value?.isLoaded ? 'アンロード' : 'ロード'}に失敗しました。(${error})`,
      });
    }
  } finally {
    await store.actions.HIDE_ALL_LOADING_SCREEN();
    void getAivmInfos();  // 再取得
  }
};

// モデルをアップデートする
const updateAivmModel = async () => {
  if (activeAivmUuid.value == null) {
    throw new Error('aivm model is not selected');
  }

  const result = await store.actions.SHOW_CONFIRM_DIALOG({
    title: 'アップデートの確認',
    message: `音声合成モデル「${activeAivmInfo.value?.manifest.name}」を Version ${activeAivmInfo.value?.latestVersion} へアップデートしますか？\n` +
             'アップデート後、前のバージョンに戻すことはできません。',
    actionName: 'アップデート',
  });

  if (result === 'OK') {
    void store.actions.SHOW_LOADING_SCREEN({
      message: 'アップデートしています...',
    });

    try {
      const apiInstance = await getApiInstance();
      await apiInstance.invoke('updateAivmAivmModelsAivmUuidUpdatePost')({ aivmUuid: activeAivmUuid.value });
      // アップデート成功時の処理
      // 話者・スタイル一覧を再読み込み
      await store.actions.LOAD_CHARACTER({ engineId: store.getters.DEFAULT_ENGINE_ID });
      await store.actions.LOAD_DEFAULT_STYLE_IDS();
      // プリセットを再作成
      await store.actions.CREATE_ALL_DEFAULT_PRESET();
      void store.actions.SHOW_ALERT_DIALOG({
        title: 'アップデート完了',
        message: '音声合成モデルが正常にアップデートされました。',
      });
    } catch (error) {
      console.error(error);
      if (error instanceof ResponseError) {
        void store.actions.SHOW_ALERT_DIALOG({
          type: 'error',
          title: 'アップデート失敗',
          message: `音声合成モデル「${activeAivmInfo.value?.manifest.name}」のアップデートに失敗しました。\n` +
                   `(HTTP Error ${error.response.status} / ${await error.response.text()})`,
        });
      } else {
        // assert characterInfo !== undefined エラーを無視
        if (error instanceof Error && error.message === 'assert characterInfo !== undefined') {
          // アップデート成功時の処理を実行
          await store.actions.LOAD_CHARACTER({ engineId: store.getters.DEFAULT_ENGINE_ID });
          await store.actions.LOAD_DEFAULT_STYLE_IDS();
          await store.actions.CREATE_ALL_DEFAULT_PRESET();
        } else {
          void store.actions.SHOW_ALERT_DIALOG({
            type: 'error',
            title: 'アップデート失敗',
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            message: `音声合成モデル「${activeAivmInfo.value?.manifest.name}」のアップデートに失敗しました。(${error})`,
          });
        }
      }
    } finally {
      await store.actions.HIDE_ALL_LOADING_SCREEN();
      void getAivmInfos();  // 再取得
    }
  }
};

// コンポーネントがアンマウントされる時に音声を停止し、イベントリスナーを削除する
onUnmounted(() => {
  Object.values(audioElements).forEach(audio => {
    audio.pause();
    audio.currentTime = 0;
    audio.removeEventListener('ended', () => {});
  });
});

</script>
<style lang="scss" scoped>

@use "@/styles/colors" as colors;
@use "@/styles/variables" as vars;

.q-item--active {
  background: rgba(colors.$primary-rgb, 0.4);
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
}

.sample-transcript {
  flex: 1 1 0;
  color: white;
  font-size: 13.50px;
  font-weight: 400;
  line-height: 1.6;
  word-wrap: break-word;
}

</style>