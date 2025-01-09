<template>
  <QPage class="relative-absolute-wrapper scroller bg-background">
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div class="q-pa-md markdown markdown-body" v-html="howToUse"></div>
  </QPage>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useStore } from "@/store";
import { useMarkdownIt } from "@/plugins/markdownItPlugin";

const store = useStore();
const howToUse = ref("");
const md = useMarkdownIt();
onMounted(async () => {
  howToUse.value = md.render(await store.actions.GET_HOW_TO_USE_TEXT());
});
</script>

<style scoped lang="scss">
.root {
  .scroller {
    width: 100%;
    overflow: auto;
  }
}

.markdown :deep(img) {
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 7px;
  vertical-align: middle;
  margin-bottom: 1rem;
}
</style>
