const { test } = require('node:test');
const assert = require('node:assert/strict');
const { collectPages } = require('../cloud-pages.js');

test('loads all 1061 rows, including records beyond the default 1000 limit', async () => {
  const rows = Array.from({ length: 1061 }, (_, i) => ({ id: `ip-${i}`, title: `작품 ${i}` }));
  const offsets = [];
  const actual = await collectPages(async (offset, size) => {
    offsets.push(offset);
    return rows.slice(offset, offset + size);
  });
  assert.deepEqual(actual, rows);
  assert.deepEqual(offsets, [0, 500, 1000]);
  assert.equal(actual.at(-1).title, '작품 1060');
});

test('checks the next page after an exact full page', async () => {
  const rows = Array.from({ length: 1000 }, (_, i) => ({ id: String(i) }));
  const offsets = [];
  const actual = await collectPages(async (offset, size) => {
    offsets.push(offset);
    return rows.slice(offset, offset + size);
  });
  assert.equal(actual.length, 1000);
  assert.deepEqual(offsets, [0, 500, 1000]);
});

test('does not return a partial list when a later page fails', async () => {
  await assert.rejects(collectPages(async (offset) => {
    if (offset) throw new Error('Later page denied');
    return Array.from({ length: 500 }, (_, i) => ({ id: String(i) }));
  }), /Later page denied/);
});

test('rejects duplicate IDs across pages instead of counting them twice', async () => {
  await assert.rejects(collectPages(async (offset) => {
    if (offset) return [{ id: '0' }];
    return Array.from({ length: 500 }, (_, i) => ({ id: String(i) }));
  }), /새로고침/);
});

test('rejects malformed API responses', async () => {
  await assert.rejects(collectPages(async () => ({ error: 'Denied' })), /응답/);
});
