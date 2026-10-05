// Temporary micro-benchmark for collapseIntoStacks — worst case: a full
// feed (FeedManager::MAX_ITEMS = 800) with several prolific authors.
import { fromJS, List as ImmutableList, Map as ImmutableMap } from 'immutable';

import { collapseIntoStacks } from '../status_stacks';

const BASE_TIME = Date.parse('2026-01-01T00:00:00.000Z');

const buildState = (totalItems, spammyAuthors, postsPerSpammer) => {
  let statuses = ImmutableMap();
  let accounts = ImmutableMap();
  const ids = [];
  let minute = 0;
  let serial = 0;

  const addStatus = (accountId) => {
    const id = `s${serial++}`;
    minute += 1;
    statuses = statuses.set(id, ImmutableMap({
      account: accountId,
      created_at: new Date(BASE_TIME + minute * 60 * 1000).toISOString(),
      reblog: null,
    }));
    ids.push(id);
  };

  for (let a = 0; a < spammyAuthors; a++) {
    const accountId = `spam${a}`;
    accounts = accounts.set(accountId, fromJS({ acct: `spam${a}@remote.example` }));
    for (let p = 0; p < postsPerSpammer; p++) addStatus(accountId);
  }

  let n = 0;
  while (ids.length < totalItems) {
    const accountId = `norm${n++}`;
    accounts = accounts.set(accountId, fromJS({ acct: `norm${n}@remote.example` }));
    addStatus(accountId);
  }

  return { statusIds: ImmutableList(ids).reverse(), statuses, accounts };
};

describe('collapseIntoStacks performance', () => {
  test('800-item feed, 10 authors x 50 posts', () => {
    const { statusIds, statuses, accounts } = buildState(800, 10, 50);

    // Warmup
    collapseIntoStacks(statusIds, statuses, accounts);

    const runs = 200;
    const start = performance.now();
    let result;
    for (let i = 0; i < runs; i++) {
      result = collapseIntoStacks(statusIds, statuses, accounts);
    }
    const avg = (performance.now() - start) / runs;

    const stackCount = result.count((item) => ImmutableList.isList(item));
    // eslint-disable-next-line no-console
    console.log(`[perf] 800 items: avg ${avg.toFixed(3)} ms/run | ${stackCount} stacks | output size ${result.size}`);

    expect(stackCount).toBeGreaterThan(0);
    expect(avg).toBeLessThan(10);
  });

  test('40-item feed (typical initial load)', () => {
    const { statusIds, statuses, accounts } = buildState(40, 1, 20);

    collapseIntoStacks(statusIds, statuses, accounts);

    const runs = 500;
    const start = performance.now();
    for (let i = 0; i < runs; i++) {
      collapseIntoStacks(statusIds, statuses, accounts);
    }
    const avg = (performance.now() - start) / runs;

    // eslint-disable-next-line no-console
    console.log(`[perf] 40 items: avg ${avg.toFixed(4)} ms/run`);

    expect(avg).toBeLessThan(2);
  });
});
