export const compareKeys = (a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

const hash = (key) => {
  let value = 0;
  for (let i = 0; i < key.length; i++) {
    value = (value * 31 + key.codePointAt(i)) | 0;
  }
  return Math.abs(value);
};

export const partition = (key, reducerCount) => hash(key) % reducerCount;

export const groupPairs = (pairs, reducerCount) => {
  const groups = new Map();

  for (const pair of pairs) {
    const reducer = partition(pair.key, reducerCount);
    if (!groups.has(pair.key)) {
      groups.set(pair.key, { key: pair.key, reducer, values: [], origins: [] });
    }
    groups.get(pair.key).values.push(pair.value);
    groups.get(pair.key).origins.push(pair.mapper);
  }

  return [...groups.values()].sort(compareKeys);
};

export const shuffle = (mappers, reducerCount) => {
  const groups = groupPairs(mappers.flatMap((node) => node.pairs), reducerCount);

  return Array.from({ length: reducerCount }, (_, reducer) => ({
    reducer,
    groups: groups.filter((group) => group.reducer === reducer)
  }));
};
