import { click, findAll, visit } from '@ember/test-helpers';
import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';

async function clickButtonWithText(assert, text) {
  const button = findAll('button').find((element) =>
    element.textContent.includes(text),
  );

  assert.ok(button, `Found button with text "${text}"`);
  await click(button);
}

module('Acceptance | runbook flow', function (hooks) {
  setupApplicationTest(hooks);

  test('edit runbook labels the operator-defined action as custom', async function (assert) {
    await visit('/');
    await clickButtonWithText(assert, 'Edit runbook');

    assert.dom('.step-list').containsText('Custom step');
    assert.dom('.step-list').doesNotContainText('Manual step');
  });

  for (const scenario of [
    { operation: 'Test failover', estimate: '14 minutes' },
    { operation: 'Emergency failover', estimate: '8 minutes' },
  ]) {
    test(`${scenario.operation} uses a single checklist flow`, async function (assert) {
      await visit('/');
      await clickButtonWithText(assert, 'Start DR runbook');
      await clickButtonWithText(assert, scenario.operation);

      assert.dom('.step-kind').hasText('Step 1 of 1 · Confirm & pre-checks');
      assert.dom('.cluster-summary').containsText('2 performance secondaries');
      assert.dom('.estimate-row').containsText(scenario.estimate);
      assert.dom('.preflight-list').doesNotContainText('version');
      assert.dom('.topology-preview').doesNotExist();

      await clickButtonWithText(assert, 'Continue to checklist');

      assert.dom('.step-kind').hasText(`Step 1 of 1 · ${scenario.operation}`);
      assert.dom('.checklist-items .checklist-item').exists({ count: 7 });
      assert.dom('.topology-preview').doesNotExist();
      assert
        .dom('.hds-alert--color-warning .hds-alert__title')
        .hasText('Custom step timing is not included');
    });
  }
});
