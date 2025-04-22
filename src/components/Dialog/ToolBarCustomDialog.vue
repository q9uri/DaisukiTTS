<template>
  <QDialog
    v-model="dialogOpened"
    maximized
    transitionShow="jump-up"
    transitionHide="jump-down"
    class="tool-bar-custom-dialog transparent-backdrop"
  >
    <QLayout container view="hHh Lpr fFf" class="bg-background">
      <QPageContainer class="root">
        <QHeader class="q-py-sm">
          <QToolbar>
            <!-- close button -->
            <QBtn
              round
              flat
              icon="sym_r_close"
              color="display"
              @click="finishOrNotDialog"
            />
            <QToolbarTitle class="text-display">
              ツールバーのカスタマイズ
            </QToolbarTitle>
            <QBtn
              outline
              icon="sym_r_settings_backup_restore"
              label="デフォルトに戻す"
              textColor="warning"
              class="text-no-wrap text-bold q-mr-sm"
              :disable="isDefault"
              @click="applyDefaultSetting"
            />
            <QBtn
              outline
              icon="sym_r_save"
              label="保存"
              textColor="display"
              class="text-no-wrap text-bold q-mr-sm"
              :disable="!isChanged"
              @click="saveCustomToolbar"
            />
          </QToolbar>
        </QHeader>
        <QPage>
          <QCard flat square class="preview-card">
            <QToolbar class="bg-toolbar preview-toolbar">
              <Draggable
                v-model="toolbarButtons"
                :itemKey="toolbarButtonKey"
                @start="toolbarButtonDragging = true"
                @end="toolbarButtonDragging = false"
              >
                <template
                  #item="{ element: button }: { element: ToolbarButtonTagType }"
                >
                  <QBtn
                    unelevated
                    color="toolbar-button"
                    textColor="toolbar-button-display"
                    :icon="getToolbarButtonIcon(button)"
                    :class="
                      (button === 'EMPTY' ? ' radio-space' : ' radio') +
                      ((button === 'PLAY' || button === 'STOP') ? ' play-stop-button' : '') +
                      (button.startsWith('SPACER') ? ' spacer' : '') +
                      ' text-no-wrap text-bold q-px-sm q-mr-sm'
                    "
                  >
                    <!-- {{ getToolbarButtonName(button) }} -->
                    <QTooltip
                      :delay="150"
                      :offset="[0, 8]"
                      anchor="bottom middle"
                      self="top middle"
                      transitionShow="jump-down"
                      transitionHide="jump-up"
                      :style="{
                        display: toolbarButtonDragging ? 'none' : 'block',
                      }"
                      >{{ usableButtonsDesc[button] }}</QTooltip
                    >
                  </QBtn>
                </template>
              </Draggable>
              <div class="preview-toolbar-drag-hint">
                上のボタンをドラッグして、ボタンの順序を並び替えできます。
              </div>
            </QToolbar>

            <QCardActions>
              <div class="text-h5 q-pl-sm q-mt-sm q-mb-sm">
                表示するボタンの選択
              </div>
            </QCardActions>
            <QCardActions class="no-padding">
              <QList class="usable-button-list bg-surface-darken">
                <QItem
                  v-for="(desc, key) in usableButtonsDesc"
                  :key
                  v-ripple
                  tag="label"
                >
                  <QItemSection>
                    <QItemLabel>{{ getToolbarButtonName(key) }}</QItemLabel>
                    <QItemLabel caption>{{ desc }}</QItemLabel>
                  </QItemSection>
                  <QItemSection avatar>
                    <QToggle v-model="toolbarButtons" :val="key" />
                  </QItemSection>
                </QItem>
              </QList>
            </QCardActions>
          </QCard>
        </QPage>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch, Ref } from "vue";
import Draggable from "vuedraggable";
import { useStore } from "@/store";
import { ToolbarButtonTagType, ToolbarSettingType } from "@/type/preload";
import { getToolbarButtonName, getToolbarButtonIcon } from "@/store/utility";

const dialogOpened = defineModel<boolean>("dialogOpened", { default: false });

const store = useStore();

// computedだと値の編集ができないが、refにすると起動時に読み込まれる設定が反映されないので、watchしている
const toolbarButtons = ref([...store.state.toolbarSetting]);
const toolbarButtonKey = (button: ToolbarButtonTagType) => button;
const toolbarButtonDragging = ref(false);
const selectedButton: Ref<ToolbarButtonTagType | undefined> = ref(
  toolbarButtons.value[0],
);
watch(
  () => store.state.toolbarSetting,
  (newData) => {
    // このwatchはToolbar Setting更新時にも機能するが、
    // 以下の処理はAivisSpeech起動時のみ機能してほしいので、toolbarButtonsのlengthが0の時だけ機能させる
    if (!toolbarButtons.value.length) {
      toolbarButtons.value = [...newData];
      selectedButton.value = newData[0];
    }
  },
);

const defaultSetting: ToolbarSettingType = [];
void window.backend.getDefaultToolbarSetting().then((setting) => {
  defaultSetting.push(...setting);
});

// const toggleToolbarButtons = (key: ToolbarButtonTagType) => {
//   if (toolbarButtons.value.includes(key)) {
//     toolbarButtons.value.splice(toolbarButtons.value.indexOf(key), 1);
//   } else {
//     toolbarButtons.value.push(key);
//   }
// };

const usableButtonsDesc: Record<ToolbarButtonTagType, string> = {
  UNDO: "操作を一つ戻します。",
  REDO: "元に戻した操作をやり直します。",
  SAVE_PROJECT: "プロジェクトを上書き保存します。",
  PLAY_CONTINUOUSLY:
    "選択されているテキスト以降のすべてのテキストを読み上げます。",
  PLAY: "選択されているテキストを読み上げます。",
  STOP: "テキストが読み上げられているときに、それを止めます。",
  EXPORT_AUDIO_SELECTED:
    "選択されているテキストの読み上げを音声ファイルに書き出します。",
  EXPORT_AUDIO_ALL:
    "入力されているすべてのテキストの読み上げを音声ファイルに書き出します。",
  EXPORT_AUDIO_CONNECT_ALL:
    "入力されているすべてのテキストの読み上げを一つの音声ファイルにつなげて書き出します。",
  IMPORT_TEXT: "テキストファイル (.txt) を読み込みます。",
  EMPTY:
    "これはボタンではありません。レイアウトの調整に使います。また、実際には表示されません。",
  SPACER_1: "これはボタンではありません。区切りの挿入に使います。また、実際には表示されません。",
  SPACER_2: "これはボタンではありません。区切りの挿入に使います。また、実際には表示されません。",
  SPACER_3: "これはボタンではありません。区切りの挿入に使います。また、実際には表示されません。",
};

const isChanged = computed(() => {
  const nowSetting = store.state.toolbarSetting;
  return (
    toolbarButtons.value.length != nowSetting.length ||
    toolbarButtons.value.some((e, i) => e != nowSetting[i])
  );
});
const isDefault = computed(() => {
  return (
    toolbarButtons.value.length == defaultSetting.length &&
    toolbarButtons.value.every((e, i) => e == defaultSetting[i])
  );
});

// ボタンが追加されたときはそれをフォーカスし、
// 削除されたときは一番最初のボタンをフォーカスするようにする
watch(
  () => toolbarButtons.value,
  (newData, oldData) => {
    if (oldData.length < newData.length) {
      selectedButton.value = newData[newData.length - 1];
    } else if (
      selectedButton.value != undefined &&
      oldData.includes(selectedButton.value) &&
      !newData.includes(selectedButton.value)
    ) {
      selectedButton.value = newData[0];
    }
  },
);

const applyDefaultSetting = async () => {
  const result = await store.actions.SHOW_WARNING_DIALOG({
    title: "ツールバーをデフォルトに戻しますか？",
    message: "今までのカスタマイズ内容は破棄されます。",
    actionName: "デフォルトに戻す",
    isWarningColorButton: true,
  });
  if (result === "OK") {
    toolbarButtons.value = [...defaultSetting];
    selectedButton.value = toolbarButtons.value[0];
  }
};
const saveCustomToolbar = () => {
  void store.actions.SET_TOOLBAR_SETTING({
    data: [...toolbarButtons.value],
  });
};

const finishOrNotDialog = async () => {
  if (isChanged.value) {
    const result = await store.actions.SHOW_WARNING_DIALOG({
      title: "カスタマイズを終了しますか？",
      message:
        "保存せずに終了すると、カスタマイズ内容は破棄されます。",
      actionName: "終了する",
      isWarningColorButton: true,
    });
    if (result === "OK") {
      toolbarButtons.value = [...store.state.toolbarSetting];
      selectedButton.value = toolbarButtons.value[0];
      dialogOpened.value = false;
    }
  } else {
    selectedButton.value = toolbarButtons.value[0];
    dialogOpened.value = false;
  }
};
</script>

<style lang="scss">
.play-stop-button .material-symbols-rounded {
  font-variation-settings: 'FILL' 1, 'wght' 300, 'GRAD' 200, 'opsz' 24 !important;
}
</style>

<style lang="scss" scoped>
@use "@/styles/variables" as vars;
@use "@/styles/colors" as colors;

.spacer {
  width: 0px;
  height: 36px;
  padding-top: 0px;
  padding-bottom: 0px;
  padding-left: 0px;
  padding-right: 8px;
  border-left: 2px solid var(--color-splitter);
  margin-right: 0px;
  background: transparent;
  border-radius: 0px;
}

.tool-bar-custom-dialog .q-layout-container :deep(.absolute-full) {
  right: 0 !important;
  overflow-x: hidden;

  > .scroll {
    width: unset !important;
    overflow: hidden;
  }
}

.preview-toolbar {
  height: calc(#{vars.$toolbar-height} + 16px);
  display: block;
}

// draggableのdiv。
.preview-toolbar > div:not(.preview-toolbar-drag-hint) {
  width: 100%;
  display: inline-flex;
}

.preview-toolbar-drag-hint {
  padding-top: 12px;
  padding-bottom: 12px;
}

.preview-card {
  width: 100%;
  min-width: 460px;
  background: var(--color-background);
}

.usable-button-list {
  // menubar-height + toolbar-height * 2(main+preview) + window-border-width
  // 52(preview part buttons) * 2 + 46(select part title) + 22(preview part hint)
  height: calc(
    100vh - #{vars.$menubar-height + (vars.$toolbar-height) +
      vars.$window-border-width + 52px + 46px + 46px}
  );
  width: 100%;
  overflow-y: scroll;
}

.radio {
  &:hover {
    cursor: grab;
  }
}

.radio-space {
  @extend .radio;
  flex-grow: 1;
  color: transparent;
}
</style>
