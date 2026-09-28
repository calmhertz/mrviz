const HAS_WORD = /[\p{L}\p{N}]/u;
const isWord = (char) => char !== undefined && HAS_WORD.test(char);

export const splitText = (text, count) => {
  const size = Math.max(1, Math.ceil(text.length / count));
  const splits = [];

  for (let start = 0; start < text.length; start += size) {
    const chunk = text.slice(start, start + size);
    if (!HAS_WORD.test(chunk)) continue;
    splits.push({
      index: splits.length,
      start,
      end: start + chunk.length,
      cut: isWord(text[start - 1]) && isWord(text[start]),
      text: chunk
    });
  }

  return splits;
};

export const assignMappers = (splits, mapperCount) =>
  splits.map((split, i) => ({ ...split, mapper: i % mapperCount }));
