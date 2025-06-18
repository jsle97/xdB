# xdB.js – Complete Documentation

**xdB.js** is a powerful, extensible, file-based JSON database engine for Node.js. It supports advanced features such as full CRUD operations, indexing, relations, backup, schema validation, event hooks, and more – all with zero external dependencies.

---

## Features

- Full CRUD operations on JSON files.
- Indexing for fast queries on chosen fields.
- Definable relations (1:1, 1:N, N:M) with onDelete strategies (CASCADE, RESTRICT, SET_NULL).
- Automatic and on-demand backup.
- Optional schema validation.
- Event/hook system (before/after/error for each operation).
- Relation cache with TTL.
- Directory and file management utilities.
- Configurable logging (level, log file).
- Custom error message support.

---

## Installation and Import

```js
import xdB from './xdb-full/xdb.js';
```

---

## Quick Start Example

```js
// 1. Configuration (base path, backup, logging, indexes, relations)
await xdB.config({
  basePath: './db',
  enableBackup: true,
  logLevel: 'INFO',
  indexes: { 'users': ['email'], 'posts': ['authorId'] },
  enableRelationCache: true,
  schemas: {
    users: { /* schema definition */ }
  }
});

// 2. Create a collection and add a user
await xdB.add.all('users', [{ name: 'Anna', email: 'a@a.com' }]);
const { record: user } = await xdB.add.id('users', { name: 'Bartek', email: 'b@b.com' });

// 3. Define a 1:N relation (user -> posts)
xdB.relations.define('user_posts', {
  type: '1:N',
  localFile: 'users',
  localField: 'id',
  foreignFile: 'posts',
  foreignField: 'authorId',
  onDelete: 'CASCADE'
});

// 4. Add a post and fetch all posts for a user
await xdB.add.id('posts', { title: 'New post', authorId: user.id });
const posts = await xdB.relations.getRelated('user_posts', user.id);

// 5. Indexed query
const foundByEmail = await xdB.query('users', 'email', 'a@a.com');
```

---

## Core API

### Configuration and Utilities

- `config(options)` – Set up database (paths, backup, logging, indexes, relation cache, schema validation).
- `getBasePath()` – Returns the base directory.
- `on(event, fn)` / `off(event, fn)` – Register/unregister event hooks (e.g. beforeAddAll, afterEditId, errorDeleteAll).

### Directory and File Operations

- `dir.add(path)` – Create a directory.
- `dir.del(path)` – Delete a directory.
- `dir.rename(oldPath, newPath)` – Rename a directory.
- `move.file(src, dest)` – Move a collection file.

### CRUD Operations

- `add.all(file, data, {overwrite})` – Create/overwrite a collection (array of objects or single object).
- `add.id(file, record)` – Add a new record with a unique ID.
- `edit.all(file, newData)` – Overwrite the entire collection.
- `edit.id(file, id, updates)` – Edit a record by its ID.
- `del.all(file)` – Delete all records (truncate collection).
- `del.id(file, id)` – Delete a record by ID (with relation onDelete strategies).
- `view.all(file)` – Get all records.
- `view.id(file, id)` – Get a record by ID.
- `view.more(file, {filter, sort, skip, limit, include})` – Advanced querying (filtering, sorting, pagination, eager/lazy relation loading).

### Indexing

- `query(file, field, value)` – Fast search by indexed field.
- Configure indexes in `config({indexes: ...})`.

### Relations

- `relations.define(name, config)` – Define a relation (1:1, 1:N, N:M).
- `relations.remove(name)` – Remove a relation.
- `relations.getRelated(name, id)` – Retrieve related objects.
- onDelete strategies: CASCADE, SET_NULL, RESTRICT.

### Validation and Consistency

- `utils.verifyRelations()` – Check all defined relations for integrity (no broken foreign keys).
- Optional schema validation for collections (enable via `schemas` and `enableSchemaValidation`).

### Backup

- Automatic `.bak` file backups (configurable in `config`).
- `utils.restoreFromBackup(file)` – Restore a file from its backup.

---

## Example Scenarios

### Filtering and Sorting

```js
// Get users whose name includes "a", sorted ascending, 10 per page
const result = await xdB.view.more('users', {
  filter: user => user.name.includes('a'),
  sort: [{ key: 'name', order: 'asc' }],
  skip: 0,
  limit: 10
});
```

### Eager/Lazy Relation Loading

```js
// Eager load: posts with author object included
const posts = await xdB.view.more('posts', { include: ['author'], includeStrategy: 'eager' });
// Lazy (default): posts[0].author() returns a Promise for that author
```

### Event Hooks

```js
xdB.on('afterAddId', data => {
  console.log('Added record:', data.record);
});
```

---

## Advanced Features

- Automatic file locking for safe concurrency.
- Sophisticated onDelete strategies (CASCADE, RESTRICT, SET_NULL).
- Full extensibility with custom validators and hooks.
- Support for custom error messages (for localization or clarity).

---

## License
xdB.js is MIT licensed.

**Author:**  
Jakub Śledzikowski  <jsledzikowski.web@gmail.com>
