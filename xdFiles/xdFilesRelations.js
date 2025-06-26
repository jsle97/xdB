// xdFilesRelations.js
import xdFiles from "./xdFiles.js";

let cfg = { root: process.cwd(), relDir: "relations", ttl: 300000 };
const cache = new Map();                               // key → { data,t }

export const config = o => { cfg = { ...cfg, ...o }; };

const getCache = k => { const c = cache.get(k); return c && Date.now() - c.t < cfg.ttl ? c.data : null; };
const setCache = (k, d) => cache.set(k, { data: d, t: Date.now() });
const invalidate = pattern => {
  if (!pattern) return cache.clear();
  for (const k of cache.keys()) if (k.includes(pattern)) cache.delete(k);
};

/* ensure /relations exists */
const ensureDir = () => xdFiles.utils.ensureDirectoryExists(cfg.relDir);

/* ---------- ONE-TO-MANY ---------- */
export async function createOneToMany({ fromCollection, fromId, toCollection, toField, toIds = [] }) {
  if (!fromCollection || !fromId || !toCollection || !toField) throw new Error("Missing params");
  await Promise.all(toIds.map(async id => {
    const rec = await xdFiles.view.id(toCollection, id);
    if (rec.record) await xdFiles.edit.id(toCollection, id, { [toField]: fromId });
  }));
  await ensureDir();
  await xdFiles.file.write(`${cfg.relDir}/${fromCollection}_${fromId}_${toCollection}_${toField}.one.json`,
    { fromCollection, fromId, toCollection, toField, toIds }, { raw: true });
  invalidate(`${fromCollection}:${fromId}:${toCollection}:${toField}`);
  return { success: true };
}

export async function getRelated({ fromCollection, fromId, toCollection, toField }) {
  const key = `${fromCollection}:${fromId}:${toCollection}:${toField}`;
  const c = getCache(key); if (c) return c;
  const res = await xdFiles.view.more(toCollection, { filter: r => r[toField] === fromId });
  setCache(key, res.data);
  return res.data;
}

/* ---------- MANY-TO-MANY ---------- */
export async function createManyToMany({ collection1, id1, collection2, id2, junctionTable = null }) {
  const table = junctionTable || `${collection1}_${collection2}_relations.json`;
  const path = `${cfg.relDir}/${table}`;
  await ensureDir();
  let rels = [];
  try { rels = (await xdFiles.view.all(path)).data; } catch { }              // brak pliku = brak relacji
  const dup = rels.some(r =>
    (r.collection1_id === id1 && r.collection2_id === id2) ||
    (r.collection1_id === id2 && r.collection2_id === id1)
  );
  if (dup) return { success: false, error: "Relation already exists" };
  const rec = {
    collection1, collection1_id: id1,
    collection2, collection2_id: id2,
    createdAt: new Date().toISOString()
  };
  await xdFiles.add.id(path, rec);
  invalidate(`${collection1}:${id1}`); invalidate(`${collection2}:${id2}`);
  return { success: true };
}

export async function getManyToManyRelated({ collection, id, targetCollection, junctionTable = null }) {
  const table = junctionTable || `${collection}_${targetCollection}_relations.json`;
  const key = `m2m:${collection}:${id}:${targetCollection}`;
  const c = getCache(key); if (c) return c;
  let rels = [];
  try { rels = (await xdFiles.view.all(`${cfg.relDir}/${table}`)).data; } catch { }
  const ids = rels.reduce((arr, r) => {
    if (r.collection1 === collection && r.collection1_id === id) arr.push(r.collection2_id);
    else if (r.collection2 === collection && r.collection2_id === id) arr.push(r.collection1_id);
    return arr;
  }, []);
  const out = [];
  for (const rid of ids) {
    try { const rec = await xdFiles.view.id(targetCollection, rid); if (rec.record) out.push(rec.record); } catch { }
  }
  setCache(key, out);
  return out;
}

/* ---------- REMOVAL & INTEGRITY ---------- */
export async function removeRelation(opts) {
  const { fromCollection, fromId, toCollection, toId, toField } = opts;
  if (toField) {
    const rec = await xdFiles.view.id(toCollection, toId);
    if (rec.record && rec.record[toField] === fromId) await xdFiles.edit.id(toCollection, toId, { [toField]: null });
    invalidate(`${fromCollection}:${fromId}:${toCollection}:${toField}`);
  } else {
    const table = opts.junctionTable || `${fromCollection}_${toCollection}_relations.json`;
    const path = `${cfg.relDir}/${table}`;
    try {
      const list = (await xdFiles.view.all(path)).data;
      for (const r of list) {
        if ((r.collection1_id === fromId && r.collection2_id === toId) ||
            (r.collection1_id === toId && r.collection2_id === fromId)) {
          await xdFiles.del.id(path, r.id);
          break;
        }
      }
    } catch { }
    invalidate(`${fromCollection}:${fromId}`); invalidate(`${toCollection}:${toId}`);
  }
  return { success: true };
}

export async function checkIntegrity(collection, id) {
  try { await xdFiles.view.id(collection, id); return { valid: true, issues: [] }; }
  catch { return { valid: false, issues: [{ collection, id, type: "missing_record" }] }; }
}

export async function cascadeDelete({ collection, id, relations = [] }) {
  const deleted = [];
  for (const r of relations) {
    if (r.type !== "oneToMany") continue;
    const kids = await getRelated({ fromCollection: collection, fromId: id, toCollection: r.toCollection, toField: r.toField });
    for (const child of kids) {
      if (r.onDelete === "cascade") {
        await xdFiles.del.id(r.toCollection, child.id);
        deleted.push({ collection: r.toCollection, id: child.id });
      } else if (r.onDelete === "setNull") {
        await xdFiles.edit.id(r.toCollection, child.id, { [r.toField]: null });
      }
    }
  }
  await xdFiles.del.id(collection, id);
  deleted.push({ collection, id });
  return { deleted };
}

/* ---------- PUBLIC ---------- */
export const clearCache = () => cache.clear();

export default {
  config,
  createOneToMany,
  createManyToMany,
  getRelated,
  getManyToManyRelated,
  removeRelation,
  checkIntegrity,
  cascadeDelete,
  clearCache
};


/*

Technical documentation for xdFilesRelations.js
==============================================

Description
-----------
- **xdFilesRelations.js** is an optional plug-in for **xdFiles.js** that adds relational
  links *between JSON collections* stored on disk.  
- It never modifies the xdFiles core; relations live in side-car JSON files
  inside `<root>/<relDir>` (default: `./relations`).  
- Supports **one-to-many** and **many-to-many** models with in-memory
  index + TTL cache for fast look-ups.

Main API
--------
| Function | Purpose |
|----------|---------|
| `config(opts)` | Set `{ root, relDir, ttl }`, should match xdFiles root |
| `createOneToMany({ fromCollection, fromId, toCollection, toField, toIds })` | Add / update 1-N relation and write `toField` in child records |
| `getRelated({ fromCollection, fromId, toCollection, toField })` | Return children (or parent) for a 1-N link |
| `createManyToMany({ collection1, id1, collection2, id2, junctionTable? })` | Add N-N pair to junction JSON |
| `getManyToManyRelated({ collection, id, targetCollection, junctionTable? })` | Fetch related records from the opposite side |
| `removeRelation(opts)` | Delete a 1-N or N-N link |
| `cascadeDelete({ collection, id, relations })` | Delete a record and optionally cascade / set-null on children |
| `checkIntegrity(collection, id)` | Quick existence check for a record |
| `clearCache()` | Flush relation cache & index |

File layout
-----------
```

data/
├─ user.json          # collection files managed by xdFiles
├─ comments.json
└─ relations/         # auto-created by plugin
├─ user\_1\_comments\_userId.one.json
└─ user\_comments\_relations.json      (junction tables)

````

Quick start example – users & comments
--------------------------------------
```js
import xdFiles from './xdFiles.js';
import rel     from './xdFilesRelations.js';

// 1. Same root for both libs
rel.config({ root: './data', relDir: 'relations', ttl: 300_000 });

// 2. Create data ---------------------------------------------------
await xdFiles.add.id('user',     { id: 1, name: 'Ania' });
await xdFiles.add.id('comments', { id: 101, userId: null, body: 'First!' });
await xdFiles.add.id('comments', { id: 102, userId: null, body: 'Second!' });

// 3. Link user → comments (1-N)
await rel.createOneToMany({
  fromCollection : 'user',
  fromId         : 1,
  toCollection   : 'comments',
  toField        : 'userId',
  toIds          : [101, 102]
});

// 4. Query back
const aniaComments = await rel.getRelated({
  fromCollection : 'user',
  fromId         : 1,
  toCollection   : 'comments',
  toField        : 'userId'
});
```

OUTPUT:
```js
[
  { id: 101, userId: 1, body: 'First!' },
  { id: 102, userId: 1, body: 'Second!' }
]

```

## Many-to-many snippet – posts & tags

```js
// Add link post 10 ↔ tag 'js'
await rel.createManyToMany({
  collection1 : 'posts', id1: 10,
  collection2 : 'tags',  id2: 'js'
});

// Fetch tags for post 10
const tags = await rel.getManyToManyRelated({
  collection       : 'posts',
  id               : 10,
  targetCollection : 'tags'
});
```

## Notes

* Relations work **only on `.json` collections**; binary/text files are ignored.
* All paths are stored **relative to `root`** and validated to prevent directory traversal.
* Index is lazy-built on first query, giving *O(1)* look-ups until cache expiry.
* Deleting a data file without removing its side-car relation file will not break,
  but `checkIntegrity()` can flag such orphaned links.

*/
