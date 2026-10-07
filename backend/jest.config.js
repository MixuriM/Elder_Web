/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  // Item 9.4: cobertura só de routes/ e middleware/ (onde mora a autorização). Roda com `npm run test:coverage`.
  collectCoverageFrom: ['src/routes/**/*.ts', 'src/middleware/**/*.ts', '!**/*.test.ts', '!src/testSupport/**'],
  coverageDirectory: 'coverage',
  // Limiares por diretório = floor(medido em 07/10/2026) menos 1 ponto (decisão D7 do item 9.4). Medido com a suíte
  // de autorização: routes/ 96,44 stmts, 93,71 branches, 100 funcs, 97,04 lines; middleware/ 100 em tudo.
  // Baixar um limiar exige edição consciente aqui, nunca um teste removido em silêncio.
  coverageThreshold: {
    './src/routes/': { statements: 95, branches: 92, functions: 99, lines: 96 },
    './src/middleware/': { statements: 99, branches: 99, functions: 99, lines: 99 },
  },
}
