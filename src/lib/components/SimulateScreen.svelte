<script>
  import EdgeDetails from './EdgeDetails.svelte';
  import NodeDetails from './NodeDetails.svelte';
  import StageCanvas from './StageCanvas.svelte';

  let { result, phase, stageIndex, stages, selected = $bindable(null), active = $bindable(null), onStage, onEdit } = $props();

  const isLast = $derived(stageIndex === stages.length - 1);

  function step(delta) {
    onStage(stageIndex + delta);
  }

  function clearFocus() {
    selected = null;
    active = null;
  }
</script>

<div class="sim">
  <div class="sim-canvas">
    <header class="canvas-head">
      <div class="stage-caption">
        <span class="phase-num">{String(stageIndex + 1).padStart(2, '0')}</span>
        <span>{phase.title}</span>
      </div>
      <div class="stage-bar">
        <div class="stage-progress" style="width: {((stageIndex + 1) / stages.length) * 100}%"></div>
      </div>
    </header>

    <StageCanvas {result} {phase} bind:selected bind:active />
  </div>

  <aside class="sim-panel">
    <div class="panel-head">
      {#if selected || active}
        <button type="button" class="back" onclick={clearFocus}>
          <span aria-hidden="true">&larr;</span> Stage details
        </button>
      {/if}
      <h2>{selected ? 'Node' : active ? 'Data flow' : phase.title}</h2>
      <p class="question">{selected || active ? 'Inspecting one connection' : phase.question}</p>
    </div>

    <div class="panel-body">
      {#if selected}
        <NodeDetails id={selected} {result} />
      {:else if active}
        <EdgeDetails linkId={active} {result} {phase} />
      {:else}
        <p class="lede">{phase.what}</p>
        <div class="block">
          <h3>Why it matters</h3>
          <p class="muted">{phase.why}</p>
        </div>
        <div class="block">
          <h3>In real Hadoop</h3>
          <p class="muted">{phase.hadoop}</p>
        </div>
        <p class="hint">Click a node to see inside it, or click a wire to see what travels along it.</p>
      {/if}
    </div>

    <div class="panel-nav">
      <button type="button" class="plain" onclick={onEdit}>Edit input</button>
      <div class="nav-pair">
        <button type="button" class="plain" disabled={stageIndex === 0} onclick={() => step(-1)}>Previous</button>
        {#if isLast}
          <button type="button" class="plain primary" onclick={() => onStage(0)}>Start over</button>
        {:else}
          <button type="button" class="plain primary" onclick={() => step(1)}>Next</button>
        {/if}
      </div>
    </div>
  </aside>
</div>
