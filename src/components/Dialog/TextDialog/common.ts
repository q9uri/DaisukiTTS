import { ExhaustiveError } from "@/type/utility";

export type DialogType = "info" | "error" | "question" | "warning" | "warning-light";

export const getIcon = (dialogType: DialogType) => {
  switch (dialogType) {
    case "error":
      return "error";
    case "question":
      return "help";
    case "warning":
      return "warning";
    case "warning-light":
      return "warning";
    case "info":
      return "info";
    default:
      throw new ExhaustiveError(dialogType);
  }
};

export const getColor = (dialogType: DialogType) => {
  switch (dialogType) {
    case "error":
      return "warning";
    case "question":
      return "warning-light";
    case "warning":
      return "warning";
    case "warning-light":
      return "warning-light";
    case "info":
      return "primary";
    default:
      throw new ExhaustiveError(dialogType);
  }
};
