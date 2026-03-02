module.exports = {
  // Line width
  printWidth: 100,

  // Indentation
  tabWidth: 2,
  useTabs: false,

  // Quotes
  singleQuote: true,
  jsxSingleQuote: false,

  // Semicolons
  semi: true,

  // Trailing commas
  trailingComma: "es5",

  // Brackets
  bracketSpacing: true,
  bracketSameLine: false,

  // JSX
  jsxBracketSameLine: false,

  // Arrow functions
  arrowParens: "always",

  // End of line
  endOfLine: "auto",

  // Prose wrapping (for markdown)
  proseWrap: "preserve",

  // HTML whitespace sensitivity
  htmlWhitespaceSensitivity: "css",

  // Embedded language formatting
  embeddedLanguageFormatting: "auto",

  // Single attribute per line in JSX
  singleAttributePerLine: false,

  // Override for specific file types
  overrides: [
    {
      files: "*.json",
      options: {
        printWidth: 80,
        tabWidth: 2,
      },
    },
    {
      files: "*.md",
      options: {
        proseWrap: "always",
        printWidth: 80,
      },
    },
    {
      files: ["*.ts", "*.tsx"],
      options: {
        parser: "typescript",
      },
    },
  ],
};
