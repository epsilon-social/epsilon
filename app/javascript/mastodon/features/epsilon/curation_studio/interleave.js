// Epsilon — draft board "shuffle" helper.
//
// Spreads items so that consecutive entries come from different accounts
// whenever possible (the curator adds posts source by source, which would
// otherwise produce blocks of a single outlet in the feed). Greedy
// round-robin: always pick from the largest remaining group whose account
// differs from the previous pick; groups are pre-shuffled so re-running
// gives a fresh arrangement.

const shuffled = (array) => {
  const copy = [...array];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
};

export const interleaveByAccount = (items, getAccountId) => {
  const groups = new Map();

  items.forEach((item) => {
    const key = getAccountId(item);

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(item);
  });

  const queues = shuffled([...groups.values()]).map((queue) => shuffled(queue));
  const result = [];
  let lastKey = null;

  while (result.length < items.length) {
    let pick = null;

    for (const queue of queues) {
      if (queue.length === 0 || getAccountId(queue[0]) === lastKey) {
        continue;
      }

      if (!pick || queue.length > pick.length) {
        pick = queue;
      }
    }

    // Only one account left: adjacency is unavoidable.
    pick ??= queues.find((queue) => queue.length > 0);

    const item = pick.shift();
    lastKey = getAccountId(item);
    result.push(item);
  }

  return result;
};
