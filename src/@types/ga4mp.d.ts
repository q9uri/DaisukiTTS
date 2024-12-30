// ref: https://github.com/analytics-debugger/ga4mp/blob/main/src/ga4mp.js
/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "@analytics-debugger/ga4mp" {
  type GA4Config = {
    client_id?: string;
    session_id?: string;
    session_number?: number;
    user_id?: string;
    user_ip_address?: string;
    user_agent?: string;
    debug?: boolean;
    non_personalized_ads?: boolean;
    mode?: "browser" | "node";
    queueDispatchTime?: number;
    queueDispatchMaxEvents?: number;
  };

  type GA4Instance = {
    version: string;
    mode: string;
    getHitIndex: () => number;
    getSessionId: () => string;
    getClientId: () => string;
    setUserProperty: (key: string, value: string | number) => void;
    setEventsParameter: (key: string, value: string | number | (() => any)) => void;
    setUserId: (value: string) => void;
    trackEvent: (
      eventName: string,
      eventParameters?: Record<string, any>,
      sessionControl?: Record<string, any>,
      forceDispatch?: boolean,
    ) => void;
  };

  export default function ga4mp(
    measurement_ids: string | string[],
    config?: GA4Config,
  ): GA4Instance;
}
