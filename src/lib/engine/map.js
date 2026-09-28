import { normalize, tokenize } from './tokenize.js';

export const mapSplits = (splits, mapperCount, options = {}) => {
  const mappers = Array.from({ length: mapperCount }, (_, mapper) => ({
    mapper,
    splits: [],
    pairs: [],
    dropped: 0,
    folded: 0
  }));

  for (const split of splits) {
    const target = mappers[split.mapper];
    target.splits.push(split);

    tokenize(split.text).forEach((raw, position) => {
      if (options.ignored?.has(normalize(raw, options.caseSensitive))) {
        target.dropped += 1;
        return;
      }
      const key = normalize(raw, options.caseSensitive);
      if (key !== raw) target.folded += 1;
      target.pairs.push({ key, raw, value: 1, mapper: split.mapper, split: split.index, position });
    });
  }

  return mappers;
};
