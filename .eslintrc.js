const vueEslintParser = "vue-eslint-parser";
const vueEslintParserOptions = {
  ecmaVersion: 2020,
  parser: "@typescript-eslint/parser",
};
const tsEslintOptions = {
  project: ["./tsconfig.json"],
  tsconfigRootDir: __dirname,
};

const tsEslintRules = {
  // Storeでよくasyncなしの関数を定義するので無効化
  // TODO: いずれは有効化する
  "@typescript-eslint/require-await": "off",

  // 比較関数無しでのsortは文字列での比較になり、ミスが起こりやすいため有効化
  "@typescript-eslint/require-array-sort-compare": "error",

  "@typescript-eslint/no-misused-promises": [
    "error",
    {
      // (...) => voidに(...) => Promise<void>を渡すのは許可
      // ただし特に強い意志でこれを許可しているわけではないので、
      // もし問題が発生した場合は有効化する
      // ref: https://canary.discord.com/channels/879570910208733277/893889888208977960/1267467454876225536
      checksVoidReturn: false,
    },
  ],
};

/** @type {import('@typescript-eslint/utils').TSESLint.Linter.ConfigType} */
module.exports = {
  root: true,
  env: {
    node: true,
  },
  extends: [
    "plugin:vue/vue3-recommended",
    "eslint:recommended",
    "@vue/typescript/recommended",
    // "@vue/prettier",
    "@vue/eslint-config-typescript/recommended",
    // "@vue/eslint-config-prettier",
    "plugin:@voicevox/all",
    "plugin:storybook/recommended",
  ],
  plugins: ["import"],
  parser: vueEslintParser,
  parserOptions: vueEslintParserOptions,
  ignorePatterns: ["dist/**/*", "dist_*/**/*", "node_modules/**/*"],
  rules: {
    "linebreak-style":
      process.env.NODE_ENV === "production" && process.platform !== "win32"
        ? ["error", "unix"]
        : "off",
    "no-console": process.env.NODE_ENV === "production" ? "off" : "off",
    "no-constant-condition": ["error", { checkLoops: false }], // while(true) などを許可
    "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
    // "prettier/prettier": [
    //   "error",
    //   {
    //     endOfLine: "auto",
    //   },
    // ],
    // "vue/no-restricted-syntax": [
    //   "error",
    //   {
    //     selector: "LogicalExpression[operator=??]",
    //     message: `template内で"??"を使うとgithubのsyntax highlightが崩れるので\n三項演算子等を使って書き換えてください`,
    //   },
    //   {
    //     selector: "MemberExpression[optional=true]",
    //     message: `template内で"?."を使うとgithubのsyntax highlightが崩れるので\n三項演算子等を使って書き換えてください`,
    //   },
    // ],
    "@typescript-eslint/no-unused-vars": [
      "off",
      {
        ignoreRestSiblings: true,
      },
    ],
    "vue/attribute-hyphenation": ["error", "never"],
    "vue/v-on-event-hyphenation": ["error", "never", { autofix: true }],
    "vue/v-bind-style": ["error", "shorthand", { sameNameShorthand: "always" }],
    "vue/component-name-in-template-casing": [
      "error",
      "PascalCase",
      {
        registeredComponentsOnly: false,
        ignores: [],
      },
    ],
    "vue/component-tags-order": [
      "error",
      {
        order: ["template", "script", "style"],
      },
    ],
    "vue/multi-word-component-names": [
      "error",
      {
        ignores: ["Container", "Presentation"],
      },
    ],
    "import/order": "error",
    "vue/first-attribute-linebreak": "off",
    "vue/html-closing-bracket-newline": "off",
    "vue/html-indent": "off",
    "vue/html-self-closing": "off",
    "vue/max-attributes-per-line": "off",
    "vue/multiline-html-element-content-newline": "off",
    "vue/singleline-html-element-content-newline": "off",
    // AivisSpeech 独自
    // 複数行に渡る型のインデントが潰れないようにするために設定を工夫している
    // ref: https://stackoverflow.com/questions/75893980/typescript-eslint-indent-rule-doesnt-indent-multi-line-object-parameters-correc
    // ref: https://github.com/typescript-eslint/typescript-eslint/issues/455#issuecomment-580636221
    indent: "off",  // !!!! VERY IMPORTANT !!!!
    "@typescript-eslint/indent": [
      "error",
      2,
      {
        SwitchCase: 1,
        ObjectExpression: 1,
        MemberExpression: 1,
        CallExpression: {
          arguments: 1,
        },
        ignoredNodes: [
          "PropertyDefinition[decorators]",
          "TSUnionType",
          "FunctionExpression[params]",
          "CallExpression[arguments]",  // !!!! VERY IMPORTANT !!!!
          "TSTypeParameterInstantiation",  // !!!! VERY IMPORTANT !!!!
        ],
      },
    ],
    "@typescript-eslint/quotes": ["error", "double", { avoidEscape: true }],
    "@typescript-eslint/semi": ["error", "always"],
  },
  overrides: [
    {
      files: [
        "./src/backend/electron/**/*.ts",
        "./tests/**/*.ts",
        "./build/*.js",
        "./build/*.mts",
      ],
      rules: {
        "no-console": "off",
      },
    },
    {
      files: ["*.ts", "*.mts"],
      parser: "@typescript-eslint/parser",
      extends: ["plugin:@typescript-eslint/recommended-type-checked"],
      parserOptions: tsEslintOptions,
      rules: tsEslintRules,
    },
    {
      files: ["*.vue"],
      parser: vueEslintParser,
      parserOptions: { ...vueEslintParserOptions, ...tsEslintOptions },
      extends: ["plugin:@typescript-eslint/recommended-type-checked"],
      rules: {
        ...tsEslintRules,

        // typescript-eslintにVueの型がanyとして認識されるので無効化
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/no-unsafe-call": "off",
        "@typescript-eslint/no-unsafe-assignment": "off",
        "@typescript-eslint/no-unsafe-argument": "off",
        "@typescript-eslint/no-unsafe-return": "off",
        "@typescript-eslint/no-redundant-type-constituents": "off",
      },
    },
    // Electronのメインプロセス以外でelectronのimportを禁止する
    {
      files: ["./src/**/*.ts", "./src/**/*.vue"],
      excludedFiles: ["./src/backend/electron/**/*.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["electron"],
                message:
                  "このファイル内でelectronはimportできません。許可されているファイル内へ移すか、ESLintの設定を見直してください",
              },
            ],
          },
        ],
      },
    },
  ],
};
