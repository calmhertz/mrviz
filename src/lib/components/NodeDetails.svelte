<script>
  import DataPair from './DataPair.svelte';

  let { id, result } = $props();

  const kind = $derived(id.split('-')[0]);
  const index = $derived(Number(id.split('-')[1]));

  const titles = {
    source: 'Source text',
    split: () => `Split ${index}`,
    map: () => `Mapper ${index}`,
    red: () => `Reducer ${index}`,
    res: () => `Result ${index}`,
    file: () => result.files[index]?.name ?? `File ${index}`
  };
  const title = $derived(kind === 'source' ? titles.source : titles[kind]());

  const source = $derived(kind === 'source' ? { chars: result.stats.chars, text: result.text } : null);
  const split = $derived(kind === 'split' ? result.splits.find((item) => item.index === index) : null);
  const mapper = $derived(kind === 'map' ? result.mappers[index] : null);
  const partition = $derived(kind === 'red' ? result.partitions[index] : null);
  const reduced = $derived(kind === 'res' ? result.reduced[index] : null);
  const file = $derived(kind === 'file' ? result.files[index] : null);

  const foldNote = (pair) => (pair.raw === pair.key ? undefined : `was ${pair.raw}`);
  const mapperOf = (split) => result.mappers[split.mapper];
  const originLabel = (group) => [...new Set(group.origins)].sort().map((m) => `m${m}`).join(', ');
</script>

<h3 class="node-title">{title}</h3>

{#if source}
  <p class="lede">
    The entire input, before anything is split or mapped. It is read once and divided into
    {result.splits.length} input split{result.splits.length === 1 ? '' : 's'}.
  </p>
  <div class="block">
    <h3>Text <span class="muted">{source.chars} characters</span></h3>
    <pre>{source.text}</pre>
  </div>
{:else if split}
  <p class="lede">
    Characters {split.start} to {split.end} of the input, handed to Mapper {split.mapper}. It holds no
    character from another split.
  </p>
  {#if split.cut}
    <p class="warn">A boundary fell inside a word here, so that word is tokenized as two pieces.</p>
  {/if}
  <div class="block">
    <h3>Contents <span class="muted">{split.end - split.start} characters</span></h3>
    <pre>{split.text}</pre>
  </div>
  <div class="block">
    <h3>Words found <span class="muted">emitted as (word, 1)</span></h3>
    <ul class="pairs">
      {#each mapperOf(split).pairs.filter((pair) => pair.split === split.index) as pair (pair.position)}
        <li><DataPair key={pair.key} value={pair.value} note={foldNote(pair)} /></li>
      {/each}
    </ul>
  </div>
{:else if mapper}
  <p class="lede">
    Reads split{mapper.splits.length === 1 ? '' : 's'}
    {mapper.splits.map((item) => item.index).join(', ') || 'none'} and emits one intermediate pair per
    word. It never reads another mapper's output.
  </p>
  {#if mapper.dropped}
    <p class="warn">{mapper.dropped} stop word{mapper.dropped === 1 ? '' : 's'} dropped before counting.</p>
  {/if}
  <div class="block">
    <h3>
      Intermediate pairs
      <span class="muted">{mapper.pairs.length} emitted{mapper.folded ? `, ${mapper.folded} case-folded` : ''}</span>
    </h3>
    <ul class="pairs">
      {#each mapper.pairs as pair (pair.split + ':' + pair.position)}
        <li><DataPair key={pair.key} value={pair.value} note={foldNote(pair)} /></li>
      {/each}
    </ul>
  </div>
{:else if partition}
  <p class="lede">
    {partition.groups.length
      ? 'Keys hashing to this reducer arrive here from every mapper at once, already grouped and sorted.'
      : 'No key hashes to this reducer, so it receives nothing and writes an empty file.'}
  </p>
  <div class="block">
    <h3>
      Grouped values
      <span class="muted">
        {partition.groups.length} key{partition.groups.length === 1 ? '' : 's'},
        {partition.groups.reduce((sum, group) => sum + group.values.length, 0)} values
      </span>
    </h3>
    {#if partition.groups.length}
      <ul class="pairs">
        {#each partition.groups as group (group.key)}
          <li>
            <DataPair key={group.key} value={`[${group.values.join(', ')}]`} note={`from ${originLabel(group)}`} />
          </li>
        {/each}
      </ul>
    {:else}
      <p class="empty">Empty partition.</p>
    {/if}
  </div>
{:else if reduced}
  <p class="lede">
    {reduced.results.length
      ? 'Each grouped list is summed into a single count per key. One reducer owns a key, so this value is final.'
      : 'This reducer owns no keys, so it produces no counts.'}
  </p>
  <div class="block">
    <h3>Counts <span class="muted">{reduced.results.length} results</span></h3>
    {#if reduced.results.length}
      <ul class="pairs">
        {#each reduced.results as item (item.key)}
          <li><DataPair key={item.key} value={item.value} note={`sum of ${item.count}`} /></li>
        {/each}
      </ul>
    {:else}
      <p class="empty">Nothing to reduce.</p>
    {/if}
  </div>
{:else if file}
  <p class="lede">
    The reducer output committed as its own file in HDFS. Files stay separate, which is why reducers can
    finish at different times.
  </p>
  <div class="block">
    <h3>File contents <span class="muted">{file.results.length} lines</span></h3>
    <pre>{file.results.length ? file.results.map((item) => `${item.key}\t${item.value}`).join('\n') : '(empty file)'}</pre>
  </div>
{/if}
