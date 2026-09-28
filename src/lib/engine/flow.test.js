import { describe, expect, it } from 'vitest';
import { flowFor } from './flow.js';
import { DEFAULT_CONFIG, runPipeline } from './pipeline.js';
import { partition } from './shuffle.js';

const config = { mappers: 2, reducers: 2, splits: 2, caseSensitive: true, ignore: '' };
const text = 'the cat the dog the cat';
const result = runPipeline(text, config);

describe('flowFor', () => {
  it('lists the words a split hands to its mapper', () => {
    const items = flowFor(result, { id: 'input' }, 'source', 'split-0');
    const split = result.splits[0];
    const words = split.text.trim().split(/\s+/);
    expect(items.map((item) => item.label)).toEqual(words);
  });

  it('lists the pairs a mapper emits for one split', () => {
    const split = result.splits[1];
    const expected = result.mappers[split.mapper].pairs
      .filter((pair) => pair.split === 1)
      .map((pair) => [pair.key, String(pair.value)]);
    expect(flowFor(result, { id: 'map' }, 'split-1', `map-${split.mapper}`)).toEqual(
      expected.map(([label, note]) => ({ label, note }))
    );
  });

  it('lists only the keys that hash to the reducer on a shuffle wire', () => {
    const items = flowFor(result, { id: 'shuffle' }, 'map-0', 'red-1');
    const sent = result.mappers[0].pairs.filter(
      (pair) => partition(pair.key, result.partitions.length) === 1
    );
    expect(items.map((item) => item.label)).toEqual([...new Set(sent.map((pair) => pair.key))]);
    expect(items.map((item) => item.note)).toEqual(
      [...new Set(sent.map((pair) => pair.key))].map(
        (key) => String(sent.filter((pair) => pair.key === key).length)
      )
    );
  });

  it('counts how many times each key is sent on a shuffle wire', () => {
    const one = runPipeline(text, { ...config, mappers: 1, splits: 1 });
    const sentOn = (key) => {
      const target = partition(key, one.partitions.length);
      return flowFor(one, { id: 'shuffle' }, 'map-0', `red-${target}`).find(
        (item) => item.label === key
      ).note;
    };
    expect(sentOn('the')).toBe('3');
    expect(sentOn('cat')).toBe('2');
    expect(sentOn('dog')).toBe('1');
  });

  it('lists the final counts on a reduce wire and the file lines on an output wire', () => {
    expect(flowFor(result, { id: 'reduce' }, 'red-0', 'res-0')).toEqual(
      result.reduced[0].results.map((item) => ({ label: item.key, note: String(item.value) }))
    );
    expect(flowFor(result, { id: 'output' }, 'red-1', 'file-1')).toEqual(
      result.files[1].results.map((item) => ({ label: item.key, note: String(item.value) }))
    );
  });

  it('returns nothing for a wire that carries no data', () => {
    const wide = runPipeline('aaa bbb', { ...DEFAULT_CONFIG, mappers: 1, reducers: 6 });
    expect(flowFor(wide, { id: 'shuffle' }, 'map-0', 'red-5')).toEqual([]);
  });

  it('reads a split wire from the mapper it points at, not the split number', () => {
    for (const phase of [{ id: 'input' }, { id: 'map' }]) {
      for (const split of result.splits) {
        const to = `map-${split.mapper}`;
        const expected = result.mappers[split.mapper].pairs
          .filter((pair) => pair.split === split.index)
          .map((pair) => ({ label: pair.key, note: String(pair.value) }));
        expect(flowFor(result, phase, `split-${split.index}`, to)).toEqual(expected);
      }
    }
  });

  it('survives more splits than mappers on every stage', () => {
    const many = runPipeline(text, { ...DEFAULT_CONFIG, mappers: 2, splits: 9 });
    expect(() =>
      ['input', 'map', 'shuffle', 'reduce', 'output'].flatMap((id) =>
        many.splits
          .filter((split) => id === 'map' || id === 'input')
          .map((split) => flowFor(many, { id }, `split-${split.index}`, `map-${split.mapper}`))
      )
    ).not.toThrow();
  });
});
