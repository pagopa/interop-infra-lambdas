import globals from "globals";
import pluginJs from '@eslint/js';

export default [
  pluginJs.configs.recommended,
  {
    files: ["**/*.js"], 
    languageOptions: {sourceType: "commonjs"}
  },
  {
    languageOptions: { 
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  },
  {
    rules: {
      "no-unused-vars": "error",
      "no-undef": "error",
      "no-promise-executor-return": "error",
      "no-duplicate-imports": "warn",
      "no-self-compare": "warn",
      "no-template-curly-in-string": "warn",
      "no-unreachable-loop": "warn",
      "no-useless-assignment": "warn"
    }
  }
];