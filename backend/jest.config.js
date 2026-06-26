module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  // RootDir definido como '.' para que ele encontre tanto /src quanto /tests
  rootDir: ".",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
  collectCoverageFrom: ["src/**/*.(t|j)s", "!src/main.ts", "!src/**/*.module.ts"],
  coverageDirectory: "./coverage",
  testEnvironment: "node",
  // Esta regra permite que o Jest processe pacotes ESM que normalmente causariam erro de "import"
  transformIgnorePatterns: [
    "/node_modules/(?!(file-type|token-types|strtok3|peek-readable|@borewit|@tokenizer|uint8array-extras)/)",
  ],
};
