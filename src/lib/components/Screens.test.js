import { describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import App from '../../App.svelte';
import EdgeDetails from './EdgeDetails.svelte';
import SetupScreen from './SetupScreen.svelte';
import SimulateScreen from './SimulateScreen.svelte';
import { DEFAULT_CONFIG, runPipeline } from '../engine/pipeline.js';
import { partition } from '../engine/shuffle.js';
import { phases } from '../data/concepts.js';

const result = runPipeline('the quick brown fox jumps over the lazy dog', DEFAULT_CONFIG);

function click(node) {
  node.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  flushSync();
}

const byText = (root, text) => [...root.querySelectorAll('button')].find((b) => b.textContent.trim() === text);

describe('SetupScreen', () => {
  it('blocks the simulate button when the input has no words', () => {
    const target = document.createElement('div');
    document.body.append(target);
    const app = mount(SetupScreen, {
      target,
      props: {
        text: '   ',
        config: DEFAULT_CONFIG,
        errors: ['Enter some text containing at least one word.'],
        notes: [],
        onText: () => {},
        onCount: () => {},
        onConfig: () => {},
        onSimulate: () => {}
      }
    });
    flushSync();

    expect(target.querySelector('.errors').textContent).toContain('at least one word');
    expect(byText(target, 'Simulate').disabled).toBe(true);

    unmount(app);
    target.remove();
  });

  it('offers three counts, an ignore list, and a case switch', () => {
    const target = document.createElement('div');
    document.body.append(target);
    const app = mount(SetupScreen, {
      target,
      props: {
        text: 'the cat',
        config: { ...DEFAULT_CONFIG, ignore: 'the, and' },
        errors: [],
        notes: ['note one', 'note two'],
        onText: () => {},
        onCount: () => {},
        onConfig: () => {},
        onSimulate: () => {}
      }
    });
    flushSync();

    expect(target.querySelectorAll('.notes-list li')).toHaveLength(2);
    expect(target.querySelectorAll('input[type="number"]')).toHaveLength(3);
    expect(target.querySelector('input[type="text"]').value).toBe('the, and');
    expect(target.querySelector('.switch')).not.toBeNull();
    expect(byText(target, 'Simulate').disabled).toBe(false);

    unmount(app);
    target.remove();
  });

  it('passes the ignore list through onConfig as the user types', () => {
    const seen = [];
    const target = document.createElement('div');
    document.body.append(target);
    const app = mount(SetupScreen, {
      target,
      props: {
        text: 'the cat',
        config: DEFAULT_CONFIG,
        errors: [],
        notes: [],
        onText: () => {},
        onCount: () => {},
        onConfig: (key, value) => seen.push([key, value]),
        onSimulate: () => {}
      }
    });
    flushSync();

    const input = target.querySelector('input[type="text"]');
    input.value = 'the, and, of';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    flushSync();

    expect(seen).toEqual([['ignore', 'the, and, of']]);

    unmount(app);
    target.remove();
  });
});

describe('SimulateScreen', () => {
  function mountScreen(overrides = {}) {
    const target = document.createElement('div');
    document.body.append(target);
    const app = mount(SimulateScreen, {
      target,
      props: {
        result,
        phase: phases[0],
        stageIndex: 0,
        stages: phases,
        selected: null,
        active: null,
        onStage: () => {},
        onEdit: () => {},
        ...overrides
      }
    });
    flushSync();
    return { target, app };
  }

  it('shows the stage description until a node is clicked', () => {
    const { target, app } = mountScreen();

    expect(target.querySelector('.panel-body').textContent).toContain(phases[0].what);
    expect(target.querySelector('.hint').textContent).toContain('click a wire');
    expect(target.querySelector('.node-title')).toBeNull();

    click(target.querySelector('.node'));
    flushSync();

    expect(target.querySelector('.node-title')).not.toBeNull();
    expect(target.querySelector('.back')).not.toBeNull();
    expect(target.querySelector('.panel-body').textContent).not.toContain(phases[0].what);

    unmount(app);
    target.remove();
  });

  it('returns to the stage description via the back button', () => {
    const { target, app } = mountScreen();

    click(target.querySelector('.node'));
    click(target.querySelector('.back'));

    expect(target.querySelector('.node-title')).toBeNull();
    expect(target.querySelector('.panel-body').textContent).toContain(phases[0].what);

    unmount(app);
    target.remove();
  });

  it('disables Previous on the first stage and replaces Next with Start over on the last', () => {
    const first = mountScreen();
    expect(byText(first.target, 'Previous').disabled).toBe(true);
    expect(byText(first.target, 'Next')).toBeTruthy();
    unmount(first.app);
    first.target.remove();

    const last = mountScreen({ phase: phases[4], stageIndex: 4 });
    expect(byText(last.target, 'Next')).toBeUndefined();
    expect(byText(last.target, 'Start over')).toBeTruthy();
    unmount(last.app);
    last.target.remove();
  });

  it('asks the parent to move one stage forward and back', () => {
    const seen = [];
    const { target, app } = mountScreen({ phase: phases[1], stageIndex: 1, onStage: (index) => seen.push(index) });

    click(byText(target, 'Next'));
    click(byText(target, 'Previous'));

    expect(seen).toEqual([2, 0]);
    expect(byText(target, 'Edit input')).toBeTruthy();

    unmount(app);
    target.remove();
  });

  it('renders the canvas next to a panel that stays a fixed quarter of the screen', () => {
    const { target, app } = mountScreen();

    expect(target.querySelector('.sim')).not.toBeNull();
    expect(target.querySelector('.sim-canvas .node')).not.toBeNull();
    expect(target.querySelector('.sim-panel')).not.toBeNull();

    unmount(app);
    target.remove();
  });
});

describe('EdgeDetails', () => {
  const edges = [
    ['input', 'source>split-0', 'Cut into a split', 'Word range'],
    ['input', 'split-0>map-0', 'Tokenize and emit pairs', 'Pairs emitted'],
    ['map', 'split-0>map-0', 'Tokenize and emit pairs', 'Pairs emitted'],
    ['shuffle', 'map-0>red-0', 'Partition, transfer, group, sort', 'Pairs sent'],
    ['reduce', 'red-0>res-0', 'Aggregate by key', 'Keys reduced'],
    ['output', 'red-0>file-0', 'Commit to HDFS', 'Lines written']
  ];

  for (const [id, linkId, op, stat] of edges) {
    it(`explains ${id} edge ${linkId}`, () => {
      const target = document.createElement('div');
      document.body.append(target);
      const app = mount(EdgeDetails, { target, props: { linkId, result, phase: { id } } });
      flushSync();

      expect(target.querySelector('.node-title').textContent).toContain('to');
      expect(target.querySelector('.lede').textContent.length).toBeGreaterThan(60);
      expect(target.querySelector('.block .muted').textContent).toContain(op);
      expect(target.textContent).toContain(stat);
      expect(target.querySelectorAll('.flow-chip').length).toBeGreaterThan(0);

      unmount(app);
      target.remove();
    });
  }

  it('renders every wire on every stage, including splits past the mapper count', () => {
    const ids = [
      ...result.splits.flatMap((split) => [
        `source>split-${split.index}`,
        `split-${split.index}>map-${split.mapper}`
      ]),
      ...result.mappers.flatMap((mapper) =>
        result.partitions.map((part) => `map-${mapper.mapper}>red-${part.reducer}`)
      ),
      ...result.reduced.map((node) => `red-${node.reducer}>res-${node.reducer}`),
      ...result.files.map((file) => `red-${file.reducer}>file-${file.reducer}`)
    ];

    const byPhase = {
      input: ids.filter((id) => id.startsWith('source>') || /^split-\d+>map-/.test(id)),
      map: ids.filter((id) => /^split-\d+>map-/.test(id)),
      shuffle: ids.filter((id) => /^map-\d+>red-/.test(id)),
      reduce: ids.filter((id) => /^red-\d+>res-/.test(id)),
      output: ids.filter((id) => /^red-\d+>file-/.test(id))
    };

    for (const [phase, links] of Object.entries(byPhase)) {
      for (const linkId of links) {
        const target = document.createElement('div');
        document.body.append(target);
        const app = mount(EdgeDetails, { target, props: { linkId, result, phase: { id: phase } } });
        flushSync();
        expect(target.querySelector('.node-title').textContent).toContain(' to ');
        unmount(app);
        target.remove();
      }
    }
  });

  it('only lists the keys that actually hash to the clicked reducer', () => {
    const target = document.createElement('div');
    document.body.append(target);
    const app = mount(EdgeDetails, {
      target,
      props: { linkId: 'map-0>red-1', result, phase: { id: 'shuffle' } }
    });
    flushSync();

    const sent = result.mappers[0].pairs.filter((pair) => partition(pair.key, result.partitions.length) === 1);
    const shown = [...target.querySelectorAll('.pair code')].map((node) => node.textContent);
    expect(shown).toEqual([...new Set(sent.map((pair) => pair.key))]);
    expect(target.querySelector('.flow-strip').children.length).toBe(shown.length * 2);

    unmount(app);
    target.remove();
  });

  it('reports an empty wire rather than inventing data', () => {
    const empty = runPipeline('aaa bbb', { ...DEFAULT_CONFIG, mappers: 1, reducers: 6 });
    const target = document.createElement('div');
    document.body.append(target);
    const app = mount(EdgeDetails, { target, props: { linkId: 'red-5>file-5', result: empty, phase: { id: 'output' } } });
    flushSync();

    expect(target.querySelector('.empty').textContent).toContain('Nothing travels');

    unmount(app);
    target.remove();
  });
});

describe('App', () => {
  it('opens on the setup screen and switches to the simulation after simulating', () => {
    const target = document.createElement('div');
    document.body.append(target);
    const app = mount(App, { target });
    flushSync();

    expect(target.querySelector('.setup-card')).not.toBeNull();
    expect(target.querySelector('.sim')).toBeNull();

    click(byText(target, 'Simulate'));

    expect(target.querySelector('.setup-card')).toBeNull();
    expect(target.querySelector('.sim')).not.toBeNull();
    expect(target.querySelectorAll('.node').length).toBeGreaterThan(0);

    click(byText(target, 'Edit input'));
    expect(target.querySelector('.setup-card')).not.toBeNull();
    expect(target.querySelector('textarea').value).toContain('Hadoop');

    unmount(app);
    target.remove();
  });

  it('walks through all five stages and returns to the first on start over', () => {
    const target = document.createElement('div');
    document.body.append(target);
    const app = mount(App, { target });
    flushSync();

    click(byText(target, 'Simulate'));

    for (const phase of phases.slice(0, -1)) {
      expect(target.querySelector('.stage-caption').textContent).toContain(phase.title);
      click(byText(target, 'Next'));
    }

    expect(target.querySelector('.stage-caption').textContent).toContain(phases[4].title);
    expect(target.querySelectorAll('.node').length).toBeGreaterThan(0);

    click(byText(target, 'Start over'));
    expect(target.querySelector('.stage-caption').textContent).toContain(phases[0].title);

    unmount(app);
    target.remove();
  });
});
