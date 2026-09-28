import { describe, expect, it } from 'vitest';
import { partition, shuffle } from './shuffle.js';
import { splitText } from './split.js';
import { parseIgnored, tokenize } from './tokenize.js';
import { mapSplits } from './map.js';
import { explainConfig, runPipeline, validate } from './pipeline.js';
import { assignMappers } from './split.js';

const config = { mappers: 3, reducers: 2, splits: 4, caseSensitive: true, ignore: '' };

describe('tokenize', () => {
  it('splits on punctuation and whitespace but keeps letters and digits', () => {
    expect(tokenize('Cat dog, cat! 42 times')).toEqual(['Cat', 'dog', 'cat', '42', 'times']);
  });

  it('returns nothing for input without words', () => {
    expect(tokenize('  ...\n\t ')).toEqual([]);
  });
});

describe('splitText', () => {
  it('cuts contiguous character ranges of about equal length', () => {
    const splits = splitText('abcdefgh', 4);
    expect(splits.map((split) => split.text)).toEqual(['ab', 'cd', 'ef', 'gh']);
    expect(splits.map((split) => [split.start, split.end])).toEqual([
      [0, 2],
      [2, 4],
      [4, 6],
      [6, 8]
    ]);
  });

  it('covers the whole text with no gaps or overlap', () => {
    const text = 'Hadoop MapReduce processes data in parallel.\nthe quick brown fox jumps over the lazy dog';
    const splits = splitText(text, 5);
    expect(splits.map((split) => split.text).join('')).toBe(text);
  });

  it('drops ranges that hold no letters or digits', () => {
    const splits = splitText('aaaa     bbbb', 4);
    expect(splits.map((split) => split.text)).toEqual(['aaaa', ' bbb', 'b']);
    expect(splits.map((split) => split.index)).toEqual([0, 1, 2]);
  });

  it('flags a boundary that fell inside a word', () => {
    expect(splitText('abcdefgh', 2).map((split) => split.cut)).toEqual([false, true]);
    expect(splitText('abcd efgh', 2).map((split) => split.cut)).toEqual([false, false]);
  });

  it('never produces a range shorter than one character', () => {
    expect(splitText('word', 8)).toHaveLength(4);
  });
});

describe('runPipeline', () => {
  it('is deterministic for identical input and configuration', () => {
    const text = 'the quick brown fox jumps over the lazy dog the fox';
    expect(runPipeline(text, config)).toEqual(runPipeline(text, config));
  });

  it('assigns splits round-robin so a mapper can own several splits', () => {
    const splits = assignMappers(splitText('abcdefgh', 4), 2);
    expect(splits.map((split) => split.mapper)).toEqual([0, 1, 0, 1]);
  });

  it('emits one (word, 1) pair per word and records the emitting mapper', () => {
    const splits = assignMappers(splitText('Cat dog cat', 1), 1);
    const [mapper] = mapSplits(splits, 1, config);
    expect(mapper.pairs.map((pair) => [pair.key, pair.value])).toEqual([
      ['Cat', 1],
      ['dog', 1],
      ['cat', 1]
    ]);
  });

  it('routes every occurrence of a key to one reducer', () => {
    const result = runPipeline('a b a c a b', { mappers: 3, reducers: 4 });
    const counts = new Map();
    for (const part of result.partitions) {
      for (const group of part.groups) {
        expect(counts.has(group.key)).toBe(false);
        counts.set(group.key, group);
      }
    }
    expect(result.partitions.reduce((total, part) => total + part.groups.length, 0)).toBe(counts.size);
  });

  it('sorts keys lexicographically inside each reducer', () => {
    const result = runPipeline('zebra apple mango kiwi berry', config);
    for (const part of result.partitions) {
      const keys = part.groups.map((group) => group.key);
      expect(keys).toEqual([...keys].sort());
    }
  });

  it('counts every word across all mappers and reducers', () => {
    const result = runPipeline('a b a c a b', { mappers: 3, reducers: 4 });
    const totals = Object.fromEntries(result.combined.map((item) => [item.key, item.value]));
    expect(totals).toEqual({ a: 3, b: 2, c: 1 });
    expect(result.stats.words).toBe(6);
    expect(result.stats.keys).toBe(3);
  });

  it('writes one output file per reducer and a globally sorted combined view', () => {
    const result = runPipeline('a b a c', { mappers: 2, reducers: 3 });
    expect(result.files.map((file) => file.name)).toEqual([
      'part-r-00000',
      'part-r-00001',
      'part-r-00002'
    ]);
    const keys = result.combined.map((item) => item.key);
    expect(keys).toEqual([...keys].sort());
    expect(result.combined.reduce((total, item) => total + item.value, 0)).toBe(4);
  });

  it('keeps a part file for a reducer that received no key', () => {
    const result = runPipeline('a b c', { mappers: 1, reducers: 6 });
    const empty = result.files.filter((file) => file.results.length === 0);
    expect(result.files).toHaveLength(6);
    expect(empty.length).toBeGreaterThan(0);
    expect(result.combined).toHaveLength(3);
  });

  it('reports empty input instead of producing results', () => {
    expect(validate('   \n  ')).toEqual(['Enter some text containing at least one word.']);
    expect(validate('hello')).toEqual([]);
  });
});

describe('partition', () => {
  it('is stable and stays inside the reducer range', () => {
    for (const key of ['alpha', 'beta', 'gamma', 'MapReduce', '42']) {
      const assigned = partition(key, 4);
      expect(partition(key, 4)).toBe(assigned);
      expect(assigned).toBeGreaterThanOrEqual(0);
      expect(assigned).toBeLessThan(4);
    }
  });

  it('returns the only reducer when a single reducer is configured', () => {
    expect(shuffle(mapSplits(assignMappers(splitText('x y', 1), 1), 1, config), 1)[0].groups).toHaveLength(2);
  });
});

describe('case sensitivity', () => {
  it('keeps distinct keys when case matters', () => {
    const result = runPipeline('Cat cat CAT dog', config);
    const totals = Object.fromEntries(result.combined.map((item) => [item.key, item.value]));
    expect(totals).toEqual({ CAT: 1, Cat: 1, cat: 1, dog: 1 });
    expect(result.stats.folded).toBe(0);
  });

  it('folds different cases into one key when case is ignored', () => {
    const result = runPipeline('Cat cat CAT dog', { ...config, caseSensitive: false });
    const totals = Object.fromEntries(result.combined.map((item) => [item.key, item.value]));
    expect(totals).toEqual({ cat: 3, dog: 1 });
    expect(result.stats.folded).toBe(2);
  });

  it('remembers the original spelling of every folded token', () => {
    const result = runPipeline('Cat cat', { ...config, splits: 1, caseSensitive: false });
    const [mapper] = result.mappers;
    expect(mapper.pairs.map((pair) => pair.raw)).toEqual(['Cat', 'cat']);
    expect(mapper.pairs.map((pair) => pair.key)).toEqual(['cat', 'cat']);
  });
});

describe('parseIgnored', () => {
  it('accepts commas, spaces, or both, with any casing', () => {
    expect([...parseIgnored('the, and of')]).toEqual(['the', 'and', 'of']);
    expect([...parseIgnored('  The ,  DOG  ')]).toEqual(['The', 'DOG']);
  });

  it('treats an empty or missing list as ignoring nothing', () => {
    expect(parseIgnored('').size).toBe(0);
    expect(parseIgnored('  ,  ').size).toBe(0);
    expect(parseIgnored(undefined).size).toBe(0);
  });
});

describe('ignored words', () => {
  it('drops the listed words without touching ordinary words', () => {
    const result = runPipeline('the cat and the dog', { ...config, splits: 1, ignore: 'the, and' });
    const totals = Object.fromEntries(result.combined.map((item) => [item.key, item.value]));
    expect(totals).toEqual({ cat: 1, dog: 1 });
    expect(result.stats.dropped).toBe(3);
    expect(result.stats.words).toBe(2);
  });

  it('matches the listed words regardless of case when case is ignored', () => {
    const base = { ...config, splits: 1, ignore: 'the and' };
    expect(runPipeline('The AND cat', { ...base, caseSensitive: false }).stats.words).toBe(1);
    expect(runPipeline('The AND cat', { ...base, caseSensitive: true }).stats.words).toBe(3);
  });

  it('only ignores exactly what the user listed', () => {
    const result = runPipeline('the theme there cat', { ...config, splits: 1, ignore: 'the' });
    expect(result.combined.map((item) => item.key).sort()).toEqual(['cat', 'theme', 'there']);
  });

  it('leaves the word count untouched when the list is empty', () => {
    const result = runPipeline('the cat and the dog', { ...config, splits: 1 });
    expect(result.stats.dropped).toBe(0);
    expect(result.stats.words).toBe(5);
    expect(result.ignored).toEqual([]);
  });

  it('reports the ignored list back for the explanation note', () => {
    const result = runPipeline('the cat', { ...config, splits: 1, ignore: 'the, of' });
    expect(result.ignored).toEqual(['the', 'of']);
  });
});

describe('split count', () => {
  it('produces more and smaller splits as the count rises', () => {
    const text = 'alpha beta gamma delta epsilon zeta eta theta';
    const few = runPipeline(text, { ...config, splits: 2 });
    const many = runPipeline(text, { ...config, splits: 4 });
    expect(few.splits).toHaveLength(2);
    expect(many.splits).toHaveLength(4);
    expect(many.splits[0].end - many.splits[0].start).toBeLessThan(few.splits[0].end - few.splits[0].start);
  });

  it('keeps the word count identical when no boundary cuts a word', () => {
    const text = 'aaa bbb ccc ddd eee fff ggg hhh iii jjj kkk lll';
    for (const splits of [1, 2, 3, 4, 6]) {
      const result = runPipeline(text, { ...config, splits });
      expect(result.stats.cuts).toBe(0);
      expect(result.stats.words).toBe(12);
    }
  });

  it('turns one word into two tokens when a boundary cuts it', () => {
    const result = runPipeline('abcdefgh', { ...config, splits: 4 });
    expect(result.stats.cuts).toBe(3);
    expect(result.stats.words).toBe(4);
    expect(result.combined.map((item) => item.key)).toEqual(['ab', 'cd', 'ef', 'gh']);
  });
});

describe('explainConfig', () => {
  it('reports one note per parameter using live result numbers', () => {
    const config2 = { mappers: 2, reducers: 2, splits: 1, caseSensitive: false, ignore: 'the' };
    const result = runPipeline('The cat the dog', config2);
    const notes = explainConfig(result, config2);
    expect(notes).toHaveLength(5);
    expect(notes.join(' ')).toContain('lowercase');
    expect(notes.join(' ')).toContain('Ignoring 1 word (the) dropped 2 of 4 words');
    expect(notes.join(' ')).toContain('2 mappers share 1 split round-robin');
  });

  it('says nothing is ignored when the list is empty', () => {
    const result = runPipeline('The cat', { ...config, splits: 1 });
    expect(explainConfig(result, { ...config, splits: 1 }).join(' ')).toContain('No ignored words are set');
  });

  it('says case is preserved when case sensitivity is on', () => {
    const strict = { mappers: 1, reducers: 1, splits: 2, caseSensitive: true, ignore: '' };
    const result = runPipeline('Cat', strict);
    expect(explainConfig(result, strict).join(' ')).toContain('Case is preserved');
  });

  it('calls out a boundary that split a word in half', () => {
    const result = runPipeline('abcdefgh', { mappers: 1, reducers: 1, splits: 4 });
    expect(explainConfig(result, { ...config, splits: 4 }).join(' ')).toContain('fell inside a word');
  });
});
