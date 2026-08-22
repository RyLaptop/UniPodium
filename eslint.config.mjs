import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import jsxA11y from "eslint-plugin-jsx-a11y";
// next/core-web-vitals already registers the jsx-a11y plugin (with a narrow
// rule subset); re-declaring the plugin errors, so we only merge in its
// fuller "recommended" rule set here.

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { rules: jsxA11y.flatConfigs.recommended.rules },
];

export default eslintConfig;
