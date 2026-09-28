<script>
  import { LIMITS } from '../engine/pipeline.js';

  let { text, config, errors, notes, onText, onCount, onConfig, onSimulate } = $props();

  const invalid = $derived(errors.length > 0);
</script>

<div class="setup">
  <div class="setup-card">
    <header class="setup-head">
      <h1>MR Viz</h1>
      <p class="tagline">Watch a word-count job move through a MapReduce cluster, stage by stage.</p>
    </header>

    <div class="group">
      <span class="eyebrow">Input</span>
      <label class="field">
        <span>Text to count</span>
        <textarea
          rows="10"
          value={text}
          class:invalid
          spellcheck="false"
          oninput={(event) => onText(event.currentTarget.value)}
        ></textarea>
      </label>

      {#if errors.length}
        <ul class="errors" role="alert">
          {#each errors as error (error)}
            <li>{error}</li>
          {/each}
        </ul>
      {/if}
    </div>

    <div class="group">
      <span class="eyebrow">Cluster</span>
      <div class="row">
        <label class="field">
          <span>Input splits</span>
          <input
            type="number"
            min={LIMITS.splits[0]}
            max={LIMITS.splits[1]}
            value={config.splits}
            onchange={(event) => onCount('splits', event.currentTarget.value)}
          />
        </label>
        <label class="field">
          <span>Mappers</span>
          <input
            type="number"
            min={LIMITS.mappers[0]}
            max={LIMITS.mappers[1]}
            value={config.mappers}
            onchange={(event) => onCount('mappers', event.currentTarget.value)}
          />
        </label>
        <label class="field">
          <span>Reducers</span>
          <input
            type="number"
            min={LIMITS.reducers[0]}
            max={LIMITS.reducers[1]}
            value={config.reducers}
            onchange={(event) => onCount('reducers', event.currentTarget.value)}
          />
        </label>
      </div>
    </div>

    <div class="group">
      <span class="eyebrow">Word handling</span>
      <label class="field">
        <span>Ignore words</span>
        <input
          type="text"
          placeholder="the, and, of"
          value={config.ignore}
          spellcheck="false"
          oninput={(event) => onConfig('ignore', event.currentTarget.value)}
        />
        <small class="hint-text">Comma or space separated. Matching words never become keys, so they are skipped before the count.</small>
      </label>

      <label class="switch">
        <input
          type="checkbox"
          checked={config.caseSensitive}
          onchange={(event) => onConfig('caseSensitive', event.currentTarget.checked)}
        />
        <span>Case-sensitive<small>Treat MapReduce and mapreduce as different keys</small></span>
      </label>
    </div>

    {#if notes.length}
      <div class="group">
        <span class="eyebrow">How this will run</span>
        <ul class="notes-list">
          {#each notes as note (note)}
            <li>{note}</li>
          {/each}
        </ul>
      </div>
    {/if}

    <button type="button" class="primary simulate" disabled={invalid} onclick={onSimulate}>
      Simulate
    </button>
  </div>
</div>
