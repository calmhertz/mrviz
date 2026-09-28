<script>
  import SetupScreen from './lib/components/SetupScreen.svelte';
  import SimulateScreen from './lib/components/SimulateScreen.svelte';
  import { defaultText, phases } from './lib/data/concepts.js';
  import { DEFAULT_CONFIG, LIMITS, clamp, explainConfig, runPipeline, validate } from './lib/engine/pipeline.js';

  let screen = $state('setup');
  let text = $state(defaultText);
  let config = $state({ ...DEFAULT_CONFIG });
  let stageIndex = $state(0);
  let selected = $state(null);
  let active = $state(null);

  const errors = $derived(validate(text));
  const result = $derived(errors.length ? null : runPipeline(text, config));
  const notes = $derived(result ? explainConfig(result, config) : []);

  function setText(value) {
    text = value;
  }

  function setConfig(key, value) {
    config = { ...config, [key]: value };
  }

  function setCount(key, value) {
    const range = LIMITS[key];
    setConfig(key, clamp(Math.trunc(Number(value)) || range[0], range));
  }

  function simulate() {
    stageIndex = 0;
    selected = null;
    active = null;
    screen = 'simulate';
  }

  function setStage(index) {
    stageIndex = Math.min(Math.max(index, 0), phases.length - 1);
    selected = null;
    active = null;
  }

  function edit() {
    screen = 'setup';
  }
</script>

{#if screen === 'setup'}
  <SetupScreen {text} {config} {errors} {notes} onText={setText} onCount={setCount} onConfig={setConfig} onSimulate={simulate} />
{:else}
  <SimulateScreen {result} bind:selected bind:active phase={phases[stageIndex]} {stageIndex} stages={phases} onStage={setStage} onEdit={edit} />
{/if}
