import globals from "globals";
import pluginJs from "@eslint/js";


export default [
  {files: ["**/*.js"], languageOptions: {sourceType: "module"}},
  {languageOptions: { globals: globals.browser }},
  pluginJs.configs.recommended,
];
