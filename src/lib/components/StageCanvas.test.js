import { describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import StageCanvas from './StageCanvas.svelte';
import NodeDetails from './NodeDetails.svelte';
import { DEFAULT_CONFIG, runPipeline } from '../engine/pipeline.js';

const result = runPipeline('the quick brown fox jumps over the lazy dog', { ...DEFAULT_CONFIG, splits: 2 });
const phases = ['input', 'map', 'shuffle', 'reduce', 'output'];

describe('StageCanvas', () => {
  for (const id of phases) {
    it(`lays out nodes with real coordinates for stage ${id}`, () => {
      const target = document.createElement('div');
      document.body.append(target);
      const app = mount(StageCanvas, { target, props: { result, phase: { id } } });

      const nodes = target.querySelectorAll('.node');
      const wires = target.querySelectorAll('.wire');
      const canvas = target.querySelector('.canvas');

      expect(nodes.length).toBeGreaterThan(0);
      expect(wires.length).toBeGreaterThan(0);
      expect(Number.parseFloat(canvas.style.height)).toBeGreaterThan(0);

      const columns = new Set();
      for (const node of nodes) {
        const x = Number.parseFloat(node.style.left);
        const y = Number.parseFloat(node.style.top);
        expect(Number.isNaN(x)).toBe(false);
        expect(Number.isNaN(y)).toBe(false);
        expect(y).toBeGreaterThan(0);
        columns.add(x);
      }
      expect(columns.size).toBeGreaterThan(1);

      unmount(app);
      target.remove();
    });
  }

  it('marks a clicked node as selected and its wires', () => {
    const target = document.createElement('div');
    document.body.append(target);
    const app = mount(StageCanvas, { target, props: { result, phase: { id: 'shuffle' } } });
    flushSync();

    const [node] = target.querySelectorAll('.node');
    expect(node.getAttribute('aria-pressed')).toBe('false');

    node.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    flushSync();

    expect(node.getAttribute('aria-pressed')).toBe('true');
    expect(node.classList.contains('selected')).toBe(true);
    expect(target.querySelectorAll('.wire.selected').length).toBeGreaterThan(0);

    unmount(app);
    target.remove();
  });

  it('renders a wire between each lane pair for the stage', () => {
    const target = document.createElement('div');
    document.body.append(target);
    const app = mount(StageCanvas, { target, props: { result, phase: { id: 'shuffle' } } });

    const tones = new Set([...target.querySelectorAll('.wire')].map((wire) => wire.className));
    expect(tones.size).toBe(1);
    expect([...tones][0]).toContain('reducer');

    unmount(app);
    target.remove();
  });
});

describe('NodeDetails', () => {
  const cases = [
    ['source', 'Source text'],
    ['split-0', 'Split 0'],
    ['map-0', 'Mapper 0'],
    ['red-0', 'Reducer 0'],
    ['res-0', 'Result 0'],
    ['file-0', 'part-r-00000']
  ];

  for (const [id, needle] of cases) {
    it(`explains node ${id} with real data`, () => {
      const target = document.createElement('div');
      document.body.append(target);
      const app = mount(NodeDetails, { target, props: { id, result } });

      expect(target.textContent).toContain(needle);
      expect(target.querySelector('.lede').textContent.length).toBeGreaterThan(40);

      unmount(app);
      target.remove();
    });
  }

  it('shows the source text for the source node', () => {
    const target = document.createElement('div');
    document.body.append(target);
    const app = mount(NodeDetails, { target, props: { id: 'source', result } });

    expect(target.querySelector('pre').textContent).toBe(result.text);

    unmount(app);
    target.remove();
  });

  it('lists the words a mapper emitted', () => {
    const target = document.createElement('div');
    document.body.append(target);
    const app = mount(NodeDetails, { target, props: { id: 'map-0', result } });

    const keys = [...target.querySelectorAll('.pair code')].map((node) => node.textContent);
    expect(keys).toEqual(result.mappers[0].pairs.map((pair) => pair.key));

    unmount(app);
    target.remove();
  });
});
