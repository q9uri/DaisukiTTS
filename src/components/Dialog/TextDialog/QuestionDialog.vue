<!--
  質問ダイアログ。
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
      <QCardSection class="question-dialog-title">
        <QIcon
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
        <QSpace />
        <QBtn
          v-for="(buttonObject, index) in buttonObjects"
          ref="buttons"
          :key="index"
          :flat="index !== props.buttons.length - 1"
          :outline="index === props.buttons.length - 1"
          :label="buttonObject.text"
          :color="buttonObject.color"
          :textColor="buttonObject.color"
          class="text-no-wrap text-bold"
          :style="index === props.buttons.length - 1 ? { padding: '0px 16px !important' } : undefined"
          @click="onClick(index)"
        />
      </QCardActions>
    </QCard>
  </QDialog>
</template>

<script setup lang="ts">
import { QBtn, useDialogPluginComponent } from "quasar";
import { computed, onMounted, useTemplateRef } from "vue";
import { getIcon, getColor, DialogType } from "./common";

const modelValue = defineModel<boolean>({ default: false });
const props = withDefaults(
  defineProps<{
    type: DialogType;
    title: string;
    message: string;
    buttons: (string | { text: string; color: string })[];
    persistent?: boolean | undefined;
    default?: number | undefined;
  }>(),
  {
    persistent: true,
    default: undefined,
  },
);
defineEmits({
  ...useDialogPluginComponent.emitsObject,
});

const iconName = computed(() => getIcon(props.type));
const color = computed(() => getColor(props.type));
const buttonObjects = computed(() =>
  props.buttons.map((button) =>
    typeof button === "string" ? { text: button, color: "display" } : button,
  ),
);

const { dialogRef, onDialogOK, onDialogHide } = useDialogPluginComponent();

const buttonsRef = useTemplateRef<QBtn[]>("buttons");

onMounted(() => {
  if (props.default != undefined) {
    buttonsRef.value?.[props.default].$el.focus();
  }
  buttonClicked = false;
});

let buttonClicked = false;

const onClick = (index: number) => {
  if (buttonClicked) return;
  buttonClicked = true;
  onDialogOK({ index });
};
</script>

<style lang="scss">
.question-dialog-title .material-symbols-rounded {
  font-size: 1.9rem !important;
}
</style>

<style scoped lang="scss">
.question-dialog-title {
  display: flex;
  align-items: center;
}

.message {
  word-break: break-all;
  white-space: pre-wrap;
  line-height: 1.65;
}

// primary色のボタンのテキスト色は特別扱い
.q-btn.bg-primary {
  color: var(--color-display-on-primary) !important;
}
</style>
