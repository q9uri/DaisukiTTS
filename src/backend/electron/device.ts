/* eslint-disable @typescript-eslint/no-unused-vars */
import si from "systeminformation";

/**
 * GPU モードがサポートされているかどうか。
 * AivisSpeech Engine では常に true を返す。
 */
export function hasSupportedGpu(platform: string): Promise<boolean> {
  /*
  return si
    .graphics()
    .then((data) =>
      data.controllers.some(
        (datum) =>
          platform === "win32" ||
          (platform === "linux" &&
            datum.vendor.toUpperCase().includes("NVIDIA")),
      ),
    )
    .catch(() => false);
  */
  return Promise.resolve(true);
}
