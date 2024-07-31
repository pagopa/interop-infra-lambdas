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
      "no-undef": "error"
    }
  }
];