import { ref } from "vue";
import ga4mp, { GA4Instance } from "@analytics-debugger/ga4mp";

const GA4_MEASUREMENT_ID = "G-TEMWCS6D7B";
const enabled = ref(false);
let ga4instance: GA4Instance | null = null;

// GA4 の LocalStorage キー
// 本家の Cookie 仕様に合わせている
// ref: https://www.bbccss.com/explanation-of-cookie-values-used-by-ga4.html
const GA4_CLIENT_ID_KEY = "_ga";
const GA4_SESSION_KEY = `_ga_${GA4_MEASUREMENT_ID.replace("G-", "")}`;

// セッションタイムアウト (30分、ミリ秒単位)
// ref: 公式のデフォルト値は30分
const SESSION_TIMEOUT = 30 * 60 * 1000;

type GA4SessionData = {
  session_id: string;
  session_count: number;
  session_start: number;
  engagement: 0 | 1;
};

/**
 * GA4 形式のクライアント ID を取得または新規作成する
 * GA4MP で必要な形式 ({random}.{timestamp}) でクライアント ID を返す
 */
function getOrCreateClientId(): string {
  const randomInt = () => Math.floor(Math.random() * (2147483647 - 0 + 1) + 0);
  const timestampInSeconds = () => Math.floor(Date.now() / 1000);

  const storedClientId = localStorage.getItem(GA4_CLIENT_ID_KEY);
  if (storedClientId) {
    // LocalStorage に保存されている GA4 形式のクライアント ID を解析し、
    // GA4MP で必要な形式 ({random}.{timestamp}) で返す
    // Format: GA1.1.{random}.{timestamp}
    const [, , random, timestamp] = storedClientId.split(".");
    return `${random}.${timestamp}`;
  }

  // 新しいクライアント ID を新規作成し、LocalStorage に保存する
  const randomNumber = randomInt();
  const timestamp = timestampInSeconds();
  const clientId = `${randomNumber}.${timestamp}`;
  localStorage.setItem(GA4_CLIENT_ID_KEY, `GA1.1.${clientId}`);

  // GA4MP で必要な形式 ({random}.{timestamp}) で返す (GA1 から始まるヘッダは含まない)
  return clientId;
}

/**
 * GA4 のセッションデータを解析する
 */
function parseGA4SessionString(sessionStr: string | null): GA4SessionData | null {
  if (!sessionStr) return null;

  try {
    // Format: GS1.1.{session_id}.{session_count}.{engagement}.{timestamp}.0.0.0
    const [prefix1, prefix2, session_id, session_count, engagement] = sessionStr.split(".");
    if (prefix1 !== "GS1" || prefix2 !== "1") return null;

    return {
      session_id,
      session_count: Number(session_count),
      session_start: Number(session_id), // session_id is timestamp
      engagement: Number(engagement) as 0 | 1,
    };
  } catch {
    return null;
  }
}

/**
 * GA4 のセッションデータを作成する
 */
function createGA4SessionString(data: GA4SessionData): string {
  const timestamp = Math.floor(Date.now() / 1000);
  // Format: GS1.1.{session_id}.{session_count}.{engagement}.{timestamp}.0.0.0
  return `GS1.1.${data.session_id}.${data.session_count}.${data.engagement}.${timestamp}.0.0.0`;
}

/**
 * セッションデータを取得または新規作成する
 */
function getOrCreateSession(): { session_id: string; session_number: number } {
  const now = Date.now();
  const sessionStr = localStorage.getItem(GA4_SESSION_KEY);
  const sessionData = parseGA4SessionString(sessionStr);

  // セッションデータがない、またはセッションタイムアウトしている場合は新規作成する
  if (!sessionData || now - sessionData.session_start * 1000 > SESSION_TIMEOUT) {
    // 新規セッションを作成する
    const newSessionData: GA4SessionData = {
      session_id: String(Math.floor(now / 1000)),
      session_count: (sessionData?.session_count ?? 0) + 1,
      session_start: Math.floor(now / 1000),
      engagement: 1, // 簡易実装のため、初期状態もエンゲージメントとする
    };

    localStorage.setItem(GA4_SESSION_KEY, createGA4SessionString(newSessionData));
    return {
      session_id: newSessionData.session_id,
      session_number: newSessionData.session_count,
    };
  }

  // 既存のセッションを継続する
  return {
    session_id: sessionData.session_id,
    session_number: sessionData.session_count,
  };
}

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
    if (ga4instance == null) {
      // まだ初期化されてないときのみ、GA4MP を初期化
      const client_id = getOrCreateClientId();
      const { session_id, session_number } = getOrCreateSession();
      ga4instance = ga4mp([GA4_MEASUREMENT_ID], {
        debug: true,
        non_personalized_ads: true,
        client_id: client_id,
        session_id: session_id,
        session_number: session_number,
      });
    }
    ga4instance.trackEvent(eventName, eventParameters);
  };

  return {
    enable,
    disable,
    trackEvent,
  };
}
