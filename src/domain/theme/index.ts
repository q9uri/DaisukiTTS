import { ThemeConf } from "@/type/preload";

const light = {
  name: "Default",
  displayName: "デフォルト",
  order: 1,
  isDark: true,
  colors: {
    "primary": "#41A2EC",
    "display": "#FBEEEA",
    "display-on-primary": "#FBEEEA",
    "display-hyperlink": "#58A6FF",
    "background": "#2A2E33",
    "surface": "#184D7C",
    "warning": "#F27483",
    "text-splitter-hover": "#394152",
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
    "primary": "#41A2EC",
    "display": "#FBEEEA",
    "display-on-primary": "#FBEEEA",
    "display-hyperlink": "#58A6FF",
    "background": "#2A2E33",
    "surface": "#184D7C",
    "warning": "#F27483",
    "text-splitter-hover": "#394152",
    "active-point-focus": "#184d7c80",
    "active-point-hover": "#184d7c33",
  },
} as const satisfies ThemeConf;

export const themes = [light, dark];
