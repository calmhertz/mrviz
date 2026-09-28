export const defaultText = `Hadoop MapReduce processes data in parallel.
the quick brown fox jumps over the lazy dog
the lazy dog barks back; the quick fox runs away
MapReduce splits input across many mapper tasks`;

export const phases = [
  {
    id: 'input',
    title: 'Input & Splitting',
    question: 'How is the input prepared?',
    what: 'The text is divided into logical input splits, each holding whole words, and every split is assigned to a mapper task. One mapper may receive several splits.',
    why: 'Mappers work on independent chunks at the same time, so the job finishes faster as more mapper tasks are available.',
    hadoop: 'Hadoop derives input splits from file block boundaries, so a split can cut a word in half. A split is not a block, a mapper, or a machine.'
  },
  {
    id: 'map',
    title: 'Mapping',
    question: 'How is raw text transformed?',
    what: 'Each mapper tokenizes its own splits into words and emits one intermediate pair per word: (word, 1). A mapper never sees another mapper output.',
    why: 'Independent work per task is what makes the job parallel, and it means a single failed task can be retried alone.',
    hadoop: 'This is the application map() function. Its output is written to a local map output file, not sent anywhere yet.'
  },
  {
    id: 'shuffle',
    title: 'Shuffle & Sort',
    question: 'How does data get grouped by key?',
    what: 'Every key is hashed to exactly one reducer, all values for that key are collected, and the keys are sorted inside each reducer.',
    why: 'Grouping is what makes aggregation possible: a reducer can only count a word if all of its occurrences arrive together.',
    hadoop: 'Partitioning, transfer, grouping, and sorting belong to the framework, not the application. The application only chooses the partitioning key.'
  },
  {
    id: 'reduce',
    title: 'Reducing',
    question: 'How are the results calculated?',
    what: 'Each reducer sums the grouped values for every key it owns, so [1, 1, 1] becomes 3.',
    why: 'One reducer owns a key, so the final value is produced exactly once and needs no further coordination.',
    hadoop: 'This is the application reduce() function. Word count is only a summation; a different aggregation replaces this step alone.'
  },
  {
    id: 'output',
    title: 'Final Output',
    question: 'Where do the results go?',
    what: 'Each reducer writes its own output file. A combined, globally sorted view is also shown for easier reading.',
    why: 'Separate files let reducers finish at different times without waiting for each other.',
    hadoop: 'Reducer output is committed to HDFS as part-r-00000, part-r-00001, and so on. A single globally sorted file is not produced automatically.'
  }
];
