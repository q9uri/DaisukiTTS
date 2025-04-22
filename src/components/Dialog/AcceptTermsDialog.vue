<template>
  <QDialog
    v-model="dialogOpened"
    maximized
    transitionShow="jump-up"
    transitionHide="jump-down"
    class="accept-terms-dialog transparent-backdrop"
  >
    <QLayout container view="hHh Lpr lff" class="bg-background">
      <QHeader class="q-py-sm">
        <QToolbar>
          <div class="column">
            <QToolbarTitle class="text-display">ライセンス情報</QToolbarTitle>
          </div>

          <QSpace />

          <div class="row items-center no-wrap">
            <QBtn
              outline
              label="同意せずに終了"
              icon="sym_r_close"
              color="toolbar-button"
              textColor="toolbar-button-display"
              class="text-no-wrap q-mr-md text-bold"
              @click="handler(false)"
            />

            <QBtn
              outline
              label="同意してはじめる"
              icon="sym_r_power_settings_new"
              color="toolbar-button"
              textColor="toolbar-button-display"
              class="text-no-wrap text-bold"
              @click="handler(true)"
            />
          </div>
        </QToolbar>
      </QHeader>

      <QPageContainer>
        <QPage>
          <QCard flat bordered>
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div class="q-pa-md markdown markdown-body" v-html="terms"></div>
          </QCard>
        </QPage>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useStore } from "@/store";
import { useMarkdownIt } from "@/plugins/markdownItPlugin";

const dialogOpened = defineModel<boolean>("dialogOpened", { default: false });

const store = useStore();

const handler = (acceptTerms: boolean) => {
  void store.actions.SET_ACCEPT_TERMS({
    acceptTerms: acceptTerms ? "Accepted" : "Rejected",
  });
  if (!acceptTerms) {
    void store.actions.CHECK_EDITED_AND_NOT_SAVE({ closeOrReload: "close" });
  }

  dialogOpened.value = false;
};

const md = useMarkdownIt();
const terms = ref("");
onMounted(async () => {
  terms.value = md.render(await store.actions.GET_POLICY_TEXT());
});
</script>

<style scoped lang="scss">
.q-page {
  padding: 3rem;
}
</style>
