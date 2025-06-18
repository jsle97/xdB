# xdFiles.js

![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)
![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Tests](https://img.shields.io/badge/Tests-Passing-brightgreen.svg)

**xdFiles.js** is a universal and comprehensive file and data management system for Node.js. It treats the file system as a database, offering powerful abstractions to manage files and structured data (primarily JSON) in an atomic and secure manner.

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [API](#api)
  - [Configuration](#configuration)
  - [JSON Data Operations](#json-data-operations)
  - [File Operations](#file-operations)
  - [Directory Management](#directory-management)
  - [Streaming](#streaming)
  - [Advanced Queries (Query Builder)](#advanced-queries-query-builder)
  - [Batch Operations](#batch-operations)
  - [Encryption & Compression](#encryption--compression)
  - [Versioning](#versioning)
  - [Indexing & Search](#indexing--search)
  - [Event System](#event-system)
  - [Cache](#cache)
  - [Utilities](#utilities)
- [License](#license)

## Introduction

xdFiles.js was created to simplify Node.js file system interactions by adding database-like functionalities such as secure CRUD operations on JSON files, transactional atomicity, file locking for concurrency safety, and built-in support for encryption, compression, and versioning.

## Features

*   **Zero Dependencies**: Entirely built on Node.js built-in modules.
*   **Atomic Write Operations**: Prevents data corruption by using temporary files and atomic rename operations.
*   **Concurrency Safety**: Built-in file locking prevents race conditions in multi-threaded/multi-process environments.
*   **JSON Data Management**: Full CRUD operations on JSON files treated as record collections with automatic ID generation.
*   **Advanced Queries**: Fluent API for building complex filter, sort, and field selection queries for JSON data.
*   **File & Directory Operations**: Intuitive methods for copying, moving, deleting files, and managing directories.
*   **Streaming**: Efficient handling of large files via streams, including piping with transformations.
*   **Batch Operations**: Execute multiple file operations as a single, transactional unit with rollback mechanism.
*   **Built-in Encryption & Compression**: Optional features for data security and space optimization.
*   **Versioning**: Create and retrieve file snapshots.
*   **Indexing & Search**: Fast full-text search capabilities on indexed files.
*   **Event System**: Built-in publish/subscribe mechanism for file operations.
*   **Cache**: Configurable in-memory cache for improved read performance.
*   **Adapters**: Flexible adapter system to easily extend support for new file formats.

## Installation

```bash
npm install your-package-name # (or simply copy xdFiles.js to your project)
```

## Quick Start

Here's a brief example to get you started with `xdFiles.js`.

```javascript
import xdb from './xdFiles.js'; // Adjust path if installing via npm

(async () => {
  try {
    // 1. Configure the xdFiles system
    await xdb.config({
      basePath: './my-data',       // All files will be stored in the 'my-data' directory
      logLevel: 'INFO',           // Displays informational messages
      cachingEnabled: true,       // Enables in-memory caching for read operations
      versioningEnabled: true,    // Enables file versioning
      indexingEnabled: true       // Enables file content indexing
    });

    console.log('--- xdFiles System Configured ---');

    // 2. Add and Read JSON Data
    const usersCollection = 'users.json';

    // Add a user (ID will be auto-generated)
    const { record: newUser } = await xdb.add.id(usersCollection, { name: 'Alice', email: 'alice@example.com', age: 30 });
    console.log(`Added user: ${newUser.name} (ID: ${newUser.id})`);

    // Add multiple users
    await xdb.add.all(usersCollection, [
      { name: 'Bob', email: 'bob@example.com', age: 25 },
      { name: 'Charlie', email: 'charlie@example.com', age: 35 }
    ], { overwrite: false }); // Do not overwrite existing data
    console.log('Added Bob and Charlie.');

    // Read all users
    const { data: allUsers } = await xdb.view.all(usersCollection);
    console.log('All users:', allUsers);

    // 3. Edit a Record
    await xdb.edit.id(usersCollection, newUser.id, { age: 31, status: 'active' });
    const { record: updatedAlice } = await xdb.view.id(usersCollection, newUser.id);
    console.log('Updated Alice:', updatedAlice);

    // 4. Advanced Query
    const queryResult = await xdb.query()
      .where('age', '>', 30)       // Find users older than 30
      .where('status', '=', 'active')
      .order('name', 'asc')        // Sort by name ascending
      .select(['name', 'age'])     // Select only name and age fields
      .execute(usersCollection);
    console.log('Users matching query:', queryResult.map(r => r.data));

    // 5. Text File Operations
    const logFile = 'app.log';
    await xdb.file.write(logFile, 'Application started.\n');
    await xdb.file.write(logFile, 'New event logged.\n', { append: true }); // Append to file

    const { data: logContent } = await xdb.view.all(logFile);
    console.log(`Content of ${logFile}:\n${logContent}`);

    // 6. Directory Management
    await xdb.dir.add('backups/daily');
    console.log('Created directory: backups/daily');

    await xdb.move.file(usersCollection, 'backups/daily/users_backup.json');
    console.log(`Moved ${usersCollection} to backups/daily/`);

    // 7. Delete Record and Files (optional for cleanup)
    // await xdb.del.id('backups/daily/users_backup.json', updatedAlice.id);
    // console.log(`Deleted Alice from backup.`);

    // await xdb.file.delete(logFile);
    // console.log(`Deleted ${logFile}.`);

    // await xdb.dir.del('backups'); // Deletes the entire 'backups' directory and its content
    // console.log('Deleted backups directory.');

  } catch (error) {
    console.error('An error occurred:', error);
  }
})();
```

## API

`xdFiles.js` exports a default `xdb` object containing all functionalities.

### Configuration

`xdb.config(options: object)`: Sets global library options.

```javascript
await xdb.config({
  basePath: './data',             // String: Base path for all file operations (defaults to script directory).
  logLevel: 'INFO',             // String ('DEBUG', 'INFO', 'WARN', 'ERROR', 'NONE') or Number (LOG_LEVELS constant).
  cachingEnabled: true,         // Boolean: Enables/disables in-memory cache (default: false).
  cacheTTL: 60000,              // Number: Cache Time-To-Live in milliseconds (default: 60000).
  encryptionKey: 'your_secret_key_hex_32_bytes', // String: AES-256 key in HEX format. Set to null to disable encryption.
  compressionEnabled: true,     // Boolean: Enables automatic Gzip compression for data (default: false).
  versioningEnabled: true,      // Boolean: Enables the versioning system (default: false).
  indexingEnabled: true         // Boolean: Enables the indexing and search system (default: false).
});
```

### JSON Data Operations

(Files are always assumed to have a `.json` extension and should contain an array of objects.)

*   `xdb.add.id(filePath: string, newRecord: object)`: Adds a new record to a JSON file. If `newRecord.id` is not provided, a unique ID is generated.
    *   Returns `{ path: string, record: object }`.
*   `xdb.add.all(filePath: string, data: Array<object>, options?: { overwrite: boolean })`: Adds an array of records. Overwrites the file if `overwrite` is `true` (default: `true`).
    *   Returns `{ path: string }`.
*   `xdb.view.id(filePath: string, id: string | number)`: Reads a record from a JSON file by its ID.
    *   Returns `{ path: string, record: object, fromCache?: boolean }`.
*   `xdb.view.all(filePath: string)`: Reads the entire file content.
    *   Returns `{ path: string, data: any }`.
*   `xdb.view.more(filePath: string, options?: object)`: Advanced query for JSON data.
    *   `options.filter: (record) => boolean`: Filtering function.
    *   `options.sort: Array<{ key: string, order: 'asc' | 'desc' }> | { key: string, order: 'asc' | 'desc' }`: Sorting criteria.
    *   `options.skip: number`: Number of records to skip.
    *   `options.limit: number`: Maximum number of records to return.
    *   Returns `{ path: string, data: Array<object>, meta: object }`.
*   `xdb.edit.id(filePath: string, id: string | number, updates: object)`: Updates a record in a JSON file by its ID.
    *   Returns `{ path: string, record: object }`.
*   `xdb.edit.all(filePath: string, newData: Array<object>)`: Replaces the entire JSON file content with a new data array.
    *   Returns `{ path: string }`.
*   `xdb.del.id(filePath: string, id: string | number)`: Deletes a record from a JSON file by its ID.
    *   Returns `{ path: string, deletedId: string }`.
*   `xdb.del.all(filePath: string)`: Deletes all records from a JSON file (the file becomes an empty array `[]`).
    *   Returns `{ path: string }`.

### File Operations

*   `xdb.file.write(filePath: string, data: string | Buffer, options?: { encoding?: string, raw?: boolean, append?: boolean })`: Writes data to a file.
    *   If `raw: true`, data is written directly without adapter processing, ideal for custom formats.
    *   If `append: true`, data is appended to the existing file.
    *   Returns `{ path: string }`.
*   `xdb.file.copy(sourcePath: string, targetPath: string)`: Copies a file.
    *   Returns `{ source: string, target: string }`.
*   `xdb.file.delete(filePath: string)`: Deletes a file.
    *   Returns `{ path: string }`.
*   `xdb.file.stat(filePath: string)`: Returns file statistics (size, dates, MIME type, checksum).
    *   Returns `{ size: number, mimeType: string, checksum: string, ... }`.
*   `xdb.file.descriptor(filePath: string)`: Returns the file descriptor object with its full metadata.
    *   Returns `FileDescriptor` object.
*   `xdb.file.checksum(filePath: string)`: Calculates the SHA256 checksum of a file.
    *   Returns `string`.
*   `xdb.file.chunk(filePath: string, chunkSize: number, processor: (chunk: Buffer, index: number, position: number, totalSize: number) => any)`: Processes a file in chunks. The `processor` can return `false` to stop processing.
    *   Returns `{ chunks: number, totalSize: number }`.
*   `xdb.file.watch(filePath: string, callback: (eventType: 'rename' | 'change' | 'error', filePath: string, descriptor?: object | Error) => void)`: Monitors changes in a file. Returns an `unwatch()` function.

### Directory Management

*   `xdb.dir.add(dirPath: string)`: Creates a directory (recursively).
    *   Returns `{ path: string }`.
*   `xdb.dir.del(dirPath: string)`: Deletes a directory (recursively and forced).
    *   Returns `{ path: string }`.
*   `xdb.dir.rename(oldPath: string, newPath: string)`: Renames a directory.
    *   Returns `{ oldPath: string, newPath: string }`.
*   `xdb.move.file(sourcePath: string, targetPath: string)`: Moves a file.
    *   Returns `{ source: string, target: string }`.

### Streaming

`xdb.stream(filePath: string)`: Returns a stream object.

*   `xdb.stream(filePath).read(options?: object)`: Creates a readable stream for the file.
    *   Returns `ReadableStream`.
*   `xdb.stream(filePath).write(options?: object)`: Creates a writable stream for the file.
    *   Returns `WritableStream` with an additional `waitForFinish(): Promise<void>` method.
*   `xdb.stream.pipe(sourcePath: string, targetPath: string, transform?: Transform)`: Pipes data from a source file to a target file, optionally through a Transform stream.
    *   Returns `{ source: string, target: string }`.

### Advanced Queries (Query Builder)

`xdb.query()`: Returns a Query Builder object.

*   `.where(field: string, operator: string, value: any)`: Adds a condition (`=`, `!=`, `>`, `<`, `>=`, `<=`, `like`, `in`).
*   `.select(fields: string | Array<string>)`: Selects fields to return.
*   `.order(field: string, direction: 'asc' | 'desc')`: Sorts results.
*   `.limit(n: number)`: Limits the number of results.
*   `.offset(n: number)`: Skips a specified number of results.
*   `.execute(filePath?: string)`: Executes the query. If `filePath` is not provided, it searches all indexed files.
    *   Returns `Array<{ file: string, data: object }>`.

### Batch Operations

`xdb.batch()`: Returns a Batch Builder object.

*   `.copy(source: string, target: string)`: Adds a copy operation.
*   `.move(source: string, target: string)`: Adds a move operation.
*   `.delete(path: string)`: Adds a delete operation.
*   `.write(path: string, data: any, options?: object)`: Adds a write operation.
*   `.commit()`: Executes all added operations as a single transaction. In case of an error, all previous operations are rolled back.
    *   Returns `Array<{ operation: object, result?: any, error?: string, success: boolean }>`.

### Encryption & Compression

*   `xdb.crypto.generateKey()`: Generates a new AES-256 encryption key (32 bytes HEX).
    *   Returns `string`.
*   `xdb.crypto.encrypt(data: Buffer | string, key?: string)`: Encrypts data.
    *   Returns `Buffer`.
*   `xdb.crypto.decrypt(encryptedData: Buffer, key?: string)`: Decrypts data.
    *   Returns `Buffer`.
*   `xdb.compress.gzip(data: Buffer | string)`: Gzips data.
    *   Returns `Buffer`.
*   `xdb.compress.gunzip(data: Buffer)`: Decompresses Gzip data.
    *   Returns `Buffer`.

### Versioning

(Requires `versioningEnabled: true` in configuration.)

*   `xdb.version.create(filePath: string)`: Creates a snapshot (version) of the file.
    *   Returns `string` (version ID).
*   `xdb.version.get(filePath: string, versionId: string)`: Retrieves a specific file version.
    *   Returns `{ id: string, timestamp: number, checksum: string, size: number, data: any }`.
*   `xdb.version.list(filePath: string)`: Returns an array of all versions for a given file.
    *   Returns `Array<object>`.

### Indexing & Search

(Requires `indexingEnabled: true` in configuration. Supported by `JSONAdapter` and `TextAdapter`.)

*   `xdb.index.file(filePath: string)`: Indexes the content of a file.
    *   Returns `Array<object>`.
*   `xdb.index.search(query: string, options?: { field?: string, type?: string, exact?: boolean })`: Searches the index.
    *   Returns `Array<{ file: string, matches: Array<object> }>`.
*   `xdb.index.clear()`: Clears the entire in-memory index.

### Event System

*   `xdb.events.on(event: string, handler: Function)`: Subscribes to events (`'write'`, `'delete'`, `'copy'`).
*   `xdb.events.off(event: string, handler: Function)`: Unsubscribes from an event.
*   `xdb.events.emit(event: string, ...args: any[])`: Emits an event (primarily for internal use).

### Cache

*   `xdb.cache.clear()`: Clears the entire in-memory cache.
*   `xdb.cache.invalidate(filePath: string, id?: string | number)`: Invalidates specific cache entries for a file or record.

### Utilities

*   `xdb.utils.generateId(length?: number)`: Generates a unique ID (defaults to 16 characters).
*   `xdb.utils.detectMimeType(filePath: string)`: Detects the MIME type of a file.
*   `xdb.utils.ensureDirectoryExists(dirPath: string)`: Ensures a directory exists, creating it recursively if necessary.

## License

xdFiles.js is MIT licensed.

## Author
Jakub Śledzikowski <jsledzikowski.web@gmail.com>
