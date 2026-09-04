import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

// Config plana (ESLint 9). El proyecto ya venía apoyándose en las reglas de
// react-hooks (hay varios `// eslint-disable-next-line react-hooks/...`
// repartidos), pero sin config no había forma de correr el linter ni en
// local ni en CI. Esto lo formaliza sin volverse ruidoso.
export default [
  { ignores: ["dist/**", "dev-dist/**", "node_modules/**"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: "detect" } },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // el nuevo JSX transform no necesita React en scope; sí necesita que
      // el linter sepa que el JSX "usa" los componentes/íconos importados.
      ...react.configs.flat["jsx-runtime"].rules,
      // marca como "usados" los componentes e íconos que solo aparecen en JSX
      "react/jsx-uses-vars": "error",
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^[A-Z_]" }],
    },
  },
  {
    files: ["**/*.test.{js,jsx}", "vitest.config.js", "vite.config.js", "eslint.config.js"],
    languageOptions: { globals: { ...globals.node } },
  },
];
