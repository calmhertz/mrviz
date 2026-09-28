import { describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import StageCanvas from './StageCanvas.svelte';
import NodeDetails from './NodeDetails.svelte';
import { DEFAULT_CONFIG, runPipeline } from '../engine/pipeline.js';
import { partition } from '../engine/shuffle.js';
import { defaultText } from '../data/concepts.js';

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
    flushSync();

    const tones = new Set([...target.querySelectorAll('.wire')].map((wire) => wire.className));
    expect(tones.size).toBe(1);
    expect([...tones][0]).toContain('reducer');

    unmount(app);
    target.remove();
  });

  it('gives every visible wire a clickable hit area', () => {
    const target = document.createElement('div');
    document.body.append(target);
    const app = mount(StageCanvas, { target, props: { result, phase: { id: 'map' } } });
    flushSync();

    const hits = target.querySelectorAll('.wire-hit');
    expect(hits.length).toBe(target.querySelectorAll('.wire').length);
    expect(target.querySelector('.wires').getAttribute('aria-hidden')).toBe('true');

    unmount(app);
    target.remove();
  });
});

describe('StageCanvas zoom', () => {
  const click = (node) => node.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

  const setup = () => {
    const target = document.createElement('div');
    document.body.append(target);
    const app = mount(StageCanvas, { target, props: { result, phase: { id: 'shuffle' } } });
    flushSync();
    return { target, app };
  };

  const zoomIn = (target, times) => {
    for (let i = 0; i < times; i += 1) click(target.querySelector('[aria-label="Zoom in"]'));
    flushSync();
  };

  const pointer = (node, type, clientX, clientY) =>
    node.dispatchEvent(
      new window.PointerEvent(type, { bubbles: true, pointerId: 1, clientX, clientY })
    );

  const surface = (target) => {
    const scrollEl = target.querySelector('.canvas-scroll');
    scrollEl.getBoundingClientRect = () => ({ left: 0, top: 0, right: 800, bottom: 600 });
    scrollEl.scrollLeft = 30;
    scrollEl.scrollTop = 20;
    return scrollEl;
  };

  it('starts with plain packets and no data chips', () => {
    const { target, app } = setup();
    expect(target.querySelectorAll('.packet').length).toBeGreaterThan(0);
    expect(target.querySelectorAll('.packet-chip').length).toBe(0);
    expect(target.querySelector('.tool.level').textContent).toBe('100%');
    unmount(app);
    target.remove();
  });

  it('swaps the dots for the real data once zoomed past the detail level', () => {
    const { target, app } = setup();
    zoomIn(target, 3);

    expect(target.querySelector('.tool.level').textContent).toBe('160%');
    expect(target.querySelectorAll('.packet').length).toBe(0);

    const chips = [...target.querySelectorAll('.packet-chip')];
    expect(chips.length).toBeGreaterThan(0);
    expect(chips[0].querySelector('.chip-key').textContent.length).toBeGreaterThan(0);
    expect(target.querySelector('.canvas-hint').classList.contains('on')).toBe(true);

    unmount(app);
    target.remove();
  });

  it('puts the dots back when zoomed out again', () => {
    const { target, app } = setup();
    zoomIn(target, 3);
    click(target.querySelector('[aria-label="Zoom out"]'));
    flushSync();

    expect(target.querySelectorAll('.packet-chip').length).toBe(0);
    expect(target.querySelectorAll('.packet').length).toBeGreaterThan(0);

    unmount(app);
    target.remove();
  });

  it('carries the keys that hash to the wire on its chips', () => {
    const { target, app } = setup();
    zoomIn(target, 3);

    const wire = target.querySelector('[data-wire="map-0>red-0"]');
    const sent = result.mappers[0].pairs.filter(
      (pair) => partition(pair.key, result.partitions.length) === 0
    );
    const shown = [...wire.parentElement.children]
      .filter((node) => node.dataset.wire === 'map-0>red-0')
      .flatMap((node) => [...node.querySelectorAll('.chip-key')].map((key) => key.textContent));
    expect(shown).toEqual([...new Set(sent.map((pair) => pair.key))].slice(0, 4));

    unmount(app);
    target.remove();
  });

  it('resets zoom to 100 percent from the level button', () => {
    const { target, app } = setup();
    zoomIn(target, 2);
    click(target.querySelector('.tool.level'));
    flushSync();

    expect(target.querySelector('.tool.level').textContent).toBe('100%');
    expect(target.querySelectorAll('.packet-chip').length).toBe(0);

    unmount(app);
    target.remove();
  });

  it('disables each zoom button at the ends of the range', () => {
    const { target, app } = setup();
    expect(target.querySelector('[aria-label="Zoom out"]').disabled).toBe(false);

    for (let i = 0; i < 6; i += 1) click(target.querySelector('[aria-label="Zoom out"]'));
    flushSync();
    expect(target.querySelector('.tool.level').textContent).toBe('60%');
    expect(target.querySelector('[aria-label="Zoom out"]').disabled).toBe(true);

    zoomIn(target, 12);
    expect(target.querySelector('.tool.level').textContent).toBe('240%');
    expect(target.querySelector('[aria-label="Zoom in"]').disabled).toBe(true);

    unmount(app);
    target.remove();
  });

  it('shows the real data on every stage once zoomed in, with the default cluster', () => {
    const big = runPipeline(defaultText, DEFAULT_CONFIG);
    expect(big.splits.length).toBeGreaterThan(big.mappers.length);
    expect(big.splits.some((split) => split.index >= big.mappers.length)).toBe(true);

    for (const id of ['input', 'map', 'shuffle', 'reduce', 'output']) {
      const target = document.createElement('div');
      document.body.append(target);
      const app = mount(StageCanvas, { target, props: { result: big, phase: { id } } });
      flushSync();

      click(target.querySelector('[aria-label="Zoom in"]'));
      click(target.querySelector('[aria-label="Zoom in"]'));
      click(target.querySelector('[aria-label="Zoom in"]'));
      flushSync();

      expect(target.querySelector('.tool.level').textContent, id).toBe('160%');
      const chips = target.querySelectorAll('.packet-chip');
      expect(chips.length, id).toBeGreaterThan(0);
      for (const chip of chips) {
        expect(chip.querySelector('.chip-key').textContent.length, id).toBeGreaterThan(0);
      }

      unmount(app);
      target.remove();
    }
  });

  it('keeps the data chips near a fixed size while the canvas zooms', () => {
    const { target, app } = setup();
    const level = () => parseFloat(target.querySelector('.tool.level').textContent);
    const scale = () =>
      parseFloat(target.querySelector('.packet-chip').style.getPropertyValue('--chip-scale'));
    const effective = () => +(scale() * (level() / 100)).toFixed(2);

    zoomIn(target, 3);
    const seen = [effective()];
    for (let i = 0; i < 4; i += 1) {
      click(target.querySelector('[aria-label="Zoom in"]'));
      flushSync();
      seen.push(effective());
    }

    expect(seen).toEqual([1.05, 1.15, 1.25, 1.35, 1.35]);
    expect(level()).toBe(240);

    unmount(app);
    target.remove();
  });

  it('draws each chip as a single key and value pill', () => {
    const { target, app } = setup();
    zoomIn(target, 3);

    for (const chip of target.querySelectorAll('.packet-chip')) {
      const kids = [...chip.children];
      expect(kids.length).toBe(1);
      expect(kids[0].className).toBe('chip');
      expect([...kids[0].children].map((node) => node.className)).toEqual(['chip-key', 'chip-note']);
    }

    unmount(app);
    target.remove();
  });

  it('spreads the chips on a wire across a whole animation cycle', () => {
    const { target, app } = setup();
    zoomIn(target, 3);

    const byWire = {};
    for (const chip of target.querySelectorAll('.packet-chip')) {
      const wire = chip.dataset.wire;
      (byWire[wire] ||= []).push({
        phase: Math.abs(parseFloat(chip.style.animationDelay)) / parseFloat(chip.style.animationDuration)
      });
    }

    const wire = Object.entries(byWire).find(([, list]) => list.length > 2);
    expect(wire).toBeTruthy();
    const phases = wire[1].map((chip) => chip.phase).sort((a, b) => a - b);
    const step = 1 / phases.length;

    phases.forEach((phase, i) => expect(phase).toBeCloseTo(i * step, 5));
    expect(phases[0]).toBeCloseTo(0, 5);
    expect(phases[phases.length - 1]).toBeCloseTo(1 - step, 5);

    unmount(app);
    target.remove();
  });

  it('shows every item on a wire that is long enough, and marks the rest', () => {
    const { target, app } = setup();
    zoomIn(target, 3);

    const markers = target.querySelectorAll('.packet-chip.more');
    for (const marker of markers) {
      expect(marker.querySelector('.chip-key').textContent).toMatch(/^\+\d+$/);
      expect(marker.querySelector('.chip-note').textContent).toBe('');
    }

    unmount(app);
    target.remove();
  });

  it('drags a node by the pointer distance in canvas units, not screen units', () => {
    const { target, app } = setup();
    zoomIn(target, 3);
    const node = target.querySelector('.node.map');
    const scrollEl = surface(target);

    const from = parseFloat(node.style.left);
    const top = parseFloat(node.style.top);
    pointer(node, 'pointerdown', from * 1.6 + 10, top * 1.6 + 12);
    pointer(scrollEl, 'pointermove', from * 1.6 + 42, top * 1.6 + 44);
    flushSync();

    expect(parseFloat(node.style.left) - from).toBeCloseTo(20, 5);
    expect(parseFloat(node.style.top) - top).toBeCloseTo(20, 5);
    expect(parseFloat(node.style.left) * 1.6).toBeCloseTo(from * 1.6 + 32, 5);

    unmount(app);
    target.remove();
  });

  it('drags a node by the pointer distance at full size too', () => {
    const { target, app } = setup();
    const node = target.querySelector('.node.map');
    const scrollEl = surface(target);

    const from = parseFloat(node.style.left);
    pointer(node, 'pointerdown', from + 10, parseFloat(node.style.top) + 12);
    pointer(scrollEl, 'pointermove', from + 42, parseFloat(node.style.top) + 44);
    flushSync();

    expect(parseFloat(node.style.left) - from).toBeCloseTo(32, 5);

    unmount(app);
    target.remove();
  });

  it('keeps a dragged node under a still cursor when the canvas scrolls', () => {
    const { target, app } = setup();
    const node = target.querySelector('.node.map');
    const scrollEl = surface(target);

    const from = parseFloat(node.style.left);
    const atX = from + 10;
    const atY = parseFloat(node.style.top) + 12;
    pointer(node, 'pointerdown', atX, atY);
    scrollEl.scrollLeft = 130;
    pointer(scrollEl, 'pointermove', atX, atY);
    flushSync();

    expect(parseFloat(node.style.left) - from).toBeCloseTo(100, 5);

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
