<template>
  <QDialog v-model="dialogOpened">
    <QCard class="q-py-none dialog-card" style="padding: 0px 28px !important;">
      <QCardSection class="q-px-none q-py-lg">
        <div class="text-h5">アップデートがあります</div>
        <div class="text-body2 text-grey q-mt-sm">
          公式サイトから AivisSpeech の最新バージョンをダウンロードできます。
        </div>
      </QCardSection>

      <QSeparator />

      <QCardSection class="q-px-none scroll scrollable-area" style="padding: 20px 0px !important;">
        <template
          v-for="(info, infoIndex) of props.newUpdateInfos"
          :key="infoIndex"
        >
          <h3 class="version-title">バージョン {{ info.version }}</h3>
          <ul class="q-mb-none q-mt-sm">
            <template
              v-for="(item, descriptionIndex) of info.descriptions"
              :key="descriptionIndex"
            >
              <li>{{ item }}</li>
            </template>
          </ul>
        </template>
      </QCardSection>

      <QSeparator />

      <QCardActions class="q-px-none q-py-lg">
        <QSpace />
        <QBtn
          padding="xs md"
          icon="sym_r_close"
          label="閉じる"
          unelevated
          color="surface"
          textColor="display"
          class="text-bold"
          @click="closeUpdateNotificationDialog()"
        />
        <!-- <QBtn
          padding="xs md"
          label="このバージョンをスキップ"
          unelevated
          color="surface"
          textColor="display"
          class="text-bold"
          @click="
            emit('skipThisVersionClick', props.latestVersion);
            closeUpdateNotificationDialog();
          "
        /> -->
        <QBtn
          padding="xs md"
          icon="sym_r_download"
          label="最新バージョンをダウンロード"
          unelevated
          color="primary"
          textColor="display-on-primary"
          class="text-bold"
          @click="
            openOfficialWebsite();
            closeUpdateNotificationDialog();
          "
        />
      </QCardActions>
    </QCard>
  </QDialog>
</template>

<script setup lang="ts">
import { UpdateInfo } from "@/type/preload";

const dialogOpened = defineModel<boolean>("dialogOpened", { default: false });
const props = defineProps<{
  /** 公開されている最新のバージョン */
  latestVersion: string;
  /** 表示するアップデート情報 */
  newUpdateInfos: UpdateInfo[];
}>();
defineEmits<{
  /** スキップするときに呼ばれる */
  (e: "skipThisVersionClick", version: string): void;
}>();

const closeUpdateNotificationDialog = () => {
  dialogOpened.value = false;
};

const openOfficialWebsite = () => {
  window.open(import.meta.env.VITE_OFFICIAL_WEBSITE_URL, "_blank");
};
</script>

<style scoped lang="scss">
@use "@/styles/colors" as colors;

.dialog-card {
  width: 700px;
  max-width: 80vw;
}

.scrollable-area {
  overflow-y: auto;
  max-height: 50vh;

  :deep() {
    h3 {
      font-size: 1.3rem;
      font-weight: bold;
      margin: 0;
    }
  }

  .version-title {
    line-height: 1.5;
    margin-top: 16px !important;

    &:first-child {
      margin-top: 0 !important;
    }
  }

  li {
    margin-top: 4px !important;

    &:first-child {
      margin-top: 0 !important;
    }
  }
}

</style>
