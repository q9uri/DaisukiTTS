import { ref } from "vue";
import ga4mp, { GA4Instance } from "@analytics-debugger/ga4mp";

const GA4_MEASUREMENT_ID = "G-TEMWCS6D7B";
const enabled = ref(false);
const ga4track: GA4Instance = ga4mp([GA4_MEASUREMENT_ID], {
  debug: import.meta.env.DEV,
  non_personalized_ads: true,
});

/**
 * Google Analytics 4 を Electron で使うための composable
 * ref: https://ga4mp.dev/#/
 */
export function useAnalytics() {
  const enable = () => {
    enabled.value = true;
  };

  const disable = () => {
    enabled.value = false;
  };

  const trackEvent = (
    eventName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    eventParameters?: Record<string, any>,
  ) => {
    if (!enabled.value) return;
    ga4track.trackEvent(eventName, eventParameters);
  };

  return {
    enable,
    disable,
    trackEvent,
  };
}
