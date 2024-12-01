<!-- eslint-disable prettier/prettier -->
<template>
  <QDialog
    v-model="modelValueComputed"
    maximized
    transitionShow="jump-up"
    transitionHide="jump-down"
    class="accept-retrieve-telemetry-dialog transparent-backdrop"
  >
    <QLayout container view="hHh Lpr lff" class="bg-background">
      <QHeader class="q-py-sm">
        <QToolbar>
          <div class="column">
            <QToolbarTitle class="text-display"
              >使いやすさ向上のためのお願い</QToolbarTitle
            >
          </div>

          <QSpace />

          <div class="row items-center no-wrap">
            <QBtn
              outline
              label="拒否"
              icon="sym_r_close"
              color="toolbar-button"
              textColor="toolbar-button-display"
              class="text-no-wrap q-mr-md text-bold"
              @click="handler(false)"
            />

            <QBtn
              outline
              label="許可"
              icon="sym_r_done"
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
          <p class="text-body1 q-mb-sm">
            AivisSpeech は、より使いやすいソフトウェアを目指して開発されています。<br />
          </p>
          <p class="text-body1 q-mb-sm">
            ボタンの配置換えなどの方針を決める際は、各UIの利用率などの情報が重要になります。<br />
            もしよろしければ、ソフトウェアの利用状況のデータ収集にご協力をお願いします。<br />
          </p>
          <p class="text-body1 q-mb-xl">
            入力されたテキストデータや音声データの情報は収集しておりませんので、ご安心ください。<br />
          </p>
          <QCard flat bordered>
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div class="markdown markdown-body q-pa-lg" v-html="privacyPolicy"></div>
          </QCard>
        </QPage>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import { useStore } from "@/store";
import { useMarkdownIt } from "@/plugins/markdownItPlugin";

const props = defineProps<{
  modelValue: boolean;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();

const store = useStore();

const modelValueComputed = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

const handler = (acceptRetrieveTelemetry: boolean) => {
  void store.actions.SET_ACCEPT_RETRIEVE_TELEMETRY({
    acceptRetrieveTelemetry: acceptRetrieveTelemetry ? "Accepted" : "Refused",
  });

  modelValueComputed.value = false;
};

const md = useMarkdownIt();
const privacyPolicy = ref("");
onMounted(async () => {
  privacyPolicy.value = md.render(
    await store.actions.GET_PRIVACY_POLICY_TEXT(),
  );
});
</script>

<style scoped lang="scss">
.q-page {
  padding: 3rem;
}
</style>
