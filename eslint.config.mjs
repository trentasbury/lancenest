import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

export default [
  ...nextCoreWebVitals,
  {
    // React 19's new hook rules are written for client components; most hits here are server components
    // (Date.now() while rendering on the server, icon lookups). Keep them visible as warnings.
    rules: {
      'react-hooks/purity': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'scripts/**'] },
];
