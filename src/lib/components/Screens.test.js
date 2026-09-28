import { describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import App from '../../App.svelte';
import SetupScreen from './SetupScreen.svelte';
import SimulateScreen from './SimulateScreen.svelte';
import { DEFAULT_CONFIG, runPipeline } from '../engine/pipeline.js';
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
        onToggle: () => {},
        onSimulate: () => {}
      }
    });
    flushSync();

    expect(target.querySelector('.errors').textContent).toContain('at least one word');
    expect(byText(target, 'Simulate').disabled).toBe(true);

    unmount(app);
    target.remove();
  });

  it('lists one live note per parameter and offers the two toggles', () => {
    const target = document.createElement('div');
    document.body.append(target);
    const app = mount(SetupScreen, {
      target,
      props: {
        text: 'the cat',
        config: DEFAULT_CONFIG,
        errors: [],
        notes: ['note one', 'note two'],
        onText: () => {},
        onCount: () => {},
        onToggle: () => {},
        onSimulate: () => {}
      }
    });
    flushSync();

    expect(target.querySelectorAll('.notes-list li')).toHaveLength(2);
    expect(target.querySelectorAll('.switch')).toHaveLength(2);
    expect(target.querySelectorAll('input[type="number"]')).toHaveLength(3);
    expect(byText(target, 'Simulate').disabled).toBe(false);

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
    expect(target.querySelector('.hint').textContent).toContain('Click any node');
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
