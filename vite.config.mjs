import { defineConfig } from 'vite';
import { extensions, classicEmberSupport, ember } from '@embroider/vite';
import { babel } from '@rollup/plugin-babel';

export default defineConfig({
  build: {
    cssMinify: 'esbuild',
  },
  resolve: {
    alias: {
      '@embroider/virtual/components/basic-dropdown':
        'ember-basic-dropdown/components/basic-dropdown',
    },
  },
  plugins: [
    classicEmberSupport(),
    ember(),
    // extra plugins here
    babel({
      babelHelpers: 'runtime',
      extensions,
    }),
  ],
});
