<script>
  import { partition } from '../engine/shuffle.js';

  let { linkId, result, phase } = $props();

  const [from, to] = linkId.split('>');
  const nameOf = (id) => {
    const kind = id.split('-')[0];
    const names = { source: 'Source text', split: 'Split', map: 'Mapper', red: 'Reducer', res: 'Result' };
    return kind === 'source' ? names.source : `${names[kind] ?? 'File'} ${id.split('-')[1]}`;
  };

  const indexOf = (id) => Number(id.split('-')[1]);
  const wordsOf = (mapper) => mapper.pairs.filter((pair) => pair.split === indexOf(from));
  const pairChip = (pair) => ({ label: pair.key, note: String(pair.value) });

  const edge = $derived.by(() => {
    const reducers = result.partitions.length;
    const mapper = result.mappers[indexOf(from)] ?? null;
    const split = result.splits.find((item) => item.index === indexOf(to));
    const part = result.partitions[indexOf(to)];
    const reduced = result.reduced[indexOf(to)];
    const file = result.files[indexOf(to)];

    if (phase.id === 'input' && from === 'source') {
      const pairs = result.mappers[split.mapper].pairs.filter((pair) => pair.split === split.index);
      return {
        op: 'Cut into a split',
        tone: 'data',
        lede: `The reader moves forward ${split.end - split.start} characters at a time and hands characters ${split.start} to ${split.end} to Mapper ${split.mapper}. Splits are cut by byte offset, not by line, so this one starts and ends mid-sentence.`,
        items: pairs.map(pairChip),
        stats: [
          ['Characters', String(split.end - split.start)],
          ['Words inside', String(pairs.length)],
          ['Assigned to', `Mapper ${split.mapper}`]
        ]
      };
    }

    if (phase.id === 'input' || phase.id === 'map') {
      const pairs = wordsOf(mapper);
      return {
        op: 'Tokenize and emit pairs',
        tone: 'mapper',
        lede: `Mapper ${mapper.mapper} scans this split for words and writes one (word, 1) pair per word to its own local map-output file. Nothing is sent to a reducer yet, and no mapper reads another mapper's output.`,
        items: pairs.map(pairChip),
        stats: [
          ['Pairs emitted', String(pairs.length)],
          ['Distinct words', String(new Set(pairs.map((pair) => pair.key)).size)],
          ['Stored in', 'Local map-output file']
        ]
      };
    }

    if (phase.id === 'shuffle') {
      const reducer = indexOf(to);
      const pairs = mapper.pairs.filter((pair) => partition(pair.key, reducers) === reducer);
      const keys = [...new Set(pairs.map((pair) => pair.key))];
      return {
        op: 'Partition, transfer, group, sort',
        tone: 'reducer',
        lede: `Every key Mapper ${mapper.mapper} emitted is hashed, and only the keys hashing to Reducer ${reducer} travel along this wire. This is the one place data crosses the network. On arrival the values are grouped by key and the keys are sorted.`,
        items: keys.map((key) => ({ label: key, note: `${pairs.filter((pair) => pair.key === key).length}` })),
        stats: [
          ['Pairs sent', String(pairs.length)],
          ['Distinct keys', String(keys.length)],
          ['Destination', `Reducer ${reducer}`]
        ]
      };
    }

    if (phase.id === 'reduce') {
      return {
        op: 'Aggregate by key',
        tone: 'output',
        lede: `Reducer ${reduced.reducer} sums each grouped list of values into a single count per key. One reducer owns a key, so every count here is final and needs no further coordination.`,
        items: reduced.results.map((item) => ({ label: item.key, note: String(item.value) })),
        stats: [
          ['Keys reduced', String(reduced.results.length)],
          ['Total count', String(reduced.results.reduce((sum, item) => sum + item.value, 0))],
          ['Owner', `Reducer ${reduced.reducer}`]
        ]
      };
    }

    return {
      op: 'Commit to HDFS',
      tone: 'output',
      lede: `Reducer ${file.reducer} writes its results to its own file and HDFS stores it separately. Reducers never wait for each other, which is why there is no single merged output file.`,
      items: file.results.map((item) => ({ label: item.key, note: String(item.value) })),
      stats: [
        ['Lines written', String(file.results.length)],
        ['File', file.name],
        ['Written by', `Reducer ${file.reducer}`]
      ]
    };
  });

  const shown = $derived(edge.items.slice(0, 14));
  const track = $derived([...shown, ...shown]);
</script>

<h3 class="node-title">{nameOf(from)} to {nameOf(to)}</h3>
<p class="lede">{edge.lede}</p>

<div class="flow" aria-hidden="true">
  <span class="flow-node">{nameOf(from)}</span>
  <div class="flow-track">
    <div class="flow-strip">
      {#each track as item, i (i)}
        <span class="flow-chip {edge.tone}">{item.label}<b>{item.note}</b></span>
      {/each}
    </div>
  </div>
  <span class="flow-node">{nameOf(to)}</span>
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
          <div class="pair"><code>{item.label}</code><span class="arrow">&rarr;</span><span class="value">{item.note}</span></div>
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
