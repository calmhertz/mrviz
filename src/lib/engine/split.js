const WORD = /[\p{L}\p{N}]+/gu;

export const splitText = (text, count) => {
  const starts = [...text.matchAll(WORD)].map((match) => match.index);
  if (!starts.length) return [];

  const per = Math.ceil(starts.length / count);
  const splits = [];

  for (let i = 0; i < starts.length; i += per) {
    const start = starts[i];
    const end = i + per < starts.length ? starts[i + per] : text.length;
    splits.push({
      index: splits.length,
      start,
      end,
      startWord: i,
      words: Math.min(per, starts.length - i),
      text: text.slice(start, end)
    });
  }

  return splits;
};

export const assignMappers = (splits, mapperCount) =>
  splits.map((split, i) => ({ ...split, mapper: i % mapperCount }));
