<!--
  メッセージダイアログ。
  QuasarのDialog Pluginから呼ぶことを想定。
  参照：https://quasar.dev/quasar-plugins/dialog
-->
<template>
  <QDialog
    ref="dialogRef"
    v-model="modelValue"
    :persistent
    @hide="onDialogHide"
  >
    <QCard class="q-py-sm q-px-sm dialog-card">
      <QCardSection class="message-dialog-title">
        <QIcon
          v-if="props.type !== 'none'"
          :name="`sym_r_${iconName}`"
          class="text-h5 q-mr-sm"
          :color
        />
        <div class="text-h5" :class="[`text-${color}`]">{{ props.title }}</div>
      </QCardSection>

      <QCardSection class="q-py-none message">
        {{ props.message }}
      </QCardSection>
      <QCardActions style="padding-top: 12px !important" align="right">
        <QBtn
          outline
          :label="props.ok"
          color="display"
          textColor="display"
          class="text-no-wrap text-bold q-mr-sm"
          :style="{ padding: '0px 16px !important' }"
          @click="onOk"
        />
      </QCardActions>
    </QCard>
  </QDialog>
</template>

<script setup lang="ts">
import { useDialogPluginComponent } from "quasar";
import { computed } from "vue";
import { DialogType, getColor, getIcon } from "./common";

const modelValue = defineModel<boolean>({ default: false });
const props = withDefaults(
  defineProps<{
    type: DialogType;
    title: string;
    message: string;
    ok?: string;
    persistent?: boolean;
  }>(),
  {
    ok: "OK",
    persistent: true,
  },
);

defineEmits({
  ...useDialogPluginComponent.emitsObject,
});

const iconName = computed(() => getIcon(props.type));
const color = computed(() => getColor(props.type));
const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();

function onOk() {
  onDialogOK();
}
</script>

<style lang="scss">
.message-dialog-title .material-symbols-rounded {
  font-size: 1.9rem !important;
}
</style>

<style scoped lang="scss">
.message-dialog-title {
  display: flex;
  align-items: center;
}

.message {
  word-break: break-all;
  white-space: pre-wrap;
  line-height: 1.65;
}
</style>
