import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    // eslint-plugin-react's auto version-detection uses context.getFilename(),
    // which was removed in ESLint 10; pin the version to skip detection.
    settings: { react: { version: '19.2' } },
  },
  {
    ignores: ['.next/**', 'out/**', 'build/**', 'node_modules/**', 'next-env.d.ts'],
  },
]

export default eslintConfig
