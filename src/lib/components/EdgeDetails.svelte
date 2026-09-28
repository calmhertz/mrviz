<script>
  import { flowFor } from '../engine/flow.js';
  import { partition } from '../engine/shuffle.js';

  let { linkId, result, phase } = $props();

  const names = { source: 'Source text', split: 'Split', map: 'Mapper', red: 'Reducer', res: 'Result', file: 'File' };
  const nameOf = (id) => {
    const kind = id.split('-')[0];
    return kind === 'source' ? names.source : `${names[kind] ?? 'Node'} ${id.split('-')[1]}`;
  };

  const indexOf = (id) => Number(id.split('-')[1]);
  const unique = (pairs) => [...new Set(pairs.map((pair) => pair.key))];

  function describe(from, to) {
    if (phase.id === 'input' && from === 'source') {
      const split = result.splits.find((item) => item.index === indexOf(to));
      return {
        op: 'Cut into a split',
        tone: 'data',
        lede: `The reader groups whole words into splits, so no word is ever cut in half. This one holds words ${split.startWord + 1} to ${split.startWord + split.words} and goes to Mapper ${split.mapper}. Nothing travels over the network yet, a split is just a slice of the input.`,
        stats: [
          ['Words', split.words],
          ['Word range', `${split.startWord + 1} to ${split.startWord + split.words}`],
          ['Assigned to', `Mapper ${split.mapper}`]
        ]
      };
    }

    if (phase.id === 'input' || phase.id === 'map') {
      const mapper = result.mappers[indexOf(to)];
      const pairs = mapper.pairs.filter((pair) => pair.split === indexOf(from));
      return {
        op: 'Tokenize and emit pairs',
        tone: 'mapper',
        lede: `Mapper ${mapper.mapper} scans this split for words and writes one (word, 1) pair per word to its own local map-output file. Nothing is sent to a reducer yet, and no mapper reads another mapper's output.`,
        stats: [
          ['Pairs emitted', pairs.length],
          ['Distinct words', unique(pairs).length],
          ['Stored in', 'Local map file']
        ]
      };
    }

    if (phase.id === 'shuffle') {
      const reducer = indexOf(to);
      const mapper = result.mappers[indexOf(from)];
      const pairs = mapper.pairs.filter(
        (pair) => partition(pair.key, result.partitions.length) === reducer
      );
      return {
        op: 'Partition, transfer, group, sort',
        tone: 'reducer',
        lede: `Every key Mapper ${mapper.mapper} emitted is hashed, and only the keys hashing to Reducer ${reducer} travel along this wire. This is the one place data crosses the network. On arrival the values are grouped by key and the keys are sorted.`,
        stats: [
          ['Pairs sent', pairs.length],
          ['Distinct keys', unique(pairs).length],
          ['Destination', `Reducer ${reducer}`]
        ]
      };
    }

    if (phase.id === 'reduce') {
      const reduced = result.reduced[indexOf(to)];
      return {
        op: 'Aggregate by key',
        tone: 'output',
        lede: `Reducer ${reduced.reducer} sums each grouped list of values into a single count per key. One reducer owns a key, so every count here is final and needs no further coordination.`,
        stats: [
          ['Keys reduced', reduced.results.length],
          ['Total count', reduced.results.reduce((sum, item) => sum + item.value, 0)],
          ['Owner', `Reducer ${reduced.reducer}`]
        ]
      };
    }

    const file = result.files[indexOf(to)];

    return {
      op: 'Commit to HDFS',
      tone: 'output',
      lede: `Reducer ${file.reducer} writes its results to its own file and HDFS stores it separately. Reducers never wait for each other, which is why there is no single merged output file.`,
      stats: [
        ['Lines written', file.results.length],
        ['File', file.name],
        ['Written by', `Reducer ${file.reducer}`]
      ]
    };
  }

  const edge = $derived.by(() => {
    const [from, to] = linkId.split('>');
    return { from, to, items: flowFor(result, phase, from, to), ...describe(from, to) };
  });

  const shown = $derived(edge.items.slice(0, 14));
  const track = $derived([...shown, ...shown]);
</script>

<h3 class="node-title">{nameOf(edge.from)} to {nameOf(edge.to)}</h3>
<p class="lede">{edge.lede}</p>

<div class="flow" aria-hidden="true">
  <span class="flow-node">{nameOf(edge.from)}</span>
  <div class="flow-track">
    <div class="flow-strip">
      {#each track as item, i (i)}
        <span class="flow-chip {edge.tone}">{item.label}<b>{item.note}</b></span>
      {/each}
    </div>
  </div>
  <span class="flow-node">{nameOf(edge.to)}</span>
</div>

<div class="block">
  <h3>Operation <span class="muted">{edge.op}</span></h3>
  <dl class="stats">
    {#each edge.stats as [label, value] (label)}
      <div><dt>{label}</dt><dd>{value}</dd></div>
    {/each}
  </dl>
</div>

<div class="block">
  <h3>
    What travels here
    <span class="muted">{edge.items.length} item{edge.items.length === 1 ? '' : 's'}</span>
  </h3>
  {#if shown.length}
    <ul class="pairs">
      {#each shown as item (item.label)}
        <li>
          <div class="pair">
            <code>{item.label}</code>
            <span class="arrow" aria-hidden="true">&rarr;</span>
            <span class="value">{item.note}</span>
          </div>
        </li>
      {/each}
    </ul>
    {#if edge.items.length > shown.length}
      <p class="empty">and {edge.items.length - shown.length} more</p>
    {/if}
  {:else}
    <p class="empty">Nothing travels along this wire.</p>
  {/if}
</div>
