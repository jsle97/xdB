

# xdB Library Technical Documentation
---
**package.json**
```json
{
  "name": "xdb",
  "version": "1.0.0",
  "description": "xdB is a lightweight, but incredibly powerful, JSON database for Node.js.",
  "main": "xdB.js",
  "scripts": {
    "test": ""
  },
  "keywords": [
    "json",
    "database",
    "nodejs",
    "file-based",
    "xdb"
  ],
  "author": "Jakub Śledzikowski <jsledzikowski.web@gmail.com>",
  "license": "MIT",
  "dependencies": {
    "fs": "^0.0.1-security",
    "path": "^0.12.7",
    "url": "^0.11.0"
  }
}
```

---
## 1. Introduction

**xdB** is a lightweight, file-based JSON data management library for Node.js. It provides a simple yet powerful way to store, retrieve, and manage data in plain JSON files, acting as a minimal persistence layer without the overhead of a traditional database server.

It's designed for scenarios where:

*   Data can be logically organized into separate JSON files (collections).
*   A simple, embedded database solution is preferred.
*   Schema enforcement and basic data relationships are needed.
*   Atomic operations and basic concurrency control are required.

**Key Features:**

*   **File-Based Storage:** Uses the local file system to store data in `.json` files (typically arrays of objects).
*   **CRUD Operations:** Provides asynchronous functions for Creating, Reading, Updating, and Deleting records (`add`, `view`, `edit`, `del`).
*   **Atomic Writes:** Ensures data integrity during write operations using temporary files and atomic renames.
*   **Concurrency Control:** Implements an in-process file locking mechanism (`acquireLock`, `releaseLock`) to prevent race conditions during simultaneous writes.
*   **Indexing & Querying:** Supports defining indexes on specific fields for fast lookups (`query`) and offers flexible filtering for non-indexed fields (`view.more`).
*   **Schema Validation (Optional):** Allows defining JSON Schemas per file to enforce data structure and types upon adding or editing records.
*   **Relationship Management (Optional):** Supports defining 1:1, 1:N, and N:M relationships between data files with configurable `onDelete` behavior (CASCADE, SET_NULL, RESTRICT).
*   **Backup System (Optional):** Automatically creates backup copies of files before modifications.
*   **Event System:** Emits events before and after key operations (and on errors) allowing for hooks and extensions.
*   **Configurable Logging:** Supports different log levels and optional logging to a file.
*   **Customizable Error Messages:** Allows overriding default error messages via a JSON file.

**Target Audience:** Developers building Node.js applications needing a simple, file-based persistence solution with features beyond basic file reading/writing.

---

## 2. Getting Started

### 2.1 Installation

Assuming xdB is packaged appropriately (e.g., available as a local module):

```
sudo wget https://raw.githubusercontent.com/jsle97/xdB/refs/heads/main/xdb.js
```
```
sudo wget https://jsle.eu/xdB/xdb.js
```
Import the library into your project:

```javascript
import xdB, { XDB_ERROR_CODES } from './path/to/xdb.js'; // Adjust path as needed
```

### 2.2 Basic Configuration

Before using xdB, configure the base path where data files will be stored.

```javascript
async function initialize() {
  try {
    await xdB.config({
      basePath: './my_data', // All data files will be relative to this directory
      logLevel: 'INFO',     // Set desired logging level (DEBUG, INFO, WARN, ERROR, NONE)
      enableBackup: true    // Enable backups (optional)
    });
    console.log('xdB configured successfully. Base path:', xdB.getBasePath());
  } catch (error) {
    console.error('Failed to configure xdB:', error);
  }
}

initialize();
```

### 2.3 Simple Example: Adding and Viewing Data

```javascript
async function runExample() {
  const filePath = 'users.json'; // Will be stored as ./my_data/users.json

  try {
    // Add a new user (xdB creates the file if it doesn't exist)
    const addUserResult = await xdB.add.id(filePath, {
      username: 'alice',
      email: 'alice@example.com',
      registeredAt: new Date().toISOString()
    });
    const newUserId = addUserResult.record.id; // xdB auto-generates an ID if not provided
    console.log(`Added user with ID: ${newUserId}`);

    // View the user by ID
    const viewUserResult = await xdB.view.id(filePath, newUserId);
    console.log('Retrieved User:', viewUserResult.record);

    // View all users
    const allUsersResult = await xdB.view.all(filePath);
    console.log('All Users:', allUsersResult.data);

  } catch (error) {
    // Handle specific xdB errors
    if (error.code === XDB_ERROR_CODES.RECORD_EXISTS) {
      console.error(`Error: Record already exists - ${error.message}`);
    } else {
      console.error(`An xdB operation failed: ${error.message}`, error);
    }
  }
}

// Ensure configuration is done before running the example
initialize().then(runExample);
```

---

## 3. Core Concepts

### 3.1 File Structure

*   xdB operates on JSON files within the configured `basePath`.
*   It expects data files (e.g., `users.json`, `posts.json`) to primarily contain a JSON **array** of objects. Each object in the array represents a **record**.
*   Every record **must** have a unique `id` property (string). xdB can auto-generate IDs using its internal `_xdToken` function if an `id` is not provided during creation.
*   File paths passed to xdB functions are relative to the `basePath`. The `.json` extension is automatically appended if missing.

### 3.2 Atomic Operations & Concurrency

*   **Atomic Writes:** To prevent data loss or corruption from incomplete writes (e.g., due to crashes), xdB performs writes using a temporary file. The data is first written entirely to a `.tmp` file. Only upon successful completion is the temporary file renamed to the target file name, making the change atomic.
*   **Locking:** xdB uses an asynchronous, in-process locking mechanism based on file paths (`acquireLock`, `releaseLock`). Before performing any potentially conflicting operation (like writing to a file), a lock is acquired. If the lock is already held by another operation, the current operation waits until the lock is released or a timeout occurs. This prevents race conditions where multiple operations try to modify the same file concurrently.

### 3.3 Indexing

*   For performance-critical lookups, you can configure indexes on specific fields within a data file.
*   Indexes are defined in the `setConfig` options (`indexes` key).
*   xdB maintains separate index files (within a `.index` subdirectory structure like `./my_data/index/users.json.index/email.json`) mapping field values to arrays of record IDs.
*   The `xdB.query(filePath, fieldName, value)` function utilizes these indexes for fast retrieval.
*   Querying non-indexed fields requires using `xdB.view.more` with a filter function, which scans the entire file.

### 3.4 Schema Validation

*   When `enableSchemaValidation` is `true` and `schemas` are defined in the configuration, xdB validates records against their corresponding JSON Schema before adding (`add.id`) or editing (`edit.id`).
*   This ensures data consistency and integrity according to predefined rules (e.g., required fields, data types, formats, enums).
*   If validation fails, an error with code `XDB_INVALID_SCHEMA` (or potentially `OPERATION_FAILED`) is thrown.

### 3.5 Relationships

*   xdB allows defining logical relationships between records in different files (e.g., a user has many posts).
*   Supported types: `1:1`, `1:N` (one-to-many), `N:M` (many-to-many, requires a junction file).
*   Relationships are defined using `xdB.relations.define`.
*   `onDelete` strategies (CASCADE, SET_NULL, RESTRICT) control behavior when a referenced record is deleted.
*   Related data can be fetched using `xdB.relations.getRelated`.
*   Referential integrity can be checked using `xdB.utils.verifyRelations`.

### 3.6 Error Handling

*   xdB uses custom error objects created by `createXdbError`.
*   Errors include a `message` and a `code` property corresponding to one of the `XDB_ERROR_CODES` constants (see Appendix). This allows for robust programmatic error handling.
*   Default error messages can be customized by placing a `xdb_error_list.json` file in the `basePath`.

### 3.7 Logging

*   xdB provides configurable logging using standard `console` methods (`log`, `warn`, `error`, `debug`).
*   The `logLevel` configuration option controls the verbosity (DEBUG, INFO, WARN, ERROR, NONE).
*   Logs can optionally be written to a file specified by `logFilePath`.

### 3.8 Event System

*   xdB uses Node.js's `EventEmitter` to emit events during the lifecycle of operations.
*   Events are emitted *before* an operation starts, *after* it successfully completes, and if an *error* occurs.
*   Examples: `beforeAddId`, `afterAddId`, `errorAddId`.
*   You can listen to these events using `xdB.on(eventName, listener)` and remove listeners with `xdB.off(eventName, listener)`. This enables hooking into xdB operations for logging, auditing, or triggering side effects. (See `5.5 Using the Event System` for details).

### 3.9 Configuration

*   Configuration is crucial and is set using `xdB.config(optionsOrPath)`.
*   It can be provided as an object or a path to a JSON configuration file.
*   Key options include `basePath`, `logLevel`, `enableBackup`, `indexes`, `schemas`, relationship caching, etc. (See API Reference for `setConfig` for full details).

---

## 4. API Reference

This section details the public API provided by xdB. All functions are asynchronous and return Promises.

### 4.1 Configuration & Core

**`xdB.config(optionsOrPath)`**

*   **Purpose:** Configures the xdB library instance. Should be called before other operations.
*   **Parameters:**
    *   `optionsOrPath` (Object | String): Either a configuration object or a string path (relative to the initial script location or absolute) to a JSON configuration file.
*   **Configuration Options (Object properties):**
    *   `basePath` (String): **Required (or previously set)**. The root directory for all data files and internal structures (like indexes).
    *   `logLevel` (String | Number): Sets the logging verbosity. Accepts level names (`'DEBUG'`, `'INFO'`, `'WARN'`, `'ERROR'`, `'NONE'`) or their numeric values (`10`, `20`, `30`, `40`, `99`). Default: `INFO`.
    *   `logFilePath` (String | null): Path to a file for appending logs. If `null` or omitted, logs only go to the console.
    *   `enableBackup` (Boolean): If `true`, enables the backup system. Default: `false`.
    *   `backupExtension` (String): File extension for backup files (e.g., `.bak`, `.backup`). Default: `.bak`. Must start with `.` or it will be added.
    *   `backupOnWriteOnly` (Boolean): If `true` (and `enableBackup` is true), backups are *only* created during the core `atomicWrite` calls (effectively backing up before any overwrite). If `false`, specific operation backups (`backupOnAdd`, `backupOnEdit`, `backupOnDelete`) are respected. Default: `true`.
    *   `backupOnAdd` (Boolean): If `true` (and `enableBackup` is true, `backupOnWriteOnly` is false), creates a backup before `add.id` or `add.all` operations *if the file already exists*. Default: `false`.
    *   `backupOnEdit` (Boolean): If `true` (and `enableBackup` is true, `backupOnWriteOnly` is false), creates a backup before `edit.id` or `edit.all` operations. Default: `false`.
    *   `backupOnDelete` (Boolean): If `true` (and `enableBackup` is true, `backupOnWriteOnly` is false), creates a backup before `del.id` or `del.all` operations. Default: `false`.
    *   `indexes` (Object): Defines fields to index for specific files. Keys are file paths (e.g., `'users.json'`), values are arrays of field names (e.g., `['email', 'role']`).
    *   `enableSchemaValidation` (Boolean): If `true`, enables JSON Schema validation for `add.id` and `edit.id`. Default: `false`.
    *   `schemas` (Object): Defines JSON Schemas for files. Keys are file paths, values are JSON Schema objects. Required if `enableSchemaValidation` is `true`.
    *   `enableRelationCache` (Boolean): If `true`, enables caching for `relations.getRelated` results. Default: `false`.
    *   `relationCacheTTL` (Number): Time-to-live for relation cache entries in milliseconds. Default: `300000` (5 minutes).
*   **Returns:** `Promise<void>`
*   **Throws:** Errors during file reading/parsing if a config path is used and fails. Logs warnings for invalid option types.

**`xdB.getBasePath()`**

*   **Purpose:** Returns the currently configured base path.
*   **Parameters:** None.
*   **Returns:** (String) The absolute path configured via `setConfig`.

### 4.2 Data Viewing (Read)

**`xdB.view.all(filePath)`**

*   **Purpose:** Retrieves all records from the specified JSON file.
*   **Parameters:**
    *   `filePath` (String): Path to the JSON file (relative to `basePath`). `.json` extension is optional.
*   **Returns:** `Promise<Object>`: An object `{ path: string, data: Array | Object }`. `data` usually contains the array of records, or an empty array if the file doesn't exist or is empty. Returns the parsed object directly if the file contains a single JSON object instead of an array.
*   **Throws:** `XDB_IO_ERROR`, `XDB_INVALID_JSON`.

**`xdB.view.id(filePath, id)`**

*   **Purpose:** Retrieves a single record by its ID from a JSON array file.
*   **Parameters:**
    *   `filePath` (String): Path to the JSON file.
    *   `id` (String | Number): The ID of the record to retrieve. Will be coerced to a string for comparison.
*   **Returns:** `Promise<Object>`: An object `{ path: string, record: Object }`.
*   **Throws:** `XDB_RECORD_NOT_FOUND`, `XDB_IO_ERROR`, `XDB_INVALID_JSON`, `XDB_OPERATION_FAILED` (if file is not an array).

**`xdB.view.more(filePath, options = {})`**

*   **Purpose:** Retrieves records based on advanced filtering, sorting, pagination, and relationship inclusion criteria. Performs a full file scan unless indexing covers the filter implicitly.
*   **Parameters:**
    *   `filePath` (String): Path to the JSON file.
    *   `options` (Object): Optional parameters:
        *   `filter` (Function): A function `(record) => boolean` to filter records.
        *   `sort` (Object | Array<Object>): Defines sorting criteria. Each criterion is an object:
            *   `key` (String): The field name to sort by.
            *   `order` (String): `'asc'` (default) or `'desc'`.
            *   `comparator` (Function): Optional custom sort function `(a, b) => number`. Overrides `key` and `order` if provided.
        *   `skip` (Number): Number of records to skip (for pagination). Default: `0`.
        *   `limit` (Number): Maximum number of records to return. Default: `Infinity`.
        *   `include` (Array<String>): An array of relation names (defined via `relations.define`) to include. Related data will be added as properties on the returned records.
        *   `includeStrategy` (String): `'eager'` (default) fetches related data immediately. `'lazy'` adds a function property `relationName: () => Promise<relatedData>` to fetch data on demand.
*   **Returns:** `Promise<Object>`: An object `{ path: string, data: Array }` containing the filtered, sorted, and paginated records, potentially with included relations.
*   **Throws:** `XDB_IO_ERROR`, `XDB_INVALID_JSON`, `XDB_OPERATION_FAILED` (e.g., invalid options, file not an array, relation errors during include).

### 4.3 Data Adding (Create)

**`xdB.add.all(filePath, initialData = [], options = { overwrite: true })`**

*   **Purpose:** Creates a new file or completely overwrites an existing file with the provided data.
*   **Parameters:**
    *   `filePath` (String): Path to the JSON file.
    *   `initialData` (Array | Object): The data to write to the file. If an array, records without IDs will have them generated. Provided IDs are validated.
    *   `options` (Object):
        *   `overwrite` (Boolean): If `true` (default), overwrites the file if it exists. If `false` and the file exists, it throws an error.
*   **Returns:** `Promise<Object>`: An object `{ path: string }` indicating the path of the written file. `writtenData` is included in the `afterAddAll` event.
*   **Throws:** `XDB_OPERATION_FAILED` (e.g., if `overwrite` is false and file exists, invalid `initialData`, duplicate IDs in `initialData`), `XDB_IO_ERROR`, `XDB_INVALID_SCHEMA` (if validation enabled and records fail).

**`xdB.add.id(filePath, newRecord)`**

*   **Purpose:** Adds a single new record to a JSON array file. Creates the file (as an array) if it doesn't exist.
*   **Parameters:**
    *   `filePath` (String): Path to the JSON file.
    *   `newRecord` (Object): The record to add. If `id` is omitted or null, a unique ID is generated. If `id` is provided, it's validated for uniqueness.
*   **Returns:** `Promise<Object>`: An object `{ path: string, record: Object }` where `record` is the added record (with ID).
*   **Throws:** `XDB_RECORD_EXISTS` (if provided ID already exists), `XDB_OPERATION_FAILED` (e.g., file exists but isn't an array, ID generation failed), `XDB_IO_ERROR`, `XDB_INVALID_SCHEMA` (if validation enabled).

### 4.4 Data Editing (Update)

**`xdB.edit.all(filePath, newData)`**

*   **Purpose:** Replaces the entire content of a JSON file with `newData`. Similar to `add.all` but implies the file likely exists.
*   **Parameters:**
    *   `filePath` (String): Path to the JSON file.
    *   `newData` (Array | Object): The new data to write. Records should have valid IDs.
*   **Returns:** `Promise<Object>`: An object `{ path: string }`. `writtenData` is included in the `afterEditAll` event.
*   **Throws:** `XDB_OPERATION_FAILED` (e.g., invalid `newData`), `XDB_IO_ERROR`, `XDB_INVALID_SCHEMA` (if validation enabled and records fail).

**`xdB.edit.id(filePath, id, newRecordData)`**

*   **Purpose:** Updates a single existing record identified by `id`. Merges `newRecordData` into the existing record (shallow merge). The `id` field cannot be changed via this method.
*   **Parameters:**
    *   `filePath` (String): Path to the JSON file.
    *   `id` (String | Number): The ID of the record to edit.
    *   `newRecordData` (Object): An object containing the fields to update. Should not include the `id` field.
*   **Returns:** `Promise<Object>`: An object `{ path: string, record: Object }` where `record` is the fully updated record.
*   **Throws:** `XDB_RECORD_NOT_FOUND`, `XDB_OPERATION_FAILED` (e.g., file not an array), `XDB_IO_ERROR`, `XDB_INVALID_SCHEMA` (if validation enabled and the *resulting* record fails).

### 4.5 Data Deleting (Delete)

**`xdB.del.all(filePath)`**

*   **Purpose:** Deletes all records from a file by writing an empty array (`[]`) to it. Effectively clears the file content. Deletes associated index files.
*   **Parameters:**
    *   `filePath` (String): Path to the JSON file.
*   **Returns:** `Promise<Object>`: An object `{ path: string }`.
*   **Throws:** `XDB_IO_ERROR`. Does *not* throw if the file doesn't exist.

**`xdB.del.id(filePath, id)`**

*   **Purpose:** Deletes a single record identified by `id` from a JSON array file. Handles relational constraints (`onDelete` strategies).
*   **Parameters:**
    *   `filePath` (String): Path to the JSON file.
    *   `id` (String | Number): The ID of the record to delete.
*   **Returns:** `Promise<Object>`: An object `{ path: string, deletedId: string }`. `deletedRecord` is included in the `afterDeleteId` event.
*   **Throws:** `XDB_RECORD_NOT_FOUND`, `XDB_OPERATION_FAILED` (e.g., file not an array, RESTRICT constraint violation), `XDB_IO_ERROR`.

### 4.6 Directory Operations

**`xdB.dir.add(dirPath)`**

*   **Purpose:** Creates a directory (including parent directories if needed) within the `basePath`.
*   **Parameters:**
    *   `dirPath` (String): Path to the directory (relative to `basePath`).
*   **Returns:** `Promise<Object>`: An object `{ path: string }` with the absolute path of the created directory.
*   **Throws:** `XDB_IO_ERROR`.

**`xdB.dir.del(dirPath)`**

*   **Purpose:** Deletes a directory recursively within the `basePath`.
*   **Parameters:**
    *   `dirPath` (String): Path to the directory to delete.
*   **Returns:** `Promise<Object>`: An object `{ path: string }` with the absolute path of the deleted directory.
*   **Throws:** `XDB_DIR_NOT_FOUND`, `XDB_IO_ERROR`.

**`xdB.dir.rename(oldPath, newPath)`**

*   **Purpose:** Renames or moves a directory within the `basePath`.
*   **Parameters:**
    *   `oldPath` (String): Current path of the directory.
    *   `newPath` (String): New path for the directory.
*   **Returns:** `Promise<Object>`: An object `{ oldPath: string, newPath: string }` with the absolute paths.
*   **Throws:** `XDB_DIR_NOT_FOUND` (if `oldPath` doesn't exist), `XDB_IO_ERROR`.

### 4.7 File Operations

**`xdB.move.file(sourcePath, targetPath)`**

*   **Purpose:** Moves or renames a data file within the `basePath`. Ensures `.json` extension.
*   **Parameters:**
    *   `sourcePath` (String): Current path of the file.
    *   `targetPath` (String): New path for the file.
*   **Returns:** `Promise<Object>`: An object `{ source: string, target: string }` with the absolute paths.
*   **Throws:** `XDB_FILE_NOT_FOUND` (if `sourcePath` doesn't exist), `XDB_IO_ERROR`.

### 4.8 Indexing & Querying

**`xdB.query(filePath, fieldName, fieldValue)`**

*   **Purpose:** Retrieves records where `fieldName` matches `fieldValue`, using pre-built indexes for speed.
*   **Parameters:**
    *   `filePath` (String): Path to the JSON file.
    *   `fieldName` (String): The indexed field to query. Must be configured in `setConfig`.
    *   `fieldValue` (Any): The value to match in the index. Will be coerced to a string for lookup.
*   **Returns:** `Promise<Array<Object>>`: An array of matching records. Returns an empty array if no matches are found or the index is empty.
*   **Throws:** `XDB_OPERATION_FAILED` (if `fieldName` is not indexed for `filePath`), `XDB_IO_ERROR`, `XDB_INVALID_JSON`. Logs warnings if indexed IDs aren't found in the main file (stale index).

*(Note: Index management functions like `updateIndex`, `removeFromIndex`, `rebuildIndexesForFile` are internal but crucial for `add`, `edit`, `del`, and `query` operations.)*

### 4.9 Relationship Management

**`xdB.relations.define(name, config)`**

*   **Purpose:** Defines a named relationship between data files.
*   **Parameters:**
    *   `name` (String): A unique name for the relation (e.g., `'userPosts'`).
    *   `config` (Object): Configuration object for the relation:
        *   `type` (String): `'1:1'`, `'1:N'`, or `'N:M'`.
        *   `localFile` (String): Path to the "source" file (e.g., `users.json`).
        *   `localField` (String): The field in `localFile` acting as the key (usually `id`).
        *   `foreignFile` (String): Path to the "target" file (e.g., `posts.json`).
        *   `foreignField` (String): The field in `foreignFile` that references `localField`.
        *   `junctionFile` (String): **Required for `N:M`**. Path to the junction table file.
        *   `junctionLocalField` (String): **Required for `N:M`**. Field in `junctionFile` referencing `localFile`.
        *   `junctionForeignField` (String): **Required for `N:M`**. Field in `junctionFile` referencing `foreignFile`.
        *   `onDelete` (String): Strategy when a record in `localFile` is deleted. Options:
            *   `'RESTRICT'` (Default): Prevent deletion if related records exist.
            *   `'CASCADE'`: Delete related records in `foreignFile` (or junction entries for N:M).
            *   `'SET_NULL'`: Set the `foreignField` in related `foreignFile` records to `null` (or delete junction entries for N:M).
*   **Returns:** `Promise<void>` (Implicitly, as it's synchronous logic wrapped for potential future async needs, but defined synchronously in the code).
*   **Throws:** `XDB_INVALID_CONFIG` if the configuration is invalid.

**`xdB.relations.remove(name)`**

*   **Purpose:** Removes a previously defined relation.
*   **Parameters:**
    *   `name` (String): The name of the relation to remove.
*   **Returns:** `Promise<void>` (Implicitly synchronous).

**`xdB.relations.getRelated(relationName, localId)`**

*   **Purpose:** Retrieves related records based on a defined relation and a local record's ID. Uses caching if enabled.
*   **Parameters:**
    *   `relationName` (String): The name of the defined relation.
    *   `localId` (String | Number): The ID of the record in the `localFile` of the relation.
*   **Returns:** `Promise<Object | Array | null>`:
    *   For `1:1`: The single related record or `null`.
    *   For `1:N` or `N:M`: An array of related records (can be empty).
*   **Throws:** `XDB_OPERATION_FAILED` (e.g., relation not defined, file errors during lookup), `XDB_INVALID_CONFIG`.

### 4.10 Utilities

**`xdB.utils.restoreFromBackup(filePath)`**

*   **Purpose:** Restores a data file from its latest backup file (e.g., overwrites `users.json` with `users.json.bak`).
*   **Parameters:**
    *   `filePath` (String): Path to the data file to restore.
*   **Returns:** `Promise<Object>`: An object `{ path: string, restoredFrom: string }`.
*   **Throws:** `XDB_FILE_NOT_FOUND` (if backup file doesn't exist), `XDB_IO_ERROR`.

**`xdB.utils.verifyRelations()`**

*   **Purpose:** Checks all defined relations for referential integrity (e.g., finds foreign keys pointing to non-existent records).
*   **Parameters:** None.
*   **Returns:** `Promise<Array<Object>>`: An array of inconsistency objects, each detailing a broken link: `{ relationName, type, sourceFile, sourceRecordId, sourceField, brokenValue, targetFile, targetField }`. Returns an empty array if all relations are consistent.
*   **Throws:** `XDB_IO_ERROR`, `XDB_INVALID_JSON` if files cannot be read/parsed during verification.

### 4.11 Event Handling

**`xdB.on(eventName, listener)`**

*   **Purpose:** Registers an event listener function for a specific xdB event.
*   **Parameters:**
    *   `eventName` (String): The name of the event to listen for (see Section 5.5).
    *   `listener` (Function): The callback function to execute when the event is emitted. It receives a data payload specific to the event.
*   **Returns:** `void`

**`xdB.off(eventName, listener)`**

*   **Purpose:** Removes a previously registered event listener.
*   **Parameters:**
    *   `eventName` (String): The name of the event.
    *   `listener` (Function): The specific listener function to remove.
*   **Returns:** `void`

---

## 5. Advanced Topics

### 5.1 Indexing Strategies & Performance

*   **When to Index:** Index fields that are frequently used for direct lookups (`query`) or as the primary filtering criteria in `view.more`. Common candidates include IDs, unique keys (email, username), foreign keys, status fields, or category tags.
*   **Performance:** `xdB.query` on an indexed field is significantly faster than `xdB.view.more` with a filter function, especially for large files, as it avoids scanning the entire data file. `view.more` is flexible but reads and processes the whole file (before pagination).
*   **Overhead:** Each index adds disk space usage (index files) and slight overhead to write operations (`add.id`, `edit.id`, `del.id`) as indexes need to be updated. Don't index every field unnecessarily.
*   **Index Maintenance:** Indexes are automatically updated during standard CRUD operations. `add.all` and `edit.all` trigger a full index rebuild for the affected file. `del.all` removes the indexes. Manual file modifications outside of xdB will lead to stale indexes. Use `rebuildIndexesForFile` (internal, but could be exposed if needed) or `edit.all` with existing data to manually refresh indexes if corruption is suspected.

### 5.2 Relationship Management Deep Dive

*   **`onDelete` Behavior:**
    *   `RESTRICT`: Safest default. Prevents deleting a record if anything still refers to it. Ensures no dangling references are created by deletion.
    *   `CASCADE`: Powerful but potentially dangerous. Deleting a record automatically deletes *all* referring records (or junction entries). Use with caution, especially in complex relationship chains.
    *   `SET_NULL`: A middle ground. Deletes the link by setting the foreign key field to `null` in referring records (or deletes junction entries for N:M). Requires the foreign key field in the database schema (if using validation) to allow `null` values.
*   **N:M Relationships:** Require a third "junction" file (e.g., `user_roles.json`) containing pairs of IDs linking records from the two main files (e.g., `userId` and `roleId`).
*   **Verification:** Regularly run `xdB.utils.verifyRelations()` in development or as a maintenance task to catch data inconsistencies early, especially after manual data manipulation or complex operations.
*   **Relation Cache:** Enabling `enableRelationCache` can significantly speed up repeated calls to `relations.getRelated` for the *same relation and local ID* within the `relationCacheTTL`. However, it consumes memory and might return stale data if the underlying related records are modified *after* being cached but *before* the TTL expires and *without* clearing the cache (cache is automatically cleared on most write operations, but be mindful).

### 5.3 Schema Validation Details

*   Schemas are defined using standard [JSON Schema](https://json-schema.org/) syntax.
*   Validation is performed on the *entire record* before it's added or after it's merged during an edit.
*   Use schemas to enforce:
    *   Required fields (`required: ['field1', 'field2']`).
    *   Data types (`type: 'string'`, `type: 'number'`, `type: 'boolean'`, `type: 'object'`, `type: 'array'`).
    *   String formats (`format: 'email'`, `format: 'date-time'`, etc.).
    *   String patterns (`pattern: '^[a-z]+$'`).
    *   Numeric ranges (`minimum: 0`, `maximum: 100`).
    *   Enum values (`enum: ['admin', 'user', 'guest']`).
    *   Array constraints (`minItems: 1`, `uniqueItems: true`).
*   Validation adds a small performance overhead to write operations (`add.id`, `edit.id`).

### 5.4 Backup Strategies

*   `enableBackup: true` is the master switch.
*   `backupOnWriteOnly: true` (Default): Creates a single backup just before any file content is potentially overwritten by `atomicWrite`. This is generally efficient and covers most cases.
*   `backupOnWriteOnly: false`: Allows finer control via `backupOnAdd`, `backupOnEdit`, `backupOnDelete`. This might create more backup files but allows tailoring backups to specific operations. For example, you might only want backups before deletions.
*   Backup files are simple copies (`fs.copyFile`) with the configured `backupExtension`. They are not timestamped or managed beyond simple creation. Manual cleanup of old backups might be necessary.
*   Use `utils.restoreFromBackup` to revert a file to its last backup state.

### 5.5 Using the Event System

*   The event system allows observing and reacting to xdB operations.
*   **Event Naming Convention:** `before<Operation>`, `after<Operation>`, `error<Operation>`.
    *   Example Operations: `AddId`, `AddAll`, `EditId`, `EditAll`, `DeleteId`, `DeleteAll`, `RelationDefine`, `RelationRemove`.
*   **Payloads:** Listener functions receive a data object containing context about the operation.
    *   `before*` events usually receive the input parameters (`filePath`, `id`, `record`, `options`, etc.).
    *   `after*` events usually receive the input parameters plus the result (`path`, `record`, `deletedId`, `writtenData`, etc.).
    *   `error*` events usually receive the input parameters plus the `error` object.
*   **Use Cases:**
    *   Detailed logging/auditing.
    *   Invalidating external caches.
    *   Triggering notifications or webhooks.
    *   Extending functionality (e.g., custom validation *before* an operation).

```javascript
// Example: Log every successful record addition
xdB.on('afterAddId', (data) => {
  console.log(`[AUDIT] Record added: ID=${data.record.id} in File=${data.filePath}`);
});

// Example: Notify on deletion errors
xdB.on('errorDeleteId', (data) => {
  console.error(`[ALERT] Failed to delete record ID=${data.id} from ${data.filePath}: ${data.error.message}`);
  // Potentially send notification here
});
```

### 5.6 Custom Error Messages

*   Create a file named `xdb_error_list.json` in the `basePath`.
*   Structure it as a JSON object where keys are `XDB_ERROR_CODES` (e.g., `"XDB_RECORD_NOT_FOUND"`) and values are the custom message strings.
*   You can use placeholders like `{id}` or `{filePath}` in the messages. These will be replaced by context provided to `createXdbError` if available.

```json
// ./my_data/xdb_error_list.json
{
  "XDB_RECORD_NOT_FOUND": "Oops! We couldn't find the record with ID '{id}' in the file '{filePath}'.",
  "XDB_RECORD_EXISTS": "Hold on! A record with the ID '{id}' already exists in '{filePath}'. Please use a unique ID.",
  "XDB_INVALID_SCHEMA": "Data validation failed for '{filePath}': Field '{field}' - {message}"
}
```
*(Note: Placeholder replacement depends on the context passed internally when `createXdbError` is called. Available placeholders might vary per error context).*

---

## 6. Full Application Examples

Here are three examples demonstrating how xdB can be used to build different types of applications. Each example includes configuration, schema definitions, relation definitions (where applicable), and sample usage code.

---

### Example 1: Simple To-Do List Application

**Concept:** A basic application to manage personal to-do tasks. Each task has a title, a completion status, and an optional due date.

**File Structure (`./todo_data/`):**

```
./todo_data/
└── tasks.json
```

**1. Configuration:**

```javascript
// config.js or directly in your setup file
const todoAppConfig = {
  basePath: './todo_data',
  logLevel: 'INFO',
  enableBackup: false, // Simple app, backups disabled for brevity
  enableSchemaValidation: true,
  schemas: {
    'tasks.json': {
      type: 'object',
      required: ['title', 'completed'],
      properties: {
        id: { type: 'string' }, // Managed by xdB
        title: { type: 'string', minLength: 1 },
        completed: { type: 'boolean', default: false },
        dueDate: { type: 'string', format: 'date', description: 'Optional due date in YYYY-MM-DD format' }
        // createdAt handled automatically if needed by app logic
      }
    }
  },
  // No indexes needed for this simple example, view.more is sufficient
  indexes: {
     'tasks.json': ['completed'] // Optional: Index for faster filtering by completion status
  }
};

// Initialize xdB
await xdB.config(todoAppConfig);
```

**2. Schemas & Relations:**

*   Schema is defined directly in the configuration above for `tasks.json`.
*   No relations are needed for this simple example.

**3. Sample Usage:**

```javascript
import xdB, { XDB_ERROR_CODES } from './path/to/xdb.js'; // Assuming xdB is in scope

const TASKS_FILE = 'tasks.json';

// Add a new task
async function addTask(title, dueDate = null) {
  try {
    const taskData = { title, completed: false };
    if (dueDate) {
      // Basic date validation (more robust validation recommended)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
         throw new Error("Invalid dueDate format. Use YYYY-MM-DD.");
      }
      taskData.dueDate = dueDate;
    }
    const result = await xdB.add.id(TASKS_FILE, taskData);
    console.log(`Task added: ${result.record.title} (ID: ${result.record.id})`);
    return result.record;
  } catch (error) {
    console.error(`Failed to add task: ${error.message}`);
    if (error.code === XDB_ERROR_CODES.INVALID_SCHEMA) {
       console.error("Schema validation failed:", error.message); // More specific error from schema
    }
  }
}

// Mark a task as complete
async function completeTask(taskId) {
  try {
    const result = await xdB.edit.id(TASKS_FILE, taskId, { completed: true });
    console.log(`Task marked as complete: ${result.record.title}`);
  } catch (error) {
     if (error.code === XDB_ERROR_CODES.RECORD_NOT_FOUND) {
        console.error(`Task with ID ${taskId} not found.`);
     } else {
        console.error(`Failed to complete task: ${error.message}`);
     }
  }
}

// View incomplete tasks
async function viewIncompleteTasks() {
  try {
    // Using view.more for filtering
    // const results = await xdB.view.more(TASKS_FILE, {
    //   filter: task => !task.completed,
    //   sort: { key: 'dueDate', order: 'asc' } // Sort by due date
    // });

    // Using query (if 'completed' is indexed)
    const results = await xdB.query(TASKS_FILE, 'completed', false);
    // Note: query result isn't sorted here, manual sort or view.more needed for sorting

    console.log("\nIncomplete Tasks:");
    if (results.data?.length > 0) { // Check based on view.more response structure
      results.data.forEach(task => {
        console.log(`- [ ] ${task.title}${task.dueDate ? ` (Due: ${task.dueDate})` : ''} (ID: ${task.id})`);
      });
    } else if (results.length > 0) { // Check based on query response structure
       results.forEach(task => {
         console.log(`- [ ] ${task.title}${task.dueDate ? ` (Due: ${task.dueDate})` : ''} (ID: ${task.id})`);
       });
    } else {
      console.log("No incomplete tasks found.");
    }
  } catch (error) {
    console.error(`Failed to view tasks: ${error.message}`);
  }
}

// Delete a task
async function deleteTask(taskId) {
   try {
      await xdB.del.id(TASKS_FILE, taskId);
      console.log(`Task with ID ${taskId} deleted successfully.`);
   } catch (error) {
      if (error.code === XDB_ERROR_CODES.RECORD_NOT_FOUND) {
         console.error(`Task with ID ${taskId} not found for deletion.`);
      } else {
         console.error(`Failed to delete task: ${error.message}`);
      }
   }
}

// --- Example Execution Flow ---
// await xdB.config(todoAppConfig); // Make sure config is loaded first
// const task1 = await addTask("Buy groceries", "2024-08-15");
// const task2 = await addTask("Finish xdB documentation");
// await viewIncompleteTasks();
// if (task1) await completeTask(task1.id);
// await viewIncompleteTasks();
// if (task2) await deleteTask(task2.id);

```

---

### Example 2: Product Catalog with Categories (N:M Relationship)

**Concept:** Manage a catalog of products, where each product can belong to multiple categories, and categories can contain multiple products.

**File Structure (`./catalog_data/`):**

```
./catalog_data/
├── products.json
├── categories.json
└── product_categories.json  # Junction file
├── index/                    # Auto-generated by xdB if indexing enabled
│   └── products.json.index/
│       └── price.json
│       └── ...
└── xdb_error_list.json       # Optional custom errors
```

**1. Configuration:**

```javascript
// config.js
const catalogAppConfig = {
  basePath: './catalog_data',
  logLevel: 'WARN',
  enableBackup: true,
  backupExtension: '.bak',
  enableSchemaValidation: true,
  schemas: {
    'products.json': {
      type: 'object',
      required: ['name', 'price', 'sku'],
      properties: {
        id: { type: 'string' },
        name: { type: 'string', minLength: 2 },
        description: { type: 'string' },
        price: { type: 'number', minimum: 0 },
        sku: { type: 'string', pattern: '^[A-Z0-9\\-]+$' }, // Example SKU format
        stock: { type: 'integer', minimum: 0, default: 0 }
      }
    },
    'categories.json': {
      type: 'object',
      required: ['name'],
      properties: {
        id: { type: 'string' },
        name: { type: 'string', minLength: 2 },
        slug: { type: 'string', pattern: '^[a-z0-9\\-]+$' } // Example slug format
      }
    },
    'product_categories.json': { // Schema for the junction file
      type: 'object',
      required: ['productId', 'categoryId'],
      properties: {
        id: { type: 'string' },
        productId: { type: 'string' },
        categoryId: { type: 'string' }
      }
    }
  },
  indexes: {
    'products.json': ['sku', 'price'], // Index SKU for uniqueness checks (app logic) and price for filtering
    'categories.json': ['slug'],      // Index slug for lookups
    'product_categories.json': ['productId', 'categoryId'] // IMPORTANT: Index both FKs in junction table
  },
  enableRelationCache: true, // Good candidate for caching related lookups
  relationCacheTTL: 600000 // 10 minutes
};

// Initialize xdB
await xdB.config(catalogAppConfig);
```

**2. Schemas & Relations:**

*   Schemas defined in the config above.
*   **Define N:M Relation:**

```javascript
// Define relation after config is loaded
xdB.relations.define('productToCategories', {
  type: 'N:M',
  localFile: 'products.json',
  localField: 'id', // Field in products.json
  foreignFile: 'categories.json',
  foreignField: 'id', // Field in categories.json
  junctionFile: 'product_categories.json',
  junctionLocalField: 'productId', // Field in junction pointing to products.json
  junctionForeignField: 'categoryId', // Field in junction pointing to categories.json
  onDelete: 'CASCADE' // If a product is deleted, remove its entries from the junction table
});

// Define the inverse relation (optional but useful)
xdB.relations.define('categoryToProducts', {
  type: 'N:M',
  localFile: 'categories.json', // Now categories is local
  localField: 'id',
  foreignFile: 'products.json', // Products is foreign
  foreignField: 'id',
  junctionFile: 'product_categories.json',
  junctionLocalField: 'categoryId', // Field in junction pointing to categories.json
  junctionForeignField: 'productId', // Field in junction pointing to products.json
  onDelete: 'CASCADE' // If a category is deleted, remove its entries from the junction table
});
```

**3. Sample Usage:**

```javascript
import xdB, { XDB_ERROR_CODES } from './path/to/xdb.js';

const PRODUCTS_FILE = 'products.json';
const CATEGORIES_FILE = 'categories.json';
const JUNCTION_FILE = 'product_categories.json';

// Add a new product
async function addProduct(productData) {
  try {
    // Add application-level check for unique SKU using index
    const existing = await xdB.query(PRODUCTS_FILE, 'sku', productData.sku);
    if (existing.length > 0) {
      throw new Error(`Product with SKU ${productData.sku} already exists.`);
    }
    const result = await xdB.add.id(PRODUCTS_FILE, productData);
    console.log(`Product added: ${result.record.name}`);
    return result.record;
  } catch (error) {
    console.error(`Failed to add product: ${error.message}`);
  }
}

// Add a new category
async function addCategory(categoryData) {
   try {
      // Check for unique slug
      const existing = await xdB.query(CATEGORIES_FILE, 'slug', categoryData.slug);
      if (existing.length > 0) {
         throw new Error(`Category with slug ${categoryData.slug} already exists.`);
      }
      const result = await xdB.add.id(CATEGORIES_FILE, categoryData);
      console.log(`Category added: ${result.record.name}`);
      return result.record;
   } catch (error) {
      console.error(`Failed to add category: ${error.message}`);
   }
}

// Assign a product to a category
async function assignProductToCategory(productId, categoryId) {
  try {
    // Check if assignment already exists (optional, depends on desired behavior)
    const existingLink = await xdB.view.more(JUNCTION_FILE, {
        filter: link => link.productId === productId && link.categoryId === categoryId,
        limit: 1
    });
    if (existingLink.data.length > 0) {
        console.log(`Product ${productId} is already in category ${categoryId}.`);
        return existingLink.data[0];
    }

    // Create link in junction table
    const result = await xdB.add.id(JUNCTION_FILE, { productId, categoryId });
    console.log(`Assigned product ${productId} to category ${categoryId} (Link ID: ${result.record.id})`);
    return result.record;
  } catch (error) {
    // Handle errors like product/category not found if IDs are validated beforehand
    console.error(`Failed to assign product to category: ${error.message}`);
  }
}

// Get all categories for a specific product
async function getProductCategories(productId) {
  try {
    const categories = await xdB.relations.getRelated('productToCategories', productId);
    console.log(`\nCategories for Product ID ${productId}:`);
    if (categories && categories.length > 0) {
      categories.forEach(cat => console.log(`- ${cat.name}`));
    } else {
      console.log("No categories assigned.");
    }
    return categories;
  } catch (error) {
    console.error(`Failed to get categories for product ${productId}: ${error.message}`);
  }
}

// Get all products in a specific category (using slug)
async function getProductsInCategory(categorySlug) {
   try {
      // Find category by slug first
      const categoryResult = await xdB.query(CATEGORIES_FILE, 'slug', categorySlug);
      if (!categoryResult || categoryResult.length === 0) {
         console.log(`Category with slug '${categorySlug}' not found.`);
         return [];
      }
      const categoryId = categoryResult[0].id;

      // Use the inverse relation
      const products = await xdB.relations.getRelated('categoryToProducts', categoryId);
      console.log(`\nProducts in Category '${categoryResult[0].name}':`);
      if (products && products.length > 0) {
         products.forEach(prod => console.log(`- ${prod.name} (Price: ${prod.price})`));
      } else {
         console.log("No products found in this category.");
      }
      return products;

   } catch (error) {
      console.error(`Failed to get products in category ${categorySlug}: ${error.message}`);
   }
}


// --- Example Execution Flow ---
// await xdB.config(catalogAppConfig); // Load config
// // Define relations (as shown above)
//
// const laptop = await addProduct({ name: 'DevBook Pro', price: 1299.99, sku: 'DBP-X1', stock: 50 });
// const mouse = await addProduct({ name: 'Wireless Mouse', price: 25.50, sku: 'WM-01', stock: 200 });
// const electronics = await addCategory({ name: 'Electronics', slug: 'electronics' });
// const computers = await addCategory({ name: 'Computers', slug: 'computers' });
//
// if (laptop && electronics) await assignProductToCategory(laptop.id, electronics.id);
// if (laptop && computers) await assignProductToCategory(laptop.id, computers.id);
// if (mouse && electronics) await assignProductToCategory(mouse.id, electronics.id);
//
// if (laptop) await getProductCategories(laptop.id);
// await getProductsInCategory('electronics');
// await getProductsInCategory('computers');
//
// // Deleting the 'laptop' product will also delete its links in product_categories.json due to CASCADE
// // if (laptop) await xdB.del.id(PRODUCTS_FILE, laptop.id);
```

---

### Example 3: User Session Token Management

**Concept:** Store user records and associated session/refresh tokens. Implement automatic cleanup of tokens when a user is deleted.

**File Structure (`./auth_data/`):**

```
./auth_data/
├── users.json
└── tokens.json
├── index/
│   ├── users.json.index/
│   │   └── email.json
│   └── tokens.json.index/
│       └── userId.json
│       └── tokenValue.json # Assuming token value itself needs quick lookup
└── .backup/              # Auto-generated backup dir
    └── users.json.bak
```

**1. Configuration:**

```javascript
// config.js
const authAppConfig = {
  basePath: './auth_data',
  logLevel: 'INFO',
  enableBackup: true,
  backupExtension: '.sessionbak', // Custom extension
  backupOnDelete: true, // Specifically backup before deletes
  backupOnWriteOnly: false, // Use specific flags like backupOnDelete
  enableSchemaValidation: true,
  schemas: {
    'users.json': {
      type: 'object',
      required: ['email', 'passwordHash'],
      properties: {
        id: { type: 'string' },
        email: { type: 'string', format: 'email' },
        passwordHash: { type: 'string' },
        isActive: { type: 'boolean', default: true },
        createdAt: { type: 'string', format: 'date-time' }
      }
    },
    'tokens.json': {
      type: 'object',
      required: ['userId', 'tokenValue', 'type', 'expiresAt'],
      properties: {
        id: { type: 'string' },
        userId: { type: 'string' }, // Foreign key to users.json
        tokenValue: { type: 'string' }, // The actual token string
        type: { type: 'string', enum: ['session', 'refresh'] },
        expiresAt: { type: 'string', format: 'date-time' },
        issuedAt: { type: 'string', format: 'date-time' }
      }
    }
  },
  indexes: {
    'users.json': ['email'], // For login lookup
    'tokens.json': ['userId', 'tokenValue', 'type'] // Index FK, the token itself, and type
  }
};

// Initialize xdB
await xdB.config(authAppConfig);
```

**2. Schemas & Relations:**

*   Schemas defined in config above.
*   **Define 1:N Relation:**

```javascript
// Define relation after config is loaded
xdB.relations.define('userTokens', {
  type: '1:N',
  localFile: 'users.json',
  localField: 'id',
  foreignFile: 'tokens.json',
  foreignField: 'userId',
  onDelete: 'CASCADE' // CRITICAL: Delete user's tokens when user is deleted
});
```

**3. Sample Usage:**

```javascript
import xdB, { XDB_ERROR_CODES } from './path/to/xdb.js';
import crypto from 'crypto'; // For generating token values
import bcrypt from 'bcrypt'; // For password hashing (example)

const USERS_FILE = 'users.json';
const TOKENS_FILE = 'tokens.json';

// Register a new user
async function registerUser(email, password) {
  try {
    // Check if email exists
    const existing = await xdB.query(USERS_FILE, 'email', email);
    if (existing.length > 0) {
      throw new Error("Email already registered.");
    }
    const passwordHash = await bcrypt.hash(password, 10); // Hash password
    const result = await xdB.add.id(USERS_FILE, {
      email,
      passwordHash,
      isActive: true,
      createdAt: new Date().toISOString()
    });
    console.log(`User registered: ${result.record.email}`);
    return result.record;
  } catch (error) {
    console.error(`User registration failed: ${error.message}`);
  }
}

// Create a session token for a user
async function createSessionToken(userId, type = 'session', durationMinutes = 60) {
  try {
     const tokenValue = crypto.randomBytes(32).toString('hex');
     const now = new Date();
     const expiresAt = new Date(now.getTime() + durationMinutes * 60000);

     const result = await xdB.add.id(TOKENS_FILE, {
        userId,
        tokenValue,
        type,
        issuedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString()
     });
     console.log(`${type} token created for user ${userId}`);
     return result.record;
  } catch (error) {
     console.error(`Failed to create token for user ${userId}: ${error.message}`);
  }
}

// Validate a token value
async function validateToken(tokenValue) {
   try {
      const results = await xdB.query(TOKENS_FILE, 'tokenValue', tokenValue);
      if (results.length === 0) {
         console.log(`Token not found: ${tokenValue.substring(0, 8)}...`);
         return null;
      }
      const tokenRecord = results[0];
      // Check expiry
      if (new Date(tokenRecord.expiresAt) < new Date()) {
         console.log(`Token expired: ${tokenValue.substring(0, 8)}...`);
         // Optional: Delete expired token here
         // await xdB.del.id(TOKENS_FILE, tokenRecord.id);
         return null;
      }
      console.log(`Token validated successfully for user ${tokenRecord.userId}`);
      return tokenRecord; // Return the valid token record
   } catch (error) {
      console.error(`Token validation error: ${error.message}`);
      return null;
   }
}

// Delete a user (will also delete their tokens via CASCADE)
async function deleteUser(userId) {
  try {
    // Relation definition handles token deletion automatically
    const result = await xdB.del.id(USERS_FILE, userId);
    console.log(`User ${userId} and associated tokens deleted.`);
    return result;
  } catch (error) {
    if (error.code === XDB_ERROR_CODES.RECORD_NOT_FOUND) {
      console.error(`User ${userId} not found for deletion.`);
    } else {
      console.error(`Failed to delete user ${userId}: ${error.message}`);
    }
  }
}

// Find and remove expired tokens (maintenance task)
async function cleanupExpiredTokens() {
   console.log("\nRunning expired token cleanup...");
   let deletedCount = 0;
   try {
      const now = new Date();
      // Get all tokens (consider batching for very large token sets)
      const allTokensResult = await xdB.view.all(TOKENS_FILE);
      if (!Array.isArray(allTokensResult.data)) return;

      const expiredTokenIds = allTokensResult.data
         .filter(token => new Date(token.expiresAt) < now)
         .map(token => token.id);

      if (expiredTokenIds.length > 0) {
         console.log(`Found ${expiredTokenIds.length} expired tokens to delete.`);
         for (const tokenId of expiredTokenIds) {
            try {
               await xdB.del.id(TOKENS_FILE, tokenId);
               deletedCount++;
            } catch (delError) {
               // Log error but continue cleanup
               console.warn(`Failed to delete expired token ${tokenId}: ${delError.message}`);
            }
         }
         console.log(`Deleted ${deletedCount} expired tokens.`);
      } else {
         console.log("No expired tokens found.");
      }
   } catch (error) {
      console.error(`Error during token cleanup: ${error.message}`);
   }
}


// --- Example Execution Flow ---
// await xdB.config(authAppConfig); // Load config
// // Define relation (as shown above)
//
// const user = await registerUser('test@example.com', 'password123');
// if (user) {
//   const sessionToken = await createSessionToken(user.id, 'session', 30); // 30 min session
//   const refreshToken = await createSessionToken(user.id, 'refresh', 60 * 24 * 7); // 7 day refresh
//
//   if (sessionToken) {
//      await validateToken(sessionToken.tokenValue);
//   }
//
//   // Simulate time passing...
//   // await cleanupExpiredTokens(); // Run cleanup manually or on a schedule
//
//   // Delete the user - this should also delete the tokens
//   await deleteUser(user.id);
//
//   // Verify tokens are gone (should return empty arrays)
//   const remainingTokens = await xdB.query(TOKENS_FILE, 'userId', user.id);
//   console.log(`Tokens remaining for deleted user ${user.id}: ${remainingTokens.length}`); // Should be 0
// }
```

---

## 7. Best Practices & Limitations

*   **Use Meaningful File Names:** Organize your data logically (e.g., `users.json`, `products.json`, `orders.json`).
*   **Schema Design:** Plan your data structure. Use schema validation to maintain consistency. Keep records relatively flat where possible.
*   **Indexing:** Index fields used frequently for lookups, but avoid over-indexing. Understand that `query` requires an exact match on the indexed value (or its string representation). Use `view.more` for complex filtering logic (range queries, partial matches, array checks).
*   **Relationships:** Define relations clearly. Choose `onDelete` strategies carefully based on your application logic. Run `verifyRelations` periodically.
*   **Error Handling:** Check for specific `XDB_ERROR_CODES` in your `catch` blocks for robust handling.
*   **Concurrency:** xdB's locking prevents data corruption from simultaneous writes *within the same Node.js process*. It does **not** handle locking across multiple processes or servers accessing the same file system. For multi-process scenarios, an external locking mechanism or a different database solution is required.
*   **Scalability:** xdB is best suited for small to medium datasets and moderate load. Performance can degrade with very large JSON files (hundreds of MBs or GBs) as `view.more` operations require reading and parsing the entire file. High-concurrency applications might hit bottlenecks with file system I/O and the in-process locking.
*   **Data Size:** Large individual records or deeply nested objects within records can increase parsing time and memory usage.
*   **Backups:** The default backup system is basic. For critical data, implement a more robust backup strategy (e.g., timestamped backups, off-site storage).
*   **Avoid Manual File Edits:** Modifying data files directly outside of xdB will bypass validation, locking, indexing updates, and event emissions, potentially leading to data corruption or inconsistencies.

---

## 8. Appendix: Error Codes

The `XDB_ERROR_CODES` constant provides the following keys:

*   `FILE_NOT_FOUND`: "XDB_FILE_NOT_FOUND"
*   `DIR_NOT_FOUND`: "XDB_DIR_NOT_FOUND"
*   `IO_ERROR`: "XDB_IO_ERROR" (General file system or read/write errors)
*   `INVALID_JSON`: "XDB_INVALID_JSON" (File content is not valid JSON)
*   `RECORD_NOT_FOUND`: "XDB_RECORD_NOT_FOUND"
*   `RECORD_EXISTS`: "XDB_RECORD_EXISTS"
*   `OPERATION_FAILED`: "XDB_OPERATION_FAILED" (Generic failure for operations, often due to invalid input, constraint violations, or unexpected states)
*   `INVALID_CONFIG`: "XDB_INVALID_CONFIG" (Errors in configuration options or relation definitions)
*   `INVALID_SCHEMA`: "XDB_INVALID_SCHEMA" (Data failed schema validation)
*   *(Internal Only)* `INTERNAL_ERROR`: Used internally for unexpected issues, like missing function arguments in `deleteRecordById`.

---
