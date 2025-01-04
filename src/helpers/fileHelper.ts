import { ResultError } from "@/type/result";

/** ファイル書き込み時のエラーメッセージを生成する */
// instanceof ResultErrorで生まれるResultError<any>を受け取れるようにするため、anyを許容する
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function generateWriteErrorMessage(writeFileResult: ResultError<any>) {
  if (typeof writeFileResult.code === "string") {
    const code = writeFileResult.code?.toUpperCase();

    if (code?.startsWith("ENOSPC")) {
      return "空き容量が足りません。";
    }

    if (code?.startsWith("EACCES")) {
      return "ファイルにアクセスする許可がありません。";
    }

    if (code?.startsWith("EBUSY")) {
      return "ファイルが開かれています。";
    }

    if (code?.startsWith("ENOENT")) {
      return "指定されたファイルまたはフォルダが見つかりません。";
    }
  }

  return `何らかの理由で失敗しました。${writeFileResult.message}`;
}

/**
 * バイト単位の数値をフォーマットする
 * @param bytes バイト数
 * @returns フォーマットされた文字列 (例: 1.23KB)
 */
export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let unitIndex = 0;

  while (bytes >= 1000 && unitIndex < units.length - 1) {
    bytes /= 1000;
    unitIndex++;
  }

  return `${bytes.toFixed(2)}${units[unitIndex]}`;
}
