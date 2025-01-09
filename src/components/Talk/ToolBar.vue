<template>
  <QHeader class="q-py-sm">
    <QToolbar>
      <template v-for="button in buttons" :key="button.text">
        <div v-if="button.text === null && button.tag === 'SPACER_1'" class="spacer"></div>
        <div v-else-if="button.text === null && button.tag === 'SPACER_2'" class="spacer"></div>
        <div v-else-if="button.text === null && button.tag === 'SPACER_3'" class="spacer"></div>
        <QSpace v-else-if="button.text === null" />
        <QBtn
          v-else
          unelevated
          color="toolbar-button"
          textColor="toolbar-button-display"
          :class="[
            'text-no-wrap text-bold q-px-sm q-mr-sm',
            button.tag === 'PLAY' || button.tag === 'STOP' ? 'play-stop-button' : '',
          ]"
          :icon="button.icon"
          :disable="button.disable.value"
          @click="button.click"
          >
          <!-- {{ button.text }} -->
          <QTooltip
            :delay="150"
            :offset="[0, 8]"
            anchor="bottom middle"
            self="top middle"
            transitionShow="jump-down"
            transitionHide="jump-up"
            >
            {{ button.text }}
          </QTooltip>
        </QBtn>
      </template>
    </QToolbar>
  </QHeader>
</template>

<script setup lang="ts">
import { computed, ComputedRef } from "vue";
import {
  generateAndConnectAndSaveAudioWithDialog,
  multiGenerateAndSaveAudioWithDialog,
  generateAndSaveOneAudioWithDialog,
} from "@/components/Dialog/Dialog";
import { useAnalytics } from "@/composables/useAnalytics";
import { useStore } from "@/store";
import { ToolbarButtonTagType } from "@/type/preload";
import { getToolbarButtonName, getToolbarButtonIcon } from "@/store/utility";
import { useHotkeyManager } from "@/plugins/hotkeyPlugin";
import { handlePossiblyNotMorphableError } from "@/store/audioGenerate";

type ButtonContent = {
  tag: ToolbarButtonTagType;
  text: string;
  icon: string;
  click(): void;
  disable: ComputedRef<boolean>;
};

type SpacerContent = {
  tag: ToolbarButtonTagType;
  text: null;
};

const store = useStore();

const uiLocked = computed(() => store.getters.UI_LOCKED);
const editor = "talk";
const canUndo = computed(() => store.getters.CAN_UNDO(editor));
const canRedo = computed(() => store.getters.CAN_REDO(editor));
const activeAudioKey = computed(() => store.getters.ACTIVE_AUDIO_KEY);
const nowPlayingContinuously = computed(
  () => store.state.nowPlayingContinuously,
);

const { registerHotkeyWithCleanup } = useHotkeyManager();
registerHotkeyWithCleanup({
  editor,
  name: "元に戻す",
  callback: () => {
    if (!uiLocked.value && canUndo.value) {
      undo(true);
    }
  },
});
registerHotkeyWithCleanup({
  editor,
  name: "やり直す",
  callback: () => {
    if (!uiLocked.value && canRedo.value) {
      redo(true);
    }
  },
});

registerHotkeyWithCleanup({
  editor,
  name: "連続再生/停止",
  callback: () => {
    if (!uiLocked.value) {
      if (nowPlayingContinuously.value) {
        stop();
      } else {
        void playContinuously(true);
      }
    }
  },
});

const trackToolbarAction = (actionName: string) => {
  void useAnalytics().trackEvent("aisp_toolbar_button_click", {
    action: actionName,
  });
};

const undo = (fromHotkey: boolean = false) => {
  if (fromHotkey === false) {
    trackToolbarAction("undo");
  }
  void store.actions.UNDO({ editor });
};
const redo = (fromHotkey: boolean = false) => {
  if (fromHotkey === false) {
    trackToolbarAction("redo");
  }
  void store.actions.REDO({ editor });
};
const playContinuously = async (fromHotkey: boolean = false) => {
  if (fromHotkey === false) {
    trackToolbarAction("play_continuously");
  }
  try {
    await store.actions.PLAY_CONTINUOUSLY_AUDIO();
  } catch (e) {
    const msg = handlePossiblyNotMorphableError(e);
    void store.actions.SHOW_ALERT_DIALOG({
      title: "再生に失敗しました",
      message: msg ?? "音声合成エンジンの再起動をお試しください。",
    });
  }
};
const play = async () => {
  if (activeAudioKey.value == undefined)
    throw new Error("activeAudioKey is undefined");
  trackToolbarAction("play");
  try {
    await store.actions.PLAY_AUDIO({
      audioKey: activeAudioKey.value,
    });
  } catch (e) {
    const msg = handlePossiblyNotMorphableError(e);
    void store.actions.SHOW_ALERT_DIALOG({
      title: "再生に失敗しました",
      message: msg ?? "音声合成エンジンの再起動をお試しください。",
    });
  }
};
const stop = () => {
  trackToolbarAction("stop");
  void store.actions.STOP_AUDIO();
};
const generateAndSaveSelectedAudio = async () => {
  if (activeAudioKey.value == undefined)
    throw new Error("activeAudioKey is undefined");

  const selectedAudioKeys = store.getters.SELECTED_AUDIO_KEYS;
  trackToolbarAction("generate_selected_audio");

  if (
    store.state.experimentalSetting.enableMultiSelect &&
    selectedAudioKeys.length > 1
  ) {
    await multiGenerateAndSaveAudioWithDialog({
      audioKeys: selectedAudioKeys,
      actions: store.actions,
      disableNotifyOnGenerate: store.state.confirmedTips.notifyOnGenerate,
    });
  } else {
    await generateAndSaveOneAudioWithDialog({
      audioKey: activeAudioKey.value,
      disableNotifyOnGenerate: store.state.confirmedTips.notifyOnGenerate,
      actions: store.actions,
    });
  }
};
const generateAndSaveAllAudio = async () => {
  trackToolbarAction("generate_all_audio");
  await multiGenerateAndSaveAudioWithDialog({
    audioKeys: store.state.audioKeys,
    actions: store.actions,
    disableNotifyOnGenerate: store.state.confirmedTips.notifyOnGenerate,
  });
};
const generateAndConnectAndSaveAudio = async () => {
  trackToolbarAction("generate_connect_audio");
  await generateAndConnectAndSaveAudioWithDialog({
    actions: store.actions,
    disableNotifyOnGenerate: store.state.confirmedTips.notifyOnGenerate,
  });
};
const saveProject = async () => {
  trackToolbarAction("save_project");
  await store.actions.SAVE_PROJECT_FILE({ overwrite: true });
};
const importTextFile = () => {
  trackToolbarAction("import_text");
  void store.actions.COMMAND_IMPORT_FROM_FILE({ type: "dialog" });
};

const usableButtons: Record<
  ToolbarButtonTagType,
  Omit<ButtonContent, "tag" | "text" | "icon"> | null
> = {
  PLAY_CONTINUOUSLY: {
    click: playContinuously,
    disable: uiLocked,
  },
  PLAY: {
    click: play,
    disable: computed(() => !activeAudioKey.value || uiLocked.value),
  },
  STOP: {
    click: stop,
    disable: computed(() => !store.getters.NOW_PLAYING),
  },
  EXPORT_AUDIO_SELECTED: {
    click: generateAndSaveSelectedAudio,
    disable: computed(() => !activeAudioKey.value || uiLocked.value),
  },
  EXPORT_AUDIO_ALL: {
    click: generateAndSaveAllAudio,
    disable: uiLocked,
  },
  EXPORT_AUDIO_CONNECT_ALL: {
    click: generateAndConnectAndSaveAudio,
    disable: uiLocked,
  },
  SAVE_PROJECT: {
    click: saveProject,
    disable: uiLocked,
  },
  UNDO: {
    click: undo,
    disable: computed(() => !canUndo.value || uiLocked.value),
  },
  REDO: {
    click: redo,
    disable: computed(() => !canRedo.value || uiLocked.value),
  },
  IMPORT_TEXT: {
    click: importTextFile,
    disable: uiLocked,
  },
  EMPTY: null,
  SPACER_1: null,
  SPACER_2: null,
  SPACER_3: null,
};

const buttons = computed(() =>
  store.state.toolbarSetting.map<ButtonContent | SpacerContent>((tag) => {
    const buttonContent = usableButtons[tag];
    if (buttonContent) {
      return {
        ...buttonContent,
        tag: tag,
        icon: getToolbarButtonIcon(tag),
        text: getToolbarButtonName(tag),
      };
    } else {
      return {
        tag: tag,
        text: null,
      };
    }
  }),
);
</script>

<style lang="scss">
.play-stop-button .material-symbols-rounded {
  font-variation-settings: 'FILL' 1, 'wght' 300, 'GRAD' 200, 'opsz' 24 !important;
}
</style>

<style lang="scss" scoped>

.spacer {
  height: 36px;
  margin-right: 8px;
  border-left: 2px solid var(--color-splitter);
}

</style>
