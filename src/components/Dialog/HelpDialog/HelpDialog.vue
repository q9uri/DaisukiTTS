<template>
  <QDialog
    v-model="dialogOpened"
    maximized
    transitionShow="jump-up"
    transitionHide="jump-down"
    class="help-dialog transparent-backdrop"
  >
    <QLayout container view="hHh Lpr lff">
      <QDrawer
        bordered
        showIfAbove
        class="bg-background"
        :modelValue="true"
        :width="250"
        :breakpoint="0"
      >
        <div class="column full-height">
          <QList>
            <template v-for="(page, pageIndex) of pagedata" :key="pageIndex">
              <QItem
                v-if="page.type === 'item'"
                v-ripple
                clickable
                activeClass="selected-item"
                :active="selectedPageIndex === pageIndex"
                @click="selectedPageIndex = pageIndex"
              >
                <QItemSection> {{ page.name }} </QItemSection>
              </QItem>
              <template v-else-if="page.type === 'separator'">
                <QSeparator />
                <QItemLabel header>{{ page.name }}</QItemLabel>
              </template>
            </template>
          </QList>
        </div>
      </QDrawer>

      <QPageContainer>
        <QPage>
          <QTabPanels v-model="selectedPageIndex">
            <QTabPanel
              v-for="(page, pageIndex) of pagedata"
              :key="pageIndex"
              :name="pageIndex"
              class="q-pa-none"
            >
              <div v-if="page.type === 'item'" class="root">
                <QHeader class="q-py-sm">
                  <QToolbar>
                    <!-- close button -->
                    <QBtn
                      round
                      flat
                      icon="sym_r_close"
                      color="display"
                      aria-label="ヘルプを閉じる"
                      @click="dialogOpened = false"
                    />
                    <QToolbarTitle class="text-display"> ヘルプ </QToolbarTitle>
                    <QBtn
                      v-if="page.component === ContactInfo"
                      outline
                      icon="sym_r_description"
                      label="ログフォルダを開く"
                      textColor="display"
                      class="text-no-wrap text-bold q-mr-sm"
                      @click="openLogDirectory"
                    />
                    <QBtn
                      v-if="page.component === ContactInfo"
                      outline
                      icon="sym_r_description"
                      label="音声合成エンジンのログフォルダを開く"
                      textColor="display"
                      class="text-no-wrap text-bold q-mr-sm"
                      @click="openDefaultEngineLogDirectory"
                    />
                  </QToolbar>
                </QHeader>
                <Component :is="page.component" v-bind="page.props" />
              </div>
            </QTabPanel>
          </QTabPanels>
        </QPage>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { Component } from "vue";
import HelpPolicy from "./HelpPolicy.vue";
import LibraryPolicy from "./HelpLibraryPolicySection.vue";
import HowToUse from "./HowToUse.vue";
import OssLicense from "./OssLicense.vue";
import UpdateInfo from "./UpdateInfo.vue";
import QAndA from "./QAndA.vue";
import ContactInfo from "./ContactInfo.vue";
import { UpdateInfo as UpdateInfoObject, UrlString } from "@/type/preload";
import { useStore } from "@/store";
import { useFetchNewUpdateInfos } from "@/composables/useFetchNewUpdateInfos";
import { createLogger } from "@/helpers/log";
import { getAppInfos } from "@/domain/appInfo";

type PageItem = {
  type: "item";
  name: string;
  parent?: string;
  component: Component;
  props?: Record<string, unknown>;
  shouldShowOpenLogDirectoryButton?: boolean;
};
type PageSeparator = {
  type: "separator";
  name: string;
};
type PageData = PageItem | PageSeparator;

const dialogOpened = defineModel<boolean>("dialogOpened", { default: false });

// エディタのアップデート確認
const store = useStore();
const { warn } = createLogger("HelpDialog");

const updateInfos = ref<UpdateInfoObject[]>();
void store.actions.GET_UPDATE_INFOS().then((obj) => (updateInfos.value = obj));

if (!import.meta.env.VITE_LATEST_UPDATE_INFOS_URL) {
  throw new Error(
    "環境変数VITE_LATEST_UPDATE_INFOS_URLが設定されていません。.envに記載してください。",
  );
}
const newUpdateResult = useFetchNewUpdateInfos(
  () => getAppInfos().version,
  UrlString(import.meta.env.VITE_LATEST_UPDATE_INFOS_URL),
);

// エディタのOSSライセンス取得
const licenses = ref<Record<string, string>[]>();
void store.actions.GET_OSS_LICENSES().then((obj) => (licenses.value = obj));

const policy = ref<string>("");
void store.actions.GET_POLICY_TEXT().then((obj) => (policy.value = obj));

const howToUse = ref<string>("");
void store.actions.GET_HOW_TO_USE_TEXT().then((obj) => (howToUse.value = obj));

const ossCommunityInfos = ref<string>("");
void store.actions
  .GET_OSS_COMMUNITY_INFOS()
  .then((obj) => (ossCommunityInfos.value = obj));

const qAndA = ref<string>("");
void store.actions.GET_Q_AND_A_TEXT().then((obj) => (qAndA.value = obj));

const contact = ref<string>("");
void store.actions.GET_CONTACT_TEXT().then((obj) => (contact.value = obj));

const pagedata = computed(() => {
  const data: PageData[] = [
    {
      type: "item",
      name: "使い方",
      component: HowToUse,
    },
    {
      type: "item",
      name: "よくある質問 / Q&A",
      component: QAndA,
    },
    {
      type: "item",
      name: "お問い合わせ",
      component: ContactInfo,
    },
    {
      type: "item",
      name: "音声合成モデルのライセンス",
      component: LibraryPolicy,
    },
    {
      type: "item",
      name: "アップデート情報",
      component: UpdateInfo,
      props: {
        downloadLink: import.meta.env.VITE_OFFICIAL_WEBSITE_URL,
        updateInfos: updateInfos.value,
        ...(newUpdateResult.value.status == "updateAvailable"
          ? {
            isUpdateAvailable: true,
            latestVersion: newUpdateResult.value.latestVersion,
          }
          : {
            isUpdateAvailable: false,
            latestVersion: "",
          }),
      },
    },
    {
      type: "item",
      name: "ライセンス情報",
      component: HelpPolicy,
      props: {
        policy: policy.value,
      },
    },
    {
      type: "item",
      name: "オープンソースライセンス",
      component: OssLicense,
      props: {
        licenses: licenses.value,
      },
    },
  ];
  for (const id of store.getters.GET_SORTED_ENGINE_INFOS.map((m) => m.uuid)) {
    const manifest = store.state.engineManifests[id];
    if (!manifest) {
      warn(`manifest not found: ${id}`);
      continue;
    }

    data.push(
      {
        type: "separator",
        name: manifest.name,
      },
      {
        type: "item",
        name: "アップデート情報",
        parent: manifest.name,
        component: UpdateInfo,
        props: {
          updateInfos: manifest.updateInfos,
          // TODO: エンジン側で最新バージョンチェックAPIが出来たら実装する。
          //       https://github.com/VOICEVOX/voicevox_engine/issues/476
          isUpdateAvailable: false,
        },
      },
      {
        type: "item",
        name: "ライセンス情報",
        parent: manifest.name,
        component: HelpPolicy,
        props: {
          policy: manifest.termsOfService,
        },
      },
      {
        type: "item",
        name: "オープンソースライセンス",
        parent: manifest.name,
        component: OssLicense,
        props: {
          licenses: manifest.dependencyLicenses,
        },
      },
    );
  }
  return data;
});

const selectedPageIndex = ref(0);

// const selectedPage = computed(() => {
//   if (pagedata.value[selectedPageIndex.value].type == "item") {
//     return pagedata.value[selectedPageIndex.value] as PageItem;
//   } else {
//     throw new Error("selectedPageにはPageItem型の値を指定してください。");
//   }
// });

const openLogDirectory = () => window.backend.openLogDirectory();
const openDefaultEngineLogDirectory = () => window.backend.openDefaultEngineLogDirectory();
</script>

<style scoped lang="scss">
@use "@/styles/colors" as colors;

.help-dialog .q-layout-container :deep(.absolute-full) {
  right: 0 !important;
  .scroll {
    left: unset !important;
    right: unset !important;
    width: unset !important;
    max-height: unset;
  }
}

.selected-item {
  background-color: hsl(206 66% 32% / 1);
  border-right: 4px solid colors.$primary;
  color: colors.$display;
}

.q-item__label {
  padding: 8px 16px;
}
</style>
