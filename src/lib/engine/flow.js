import { partition } from './shuffle.js';

const indexOf = (id) => Number(id.split('-')[1]);
const chip = (label, note) => ({ label, note: String(note) });

export const flowFor = (result, phase, from, to) => {
  if (phase.id === 'input' && from === 'source') {
    const split = result.splits.find((item) => item.index === indexOf(to));
    return result.mappers[split.mapper].pairs
      .filter((pair) => pair.split === split.index)
      .map((pair) => chip(pair.key, pair.value));
  }

  if (phase.id === 'input' || phase.id === 'map') {
    return result.mappers[indexOf(to)].pairs
      .filter((pair) => pair.split === indexOf(from))
      .map((pair) => chip(pair.key, pair.value));
  }

  if (phase.id === 'shuffle') {
    const reducer = indexOf(to);
    const pairs = result.mappers[indexOf(from)].pairs.filter(
      (pair) => partition(pair.key, result.partitions.length) === reducer
    );
    return [...new Set(pairs.map((pair) => pair.key))].map((key) =>
      chip(key, pairs.filter((pair) => pair.key === key).length)
    );
  }

  if (phase.id === 'reduce') {
    return result.reduced[indexOf(to)].results.map((item) => chip(item.key, item.value));
  }

  return result.files[indexOf(to)].results.map((item) => chip(item.key, item.value));
};
