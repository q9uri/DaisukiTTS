import { watch } from "vue";
import { useAnalytics } from "./useAnalytics";

/**
 * ダイアログの表示状態の変更を GA4 でトラッキングするための composable
 */
export function useDialogAnalytics(
  dialogName: string,
  isOpen: { value: boolean },
) {
  const analytics = useAnalytics();

  watch(
    () => isOpen.value,
    (newValue) => {
      void analytics.trackEvent("aisp_dialog_state_change", {
        dialog: dialogName,
        state: newValue ? "opened" : "closed",
      });
    },
  );
}
