export const aggregate = (values) => values.reduce((total, value) => total + value, 0);

export const reducePartitions = (partitions) =>
  partitions.map((partition) => ({
    reducer: partition.reducer,
    results: partition.groups.map((group) => ({
      key: group.key,
      value: aggregate(group.values),
      count: group.values.length,
      reducer: partition.reducer
    }))
  }));
