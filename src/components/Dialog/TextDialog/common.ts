import { ExhaustiveError } from "@/type/utility";

export type DialogType = "none" | "info" | "error" | "question" | "warning" | "warning-light";
export const getIcon = (dialogType: DialogType) => {
  switch (dialogType) {
    case "info":
      return "info";
    case "error":
      return "error";
    case "question":
      return "help";
    case "warning":
      return "warning";
    case "warning-light":
      return "warning";
    case "none":
      return "";
    default:
      throw new ExhaustiveError(dialogType);
  }
};

export const getColor = (dialogType: DialogType) => {
  switch (dialogType) {
    case "error":
    case "warning":
      // TODO：warning用の色を用意する
      return "warning";
    case "warning-light":
      return "warning-light";
    case "question":
    case "info":
      return "warning-light";
    case "none":
      return "display";
    default:
      throw new ExhaustiveError(dialogType);
  }
};
