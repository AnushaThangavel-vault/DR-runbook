# Vault DR Runbook

A small Ember application prototype for managing and running Vault disaster
recovery operations. It uses native Helios Design System components for tabs,
tables, alerts, forms, badges, buttons, and dialogs.

## Prerequisites

You will need the following things properly installed on your computer.

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) (with npm)
- [Google Chrome](https://google.com/chrome/)

## Installation

- `git clone <repository-url>` this repository
- `cd dr-runbook`
- `npm install`

## Running / Development

- `npm run start`
- Visit your app at [http://localhost:5173](http://localhost:5173).
- Visit your tests at [http://localhost:5173/tests](http://localhost:5173/tests).

### Code Generators

Make use of the many generators for code, try `npm exec ember help generate` for more details

### Running Tests

- `npm run test`

### Linting

- `npm run lint`
- `npm run lint:fix`

### Building

- `npm exec vite build --mode development` (development)
- `npm run build` (production)

### Deploying

Specify what it takes to deploy your app.

## Further Reading / Useful Links

- [ember.js](https://emberjs.com/)
- [Vite](https://vite.dev)
- Development Browser Extensions
  - [ember inspector for chrome](https://chrome.google.com/webstore/detail/ember-inspector/bmdblncegkenkacieihfhpjfppoconhi)
  - [ember inspector for firefox](https://addons.mozilla.org/en-US/firefox/addon/ember-inspector/)

## Runbook flow

Run history and cluster configuration are sample data for this prototype. Both
failover types share a single checklist step after pre-checks. Pre-checks cover
primary health, DR replication lag, DR secondary readiness, and
performance-secondary connectivity; version compatibility is not included.
Estimates use recent run history, and custom-step duration is excluded because
it cannot be calculated. The prototype displays 14 minutes for a test failover
and 8 minutes for an emergency failover.
