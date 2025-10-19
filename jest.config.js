module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    modulePathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/node_modules/'],
    testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/dist/'],
    testMatch: [
      '**/utils/__tests__/**/*.test.(ts|js)',
      '**/__tests__/**/*.test.(ts|js)',
      '**/*.test.(ts|js)'
    ],
    collectCoverageFrom: [
      'utils/**/*.ts',
      '!utils/**/*.d.ts',
      '!utils/__tests__/**'
    ],
    transform: {
      '^.+\\.ts$': ['ts-jest', {
        tsconfig: {
          target: 'es2020',
          module: 'commonjs',
          lib: ['es2020', 'DOM'],
          sourceMap: true,
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          resolveJsonModule: true,
          jsx: 'react',
          moduleResolution: 'node',
          types: ['jest', 'node']
        }
      }]
    }
  };