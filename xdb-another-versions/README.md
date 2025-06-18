## xdbLite.js

**Description:**  
A powerful JSON file database library. Provides full CRUD operations, directory/file management, caching, file locking, and error handling using custom codes.

**Exports:** `xdBLite` (default export)

### Key API

- `config(options)` – Set base path, log level, enables caching, etc.
- `add.all(filePath, data, opts)` – Initialize collection with an array of records.
- `add.id(filePath, record)` – Add a record with a unique ID.
- `edit.all(filePath, newData)` – Overwrite the entire collection.
- `edit.id(filePath, id, updates)` – Edit a record by its ID.
- `del.all(filePath)` – Delete all records in a collection.
- `del.id(filePath, id)` – Delete a record by its ID.
- `view.all(filePath)` – Retrieve all records.
- `view.id(filePath, id)` – Retrieve a record by its ID.
- `view.more(filePath, options)` – Filtering, sorting, pagination.
- `dir.add/del/rename` – Directory operations.
- `move.file` – Move a data file to a new location.
- `cache.clear/invalidate` – Manage cache.

### Usage Examples

```js
import xdBLite from './xdbLite.js';

// 1. Initialize configuration and a collection
await xdBLite.config({ basePath: './data', logLevel: 'INFO', cachingEnabled: true });
await xdBLite.add.all('users', [
  { name: "Anna" }, { name: "Bartek" }
]);

// 2. Add a record and retrieve it by ID
const { record } = await xdBLite.add.id('users', { name: "Cezary" });
const { record: user } = await xdBLite.view.id('users', record.id);

// 3. Update and delete a record
await xdBLite.edit.id('users', record.id, { name: "Cezary New" });
await xdBLite.del.id('users', record.id);

// 4. Filtering and pagination
const result = await xdBLite.view.more('users', {
  filter: r => r.name.startsWith('A'),
  sort: [{ key: "name", order: "desc" }],
  skip: 0, limit: 1
});
```

---

## xdbLiteRelations.js

**Description:**  
An extension for xdbLite.js adding one-to-many and many-to-many relations between records. Supports relation caching, cascading deletes, and integrity checks.

**Exports:**  
Functions:
- `createOneToMany(options)`  
- `createManyToMany(options)`  
- `getRelated(options)`  
- `getManyToManyRelated(options)`  
- `removeRelation(options)`  
- `checkIntegrity(collection, id)`  
- `cascadeDelete(options)`  
- `clearCache()`

### Usage Examples

```js
import xdBLite from './xdbLite.js';
import xdRelations from './xdbLiteRelations.js';

// 1. One-to-many relation (e.g. user -> posts)
await xdBLite.add.all('users', [{ id: "user1", name: "A" }]);
await xdBLite.add.all('posts', [{ title: "T1" }, { title: "T2" }]);
await xdRelations.createOneToMany({
  fromCollection: 'users',
  fromId: 'user1',
  toCollection: 'posts',
  toField: 'authorId',
  toIds: [/* post ids */]
});

// 2. Fetch all posts for a user
const posts = await xdRelations.getRelated({
  fromCollection: 'users',
  fromId: 'user1',
  toCollection: 'posts',
  toField: 'authorId'
});

// 3. Many-to-many relation (user <-> groups)
await xdRelations.createManyToMany({
  collection1: 'users',
  id1: 'user1',
  collection2: 'groups',
  id2: 'group1'
});
const groups = await xdRelations.getManyToManyRelated({
  collection: 'users',
  id: 'user1',
  targetCollection: 'groups'
});
```

---

## xdbNano.js

**Description:**  
A minimalist CRUD engine for JSON files. No relations, no caching, no directory management – just fast and simple record operations.

**Exports:** `xdbNano` (default export)

### Key API

- `setBasePath(path)` – Change the base directory.
- `add.id(filePath, record)` – Add a record with a unique ID.
- `edit.id(filePath, id, updates)` – Update a record by ID.
- `del.id(filePath, id)` – Delete a record by ID.
- `view.all(filePath)` – Retrieve all records.
- `view.id(filePath, id)` – Retrieve a record by ID.

### Usage Examples

```js
import xdbNano from './xdbNano.js';

// 1. Add a record
await xdbNano.add.id('notes', { text: "Hello world" });

// 2. Edit a record
const rec = await xdbNano.add.id('notes', { text: "Test" });
await xdbNano.edit.id('notes', rec.id, { text: "Updated text" });

// 3. Delete a record
await xdbNano.del.id('notes', rec.id);

// 4. Read all records
const all = await xdbNano.view.all('notes');
```

---

## License
xdFiles.js, xdbLite.js, xdbLiteRelations.js and xdbNano.js are MIT licensed.

## Author
Jakub Śledzikowski <jsledzikowski.web@gmail.com>
