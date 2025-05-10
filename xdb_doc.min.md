# Compact Technical Documentation • xdB v1.0.0

A Lightweight, File-Based JSON Database for Node.js — Perfect for Quick Prototypes, Testing, and Small Server Services
100% Async/Promise, Zero External Dependencies

## 1. Installation & Initialization

### 1.1. Download
```
sudo wget https://raw.githubusercontent.com/jsle97/xdB/refs/heads/main/xdb.js
```
**OR**
```
sudo wget https://jsle.eu/xdB/xdb.js
```

### 1.2. Import
```
import xdB, { XDB_ERROR_CODES } from './path/to/xdb.js'; // Adjust path as needed
```

## 2. Data Model
• Each file is an array of JSON objects.  
• Mandatory `id` field (string, unique within the file).  
• Automatically added: `_xdToken` (hash → ETag-like).  
• Relative paths to `basePath`, `.json` extension added automatically.

## 3. API - Quick Overview

| Group | Method                       | Description / Returns                  |
|-------|------------------------------|----------------------------------------|
| VIEW  | `view.all(file)`            | `[records]`                            |
|       | `view.id(file, id)`         | `{…record}`                            |
|       | `view.more(file, opts)`     | filter, sort, skip, limit, include     |
| ADD   | `add.all(file, arr, {ov})`  | overwrite entire or append              |
|       | `add.id(file, obj)`         | add single record                      |
| EDIT  | `edit.all(file, arr)`       | full replace                           |
|       | `edit.id(file, id, obj)`    | shallow merge                          |
| DEL   | `del.all(file)`             | clear file (remains `[]`)              |
|       | `del.id(file, id)`          | delete specified record                |
| QRY   | `query(file, field, val)`   | O(1) when field is indexed             |
| REL   | `relations.define(name,{})` | declare 1:1, 1:N, N:N relations        |
| UTIL  | `utils.restoreFromBackup()` | restore from *.bak*                    |

All return Promises; catch errors with try/catch → `error.code ∈ XDB_ERROR_CODES`.

## 4. Advanced Filtering (`view.more`)
Code example remains the same in the original documentation.

• `filter` → function or object `{field: value}`  
• `include` → eager-load relations, returns in `_rel` field.

## 5. Relations and Consistency
Code example remains the same in the original documentation.

• `utils.verifyRelations()` → quick integrity test.  
• Modifications respect `onDelete`.

## 6. Indexes
• Created at startup; manually rebuild: `indexes.rebuild(file)`.  
• Memory buffer → O(1) operations (set/hash).  
• For non-indexed fields, use `view.more`.

## 7. Schema Validation
• Based on Ajv; throws `XDB_INVALID_SCHEMA` or `XDB_INVALID_RECORD`.  
• `config.enableSchemaValidation = false` → no validation = +25-30% RPS.

## 8. Performance and Limits
• Single-thread, atomic write (temp → rename).  
• Optimal file size < 5 MB (~10k records) for low latency.  
• For larger volumes, consider file sharding or migrating to a database.

## 9. Logging and Events
`xdB.on('afterAddId', ({path, record}) => {...})`  
Available hooks: `before*`, `after*`, `error*` for each operation.

## 10. Error Handling
Code example remains the same in the original documentation.

Most common error codes: `XDB_FILE_NOT_FOUND`, `XDB_IO_ERROR`, `XDB_LOCKED_FILE`,
`XDB_SCHEMA_MISMATCH`, `XDB_RELATION_VIOLATION`.

## 11. Best Practices
✓ Load files lazily (operations load/save automatically).  
✓ Batch modifications to reduce I/O.  
✓ Use indexes on fields you frequently filter.  
✓ In CI/CD, call `utils.verifyRelations()` and schema tests.  
✓ Before release, run `npm prune --omit=dev` (xdB has no deps, but your project might).

## 12. TL;DR for LLM
• First, `await xdB.config()`.  
• CRUD see section 3.  
• Everything is async; return exact method/param names.  
• Don't forget `id` and `_xdToken` in example responses.
