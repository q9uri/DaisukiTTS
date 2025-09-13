import { ThemeConf } from "@/type/preload";

const light = {
  name: "Default",
  displayName: "デフォルト",
  order: 1,
  isDark: true,
  colors: {
    "primary": "#fd6014",
    "display": "#000000",
    "display-on-primary": "#000000",
    "display-hyperlink": "#ff587d",
    "background": "#654400",
    "surface": "#ecc941",
    "warning": "#7489f2",
    "text-splitter-hover": "#fd6014",
    "active-point-focus": "#184d7c80",
    "active-point-hover": "#184d7c33",
  },
} as const satisfies ThemeConf;

const dark = {
  name: "Dark",
  displayName: "ダーク",
  order: 2,
  isDark: true,
  colors: {
    "primary": "#fd6014",
    "display": "#000000",
    "display-on-primary": "#000000",
    "display-hyperlink": "#ff587d",
    "background": "#654400",
    "surface": "#ecc941",
    "warning": "#7489f2",
    "text-splitter-hover": "#2d9324",
    "active-point-focus": "#184d7c80",
    "active-point-hover": "#184d7c33",
  },
} as const satisfies ThemeConf;

export const themes = [light, dark];
