import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

const INITIAL_STEPS = [
  {
    id: 'login',
    kind: 'system',
    title: 'Log into the DR cluster',
    description:
      'Authenticate to vault-us-west. Set VAULT_ADDR to the DR cluster address and log in using an existing token or your configured auth method.',
    command:
      'VAULT_ADDR=https://vault-us-west.hashicorp.cloud:8200 vault login -method=token',
  },
  {
    id: 'generate-token',
    kind: 'system',
    title: 'Generate a DR operation token',
    description:
      'On vault-us-west, initiate the DR operation token process. The generated token will be pre-filled in the promote step.',
    command:
      'VAULT_ADDR=https://vault-us-west.hashicorp.cloud:8200 vault write -format=json sys/replication/dr/secondary/generate-operation-token/attempt',
  },
  {
    id: 'promote',
    kind: 'system',
    title: 'Promote DR secondary to primary',
    description:
      'Use the DR operation token from the previous step to promote vault-us-west as the new active primary cluster.',
    command:
      'VAULT_ADDR=https://vault-us-west.hashicorp.cloud:8200 vault write sys/replication/dr/secondary/promote dr_operation_token=<dr-operation-token>',
  },
  {
    id: 'redirect-traffic',
    kind: 'custom',
    title: 'Redirect client traffic',
    description:
      'Update your DNS record, load balancer, or VAULT_ADDR environment variable across services to point to vault-us-west.hashicorp.cloud:8200. Confirm when traffic has been rerouted.',
    command: '',
  },
  {
    id: 'verify-primary',
    kind: 'system',
    title: 'Verify the new primary',
    description:
      'Confirm vault-us-west is active, initialized, unsealed, and showing as the DR primary before reconnecting performance secondaries.',
    command:
      'VAULT_ADDR=https://vault-us-west.hashicorp.cloud:8200 vault status',
  },
  {
    id: 'connect-eu-west',
    kind: 'system',
    title: 'Connect vault-eu-west to the new primary',
    description:
      'Update vault-eu-west to replicate from vault-us-west. Run update-primary on the EU performance secondary, providing the new primary address and a valid PR secondary token.',
    command:
      'VAULT_ADDR=https://vault-eu-west.hashicorp.cloud:8200 vault write sys/replication/performance/secondary/update-primary token=<pr-secondary-token> primary_api_addr=https://vault-us-west.hashicorp.cloud:8200',
  },
  {
    id: 'connect-ap-south',
    kind: 'system',
    title: 'Connect vault-ap-south to the new primary',
    description:
      'Update vault-ap-south to replicate from vault-us-west. Confirm replication status is healthy before marking this step done.',
    command:
      'VAULT_ADDR=https://vault-ap-south.hashicorp.cloud:8200 vault write sys/replication/performance/secondary/update-primary token=<pr-secondary-token> primary_api_addr=https://vault-us-west.hashicorp.cloud:8200',
  },
];

const INITIAL_HISTORY = [
  {
    operation: 'Test failover',
    startedBy: 'admin',
    started: 'Aug 13, 10:30',
    result: 'Completed',
    comments:
      'Planned quarterly DR exercise. Promotion successful. Latency within acceptable range throughout test.',
  },
  {
    operation: 'Emergency failover',
    startedBy: 'admin',
    started: 'Jul 18, 09:42',
    result: 'Completed',
    comments:
      'us-east region outage. Elevated error rate detected at 09:30 UTC. Promoted us-west after confirming with on-call SRE. Recovery time: 8 min.',
  },
  {
    operation: 'Test failover',
    startedBy: 'jsmith',
    started: 'Jun 2, 14:15',
    result: 'Completed',
    comments:
      'Bi-annual DR test exercise. All steps completed within expected time window. No issues found.',
  },
  {
    operation: 'Emergency failover',
    startedBy: 'admin',
    started: 'Mar 22, 08:55',
    result: 'Failed',
    comments:
      'Primary became unresponsive. DR token generation failed on first attempt due to secondary replication lag. Aborted and recovered primary in-place.',
  },
  {
    operation: 'Test failover',
    startedBy: 'pgarcia',
    started: 'Feb 14, 11:30',
    result: 'Completed',
    comments:
      'Pre-migration DR validation. Confirmed promotion latency and performance secondary reconnect times meet SLA targets.',
  },
  {
    operation: 'Test failover',
    startedBy: 'admin',
    started: 'Dec 10, 09:00',
    result: 'Completed',
    comments:
      'End-of-year DR exercise. Full runbook completed in 14 minutes. Runbook language updated post-test based on team feedback.',
  },
];

const PREFLIGHT_CHECKS = [
  {
    title: 'Primary cluster health',
    detail: 'vault-us-east · us-east-1',
  },
  {
    title: 'DR replication lag',
    detail: 'vault-us-west · last sync < 2s ago',
  },
  {
    title: 'DR secondary readiness',
    detail: 'vault-us-west · unsealed, initialized',
  },
  {
    title: 'Performance secondary connectivity',
    detail: 'vault-eu-west and vault-ap-south · reconnect after promotion',
  },
];

export default class RunbookAppComponent extends Component {
  @tracked view = 'overview';
  @tracked activeTab = 0;
  @tracked modalMode = null;
  @tracked operationType = null;
  @tracked runbookSteps = INITIAL_STEPS.map((step) => ({ ...step }));
  @tracked runHistory = INITIAL_HISTORY.map((run) => ({ ...run }));
  @tracked checkedStepIds = new Set();
  @tracked nextCustomStepId = 1;
  @tracked validationMessage = '';
  @tracked copyMessage = '';
  @tracked editSnapshot = null;

  get isEditing() {
    return this.view === 'edit';
  }

  get isChoosingOperation() {
    return this.modalMode === 'choose';
  }

  get isPrechecking() {
    return this.modalMode === 'precheck';
  }

  get isRunningChecklist() {
    return this.modalMode === 'checklist';
  }

  get isComplete() {
    return this.modalMode === 'complete';
  }

  get operationLabel() {
    return this.operationType === 'emergency'
      ? 'Emergency failover'
      : 'Test failover';
  }

  get operationEstimate() {
    return this.operationType === 'emergency' ? '8 minutes' : '14 minutes';
  }

  get modalTitle() {
    if (this.isChoosingOperation) {
      return 'Start DR runbook';
    }

    if (this.isComplete) {
      return 'Runbook completed';
    }

    return `${this.operationLabel} — ${
      this.isPrechecking ? 'confirm & pre-checks' : 'checklist'
    }`;
  }

  get checkedStepCount() {
    return this.runbookSteps.filter((step) => this.checkedStepIds.has(step.id))
      .length;
  }

  get areAllStepsChecked() {
    return (
      this.runbookSteps.length > 0 &&
      this.checkedStepCount === this.runbookSteps.length
    );
  }

  get stepsWithMetadata() {
    return this.runbookSteps.map((step, index) => ({
      ...step,
      position: index + 1,
      isCustom: step.kind === 'custom',
    }));
  }

  get historyWithMetadata() {
    return this.runHistory.map((run) => ({
      ...run,
      isFailed: run.result === 'Failed',
    }));
  }

  @action
  selectTab(_event, index) {
    this.activeTab = index;
  }

  @action
  openEdit() {
    this.view = 'edit';
    this.editSnapshot = this.runbookSteps.map((step) => ({ ...step }));
    this.validationMessage = '';
  }

  @action
  cancelEdit() {
    if (this.editSnapshot) {
      this.runbookSteps = this.editSnapshot;
    }
    this.view = 'overview';
    this.editSnapshot = null;
    this.validationMessage = '';
  }

  @action
  resetSystemSteps() {
    const customSteps = this.runbookSteps.filter(
      (step) => step.kind === 'custom',
    );
    this.runbookSteps = [
      ...INITIAL_STEPS.filter((step) => step.kind === 'system').map((step) => ({
        ...step,
      })),
      ...customSteps,
    ];
    this.validationMessage = '';
  }

  @action
  saveEdit() {
    const hasUntitledCustomStep = this.runbookSteps.some(
      (step) => step.kind === 'custom' && !step.title.trim(),
    );

    if (hasUntitledCustomStep) {
      this.validationMessage = 'Give each custom step a name before saving.';
      return;
    }

    this.view = 'overview';
    this.activeTab = 1;
    this.editSnapshot = null;
    this.validationMessage = '';
  }

  @action
  addCustomStep() {
    const stepNumber = this.nextCustomStepId;
    this.nextCustomStepId += 1;
    this.runbookSteps = [
      ...this.runbookSteps,
      {
        id: `custom-${stepNumber}`,
        kind: 'custom',
        title: 'New custom step',
        description: '',
        command: '',
      },
    ];
    this.validationMessage = '';
  }

  @action
  updateStepTitle(stepId, event) {
    this.updateStep(stepId, { title: event.target.value });
  }

  @action
  updateStepDescription(stepId, event) {
    this.updateStep(stepId, { description: event.target.value });
  }

  @action
  removeCustomStep(stepId) {
    this.runbookSteps = this.runbookSteps.filter(
      (step) => step.id !== stepId || step.kind !== 'custom',
    );
  }

  @action
  openRunbook() {
    this.modalMode = 'choose';
    this.operationType = null;
    this.checkedStepIds = new Set();
    this.validationMessage = '';
  }

  @action
  chooseOperation(type) {
    this.operationType = type;
    this.modalMode = 'precheck';
    this.validationMessage = '';
  }

  @action
  beginChecklist() {
    this.checkedStepIds = new Set();
    this.modalMode = 'checklist';
    this.validationMessage = '';
  }

  @action
  toggleChecklistStep(stepId, event) {
    const nextCheckedStepIds = new Set(this.checkedStepIds);

    if (event.target.checked) {
      nextCheckedStepIds.add(stepId);
    } else {
      nextCheckedStepIds.delete(stepId);
    }

    this.checkedStepIds = nextCheckedStepIds;
    this.validationMessage = '';
  }

  @action
  completeOperation() {
    if (!this.areAllStepsChecked) {
      this.validationMessage =
        'Complete each checklist item before finishing the runbook.';
      return;
    }

    const now = new Date();
    const started = now.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    this.runHistory = [
      {
        operation: this.operationLabel,
        startedBy: 'admin',
        started,
        result: 'Completed',
        comments: `Runbook completed. ${this.operationLabel} finished with ${this.runbookSteps.length} checklist items confirmed.`,
      },
      ...this.runHistory,
    ];
    this.modalMode = 'complete';
    this.validationMessage = '';
  }

  @action
  closeModal() {
    this.modalMode = null;
    this.operationType = null;
    this.validationMessage = '';
  }

  @action
  returnToOverview() {
    this.closeModal();
    this.view = 'overview';
    this.activeTab = 0;
  }

  @action
  async copyCommand(stepId) {
    const step = this.runbookSteps.find((item) => item.id === stepId);

    if (!step?.command) {
      return;
    }

    try {
      await navigator.clipboard.writeText(step.command);
      this.copyMessage = 'Command copied to clipboard.';
    } catch (error) {
      this.copyMessage =
        'Could not copy this command. Select and copy it manually.';
      console.error('Failed to copy runbook command:', error);
    }
  }

  @action
  isStepChecked(stepId) {
    return this.checkedStepIds.has(stepId);
  }

  updateStep(stepId, updates) {
    this.runbookSteps = this.runbookSteps.map((step) =>
      step.id === stepId ? { ...step, ...updates } : step,
    );
  }

  get preflightChecks() {
    return PREFLIGHT_CHECKS;
  }
}
