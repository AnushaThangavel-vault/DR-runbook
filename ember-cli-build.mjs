import EmberApp from 'ember-cli/lib/broccoli/ember-app.js';
import { compatBuild } from '@embroider/compat';

export default async function (defaults) {
  const { buildOnce } = await import('@embroider/vite');

  const app = new EmberApp(defaults, {
    // Add options here
  });

  app.import(
    'node_modules/@hashicorp/design-system-components/dist/styles/@hashicorp/design-system-components.css',
  );

  return compatBuild(app, buildOnce);
}
