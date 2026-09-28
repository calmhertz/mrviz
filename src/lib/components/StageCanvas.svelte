<script>
  import { partition } from '../engine/shuffle.js';

  let { result, phase, selected = $bindable(null), active = $bindable(null) } = $props();

  const NODE_WIDTH = 152;
  const NODE_HEIGHT = 56;
  const MIN_WIDTH = 780;
  const MARGIN = 56;
  const TOP = 132;
  const BOTTOM = 64;
  const MAX_STEP = 80;
  const MAX_PACKETS = 160;
  const MAX_PER_WIRE = 7;

  let scroll = $state(null);
  let width = $state(MIN_WIDTH);
  let positions = $state({});
  let drag = $state(null);

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const wordsPerSplit = (result) => {
    const counts = new Map();
    for (const node of result.mappers) {
      for (const pair of node.pairs) counts.set(pair.split, (counts.get(pair.split) ?? 0) + 1);
    }
    return counts;
  };

  const plan = $derived.by(() => {
    if (!result) return null;
    const words = wordsPerSplit(result);

    const source = { id: 'source', label: 'Source text', meta: `${result.stats.chars} chars` };
    const splits = result.splits.map((split) => ({
      id: `split-${split.index}`,
      label: `Split ${split.index}`,
      meta: `${words.get(split.index) ?? 0} words`
    }));
    const mappers = result.mappers.map((node) => ({
      id: `map-${node.mapper}`,
      label: `Mapper ${node.mapper}`,
      meta: `${node.pairs.length} pairs`
    }));
    const reducers = result.partitions.map((part) => ({
      id: `red-${part.reducer}`,
      label: `Reducer ${part.reducer}`,
      meta: `${part.groups.length} keys`
    }));
    const results = result.reduced.map((node) => ({
      id: `res-${node.reducer}`,
      label: `Result ${node.reducer}`,
      meta: `${node.results.length} counts`
    }));
    const files = result.files.map((file) => ({
      id: `file-${file.reducer}`,
      label: file.name,
      meta: `${file.results.length} lines`
    }));

    const lane = (title, nodes) => ({ title, nodes });

    if (phase.id === 'input') {
      return {
        lanes: [lane('Source', [source]), lane('Input splits', splits), lane('Mapper tasks', mappers)],
        links: [
          ...splits.map((split) => ({ from: 'source', to: split.id, weight: 1, tone: 'data' })),
          ...result.splits.map((split) => ({
            from: `split-${split.index}`,
            to: `map-${split.mapper}`,
            weight: 1,
            tone: 'mapper'
          }))
        ]
      };
    }

    if (phase.id === 'map') {
      return {
        lanes: [lane('Input splits', splits), lane('Mapper tasks', mappers)],
        links: result.splits.map((split) => ({
          from: `split-${split.index}`,
          to: `map-${split.mapper}`,
          weight: Math.max(words.get(split.index) ?? 0, 1),
          tone: 'mapper'
        }))
      };
    }

    if (phase.id === 'shuffle') {
      const flows = new Map();
      for (const node of result.mappers) {
        for (const pair of node.pairs) {
          const key = `${node.mapper}-${partition(pair.key, result.partitions.length)}`;
          flows.set(key, (flows.get(key) ?? 0) + 1);
        }
      }
      return {
        lanes: [lane('Mapper tasks', mappers), lane('Reducer tasks', reducers)],
        links: [...flows].map(([key, weight]) => {
          const [mapper, reducer] = key.split('-');
          return { from: `map-${mapper}`, to: `red-${reducer}`, weight, tone: 'reducer' };
        })
      };
    }

    if (phase.id === 'reduce') {
      return {
        lanes: [lane('Reducer tasks', reducers), lane('Aggregated results', results)],
        links: result.reduced.map((node) => ({
          from: `red-${node.reducer}`,
          to: `res-${node.reducer}`,
          weight: Math.max(node.results.length, 1),
          tone: 'output'
        }))
      };
    }

    return {
      lanes: [lane('Reducer tasks', reducers), lane('Output files', files)],
      links: result.files.map((file) => ({
        from: `red-${file.reducer}`,
        to: `file-${file.reducer}`,
        weight: Math.max(file.results.length, 1),
        tone: 'output'
      }))
    };
  });

  const rows = $derived(Math.max(1, ...(plan?.lanes.map((lane) => lane.nodes.length) ?? [])));
  const step = $derived(Math.min(MAX_STEP, Math.max(50, 600 / rows)));
  const height = $derived(TOP + rows * step + BOTTOM);

  function columnX(column) {
    const total = plan?.lanes.length ?? 1;
    if (total === 1) return MARGIN;
    return MARGIN + ((width - MARGIN * 2 - NODE_WIDTH) * column) / (total - 1);
  }

  function defaultPlace(id) {
    const column = plan.lanes.findIndex((lane) => lane.nodes.some((node) => node.id === id));
    const row = plan.lanes[column].nodes.findIndex((node) => node.id === id);
    return { x: columnX(column), y: TOP + row * step };
  }

  const nodes = $derived.by(() =>
    (plan?.lanes.flatMap((lane) => lane.nodes) ?? []).map((node) => ({
      ...node,
      ...(positions[node.id] ?? defaultPlace(node.id))
    }))
  );

  const byId = $derived(new Map(nodes.map((node) => [node.id, node])));

  const links = $derived.by(() =>
    (plan?.links ?? []).flatMap((link, index) => {
      const from = byId.get(link.from);
      const to = byId.get(link.to);
      if (!from || !to) return [];
      const x1 = from.x + NODE_WIDTH;
      const y1 = from.y + NODE_HEIGHT / 2;
      const x2 = to.x;
      const y2 = to.y + NODE_HEIGHT / 2;
      const bend = Math.max(52, Math.abs(x2 - x1) * 0.42);
      const sweep = x1 < x2 ? 1 : 0;
      return [
        {
          ...link,
          id: `${link.from}>${link.to}`,
          index,
          d: `M ${x1} ${y1} C ${x1 + bend * sweep} ${y1}, ${x2 - bend * sweep} ${y2}, ${x2} ${y2}`,
          span: Math.max(Math.abs(x2 - x1), 1) + Math.abs(y2 - y1)
        }
      ];
    })
  );

  const packets = $derived.by(() => {
    if (!links.length) return [];
    const budget = Math.max(1, Math.floor(MAX_PACKETS / links.length));
    return links.flatMap((link) => {
      const count = Math.max(1, Math.min(link.weight, MAX_PER_WIRE, budget));
      return Array.from({ length: count }, (_, i) => ({
        id: `${link.id}-${i}`,
        d: link.d,
        tone: link.tone,
        span: link.span,
        delay: -(((link.index * 0.61 + i * (1 / count)) % 1) * 2)
      }));
    });
  });

  const tone = (id) => (id === 'source' ? 'idle' : id.split('-')[0]);

  function startDrag(event, node) {
    const box = scroll.getBoundingClientRect();
    drag = {
      id: node.id,
      pointer: event.pointerId,
      offsetX: event.clientX - box.left - scroll.scrollLeft - node.x,
      offsetY: event.clientY - box.top - scroll.scrollTop - node.y
    };
    selected = node.id;
    active = null;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event) {
    if (!drag || event.pointerId !== drag.pointer) return;
    const box = scroll.getBoundingClientRect();
    positions = {
      ...positions,
      [drag.id]: {
        x: clamp(event.clientX - box.left - scroll.scrollLeft - drag.offsetX, 0, width - NODE_WIDTH),
        y: clamp(event.clientY - box.top - scroll.scrollTop - drag.offsetY, 0, height - NODE_HEIGHT)
      }
    };
  }

  const stopDrag = () => (drag = null);

  $effect(() => {
    if (!scroll) return;
    const observer = new ResizeObserver(([entry]) => {
      width = Math.max(MIN_WIDTH, entry.contentRect.width);
    });
    observer.observe(scroll);
    return () => observer.disconnect();
  });
</script>

{#if plan}
  <div class="canvas-wrap">
    <div class="canvas-scroll" role="application" aria-label="Cluster canvas" bind:this={scroll} onpointermove={moveDrag} onpointerup={stopDrag} onpointercancel={stopDrag}>
      <div class="canvas" style="width: {width}px; height: {height}px">
      <svg class="wires" width={width} height={height} aria-hidden="true">
        <defs>
          {#each ['data', 'mapper', 'reducer', 'output'] as name (name)}
            <marker id="tip-{name}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0 0 L8 4 L0 8 z" fill="var(--{name})" />
            </marker>
          {/each}
        </defs>
        {#each links as link (link.id)}
          <path
            class="wire-hit"
            class:active={active === link.id}
            d={link.d}
            onclick={() => {
              active = link.id;
              selected = null;
            }}
          />
          <path
            class="wire {link.tone}"
            class:selected={selected === link.from || selected === link.to}
            style="--weight: {Math.min(1.4 + link.weight * 0.2, 5)}px"
            d={link.d}
            marker-end="url(#tip-{link.tone})"
          />
        {/each}
      </svg>

      <div class="packets" aria-hidden="true">
        {#each packets as packet (packet.id)}
          <i
            class="packet {packet.tone}"
            style="offset-path: path('{packet.d}'); animation-delay: {packet.delay}s; animation-duration: {Math.min(5, Math.max(2.2, packet.span / 130))}s"
          ></i>
        {/each}
      </div>

      {#each nodes as node (node.id)}
        <button
          type="button"
          class="node {tone(node.id)}"
          class:selected={selected === node.id}
          class:dragging={drag?.id === node.id}
          style="left: {node.x}px; top: {node.y}px; width: {NODE_WIDTH}px; height: {NODE_HEIGHT}px"
          aria-pressed={selected === node.id}
          onclick={() => {
          selected = node.id;
          active = null;
        }}
          onpointerdown={(event) => startDrag(event, node)}
        >
          <span class="node-label">{node.label}</span>
          <span class="node-meta">{node.meta}</span>
        </button>
      {/each}
      </div>
    </div>

    <button type="button" class="reset-layout" onclick={() => (positions = {})}>Reset layout</button>
  </div>
{/if}
