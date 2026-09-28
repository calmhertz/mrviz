import { mapSplits } from './map.js';
import { reducePartitions } from './reduce.js';
import { assignMappers, splitText } from './split.js';
import { compareKeys, shuffle } from './shuffle.js';
import { parseIgnored, tokenize } from './tokenize.js';

export const LIMITS = { mappers: [1, 8], reducers: [1, 8], splits: [1, 12], text: 20000 };
export const DEFAULT_CONFIG = {
  mappers: 3,
  reducers: 2,
  splits: 4,
  caseSensitive: false,
  ignore: ''
};

export const clamp = (value, [min, max]) => Math.min(max, Math.max(min, value));

export const validate = (text) => {
  const errors = [];

  if (text.length > LIMITS.text) errors.push(`Input is limited to ${LIMITS.text} characters.`);
  if (!tokenize(text).length) errors.push('Enter some text containing at least one word.');

  return errors;
};

export const runPipeline = (text, options = {}) => {
  const config = { ...DEFAULT_CONFIG, ...options };
  const ignored = parseIgnored(config.ignore);
  const splits = assignMappers(splitText(text, config.splits), config.mappers);
  const mappers = mapSplits(splits, config.mappers, { ...config, ignored });
  const partitions = shuffle(mappers, config.reducers);
  const reduced = reducePartitions(partitions);
  const files = reduced.map((node) => ({
    name: `part-r-${String(node.reducer).padStart(5, '0')}`,
    reducer: node.reducer,
    results: node.results
  }));
  const total = (pick) => mappers.reduce((sum, node) => sum + pick(node), 0);

  return {
    text,
    ignored: [...ignored],
    splits,
    mappers,
    partitions,
    reduced,
    files,
    combined: reduced.flatMap((node) => node.results).sort(compareKeys),
    stats: {
      chars: text.length,
      splits: splits.length,
      cuts: splits.filter((split) => split.cut).length,
      words: total((node) => node.pairs.length),
      dropped: total((node) => node.dropped),
      folded: total((node) => node.folded),
      keys: partitions.reduce((total, part) => total + part.groups.length, 0)
    }
  };
};

export const explainConfig = (result, config) => {
  const notes = [];
  const chars = Math.ceil(result.text.length / config.splits);

  notes.push(
    `${config.splits} requested split${config.splits === 1 ? '' : 's'} of about ${chars} character${
      chars === 1 ? '' : 's'
    } produced ${result.splits.length}, because a range with no letters or digits is discarded.`
  );

  notes.push(
    result.stats.cuts
      ? `${result.stats.cuts} boundary${
          result.stats.cuts === 1 ? '' : 'ies'
        } fell inside a word, so that word was tokenized as two pieces. Real Hadoop avoids this with record-aware input formats.`
      : 'No boundary fell inside a word, so every word stayed whole.'
  );

  notes.push(
    config.caseSensitive
      ? 'Case is preserved, so MapReduce and mapreduce stay separate keys.'
      : `Case is ignored, so ${result.stats.folded} word${
          result.stats.folded === 1 ? '' : 's'
        } folded to lowercase and merged with their lowercase form.`
  );

  const ignored = result.ignored.length;
  notes.push(
    ignored
      ? `Ignoring ${ignored} word${ignored === 1 ? '' : 's'} (${result.ignored.join(', ')}) dropped ${
          result.stats.dropped
        } of ${result.stats.words + result.stats.dropped} words, leaving ${result.stats.words} counted.`
      : 'No ignored words are set, so every word is counted.'
  );

  notes.push(
    `${config.mappers} mapper${config.mappers === 1 ? '' : 's'} share ${result.splits.length} split${
      result.splits.length === 1 ? '' : 's'
    } round-robin, and ${config.reducers} reducer${config.reducers === 1 ? '' : 's'} split the ${
      result.stats.keys
    } distinct key${result.stats.keys === 1 ? '' : 's'} by hash.`
  );

  return notes;
};
