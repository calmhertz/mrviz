const WORDS = /[\p{L}\p{N}]+/gu;

export const tokenize = (text) => text.match(WORDS) ?? [];

export const normalize = (raw, caseSensitive) => (caseSensitive ? raw : raw.toLowerCase());

export const parseIgnored = (list) =>
  new Set(String(list ?? '').split(/[\s,]+/).filter(Boolean));
