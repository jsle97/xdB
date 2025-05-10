# XDB.js

![XDB Banner](https://jsle.eu/xdB/xdb-banner.png)

[![Version](https://img.shields.io/badge/version-6.4.0-blue.svg)](https://github.com/username/xdb.js)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](#dependencies)

## The sophisticated file-based JSON database for Node.js

XDB.js is a lightweight yet powerful database solution that operates on JSON files, providing an elegant alternative to traditional database systems. It combines the simplicity of file-based storage with advanced database features like indexing, relationships, schema validation, and more.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Key Concepts](#key-concepts)
- [Configuration](#configuration)
- [Core API](#core-api)
- [Advanced Features](#advanced-features)
  - [Indexing System](#indexing-system)
  - [Schema Validation](#schema-validation)
  - [Relationship Management](#relationship-management)
  - [Event System](#event-system)
  - [Backup System](#backup-system)
- [Example Applications](#example-applications)
- [Best Practices](#best-practices)
- [API Reference](#api-reference)
- [Comparison with Alternatives](#comparison-with-alternatives)
- [License](#license)

## Overview

XDB.js eliminates the overhead of traditional database systems while delivering many of their powerful features. It's designed for applications where simplicity and minimal setup are priorities, but where data relationships and integrity still matter.

### Key Features

- **Zero Dependencies**: No external libraries required
- **Full CRUD Operations**: Intuitive API for working with JSON data
- **Atomic Operations**: Data integrity through atomic write operations
- **Indexing Engine**: High-performance lookups on indexed fields
- **Schema Validation**: JSON Schema validation for data integrity
- **Relationship Management**: Define and navigate 1:1, 1:N, and N:M relationships
- **Event System**: Hook into the lifecycle of database operations
- **Backup System**: Automatic backups with restoration capabilities
- **Concurrency Control**: File locking to prevent race conditions
- **Advanced Querying**: Filtering, sorting, and pagination
- **Promise-Based API**: Clean async workflows

### When to Use XDB.js

- Building prototypes and MVPs quickly
- Small to medium-sized applications
- Desktop applications with Node.js (Electron, NW.js)
- When setup/configuration time should be minimized
- When data is naturally JSON-structured
- When SQL would be overkill but basic file I/O insufficient

## Installation

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

## Quick Start

```javascript
import xdB from 'xdb';

// Basic configuration
await xdB.config({
  basePath: './data'  // Where your data files will be stored
});

// Create a user
const user = await xdB.add.id('users', {
  name: 'John Doe',
  email: 'john@example.com',
  active: true
});
console.log(`Created user with ID: ${user.record.id}`);

// Retrieve the user
const retrievedUser = await xdB.view.id('users', user.record.id);
console.log('Retrieved user:', retrievedUser.record);

// Update the user
await xdB.edit.id('users', user.record.id, {
  lastLogin: new Date().toISOString()
});

// Find active users
const activeUsers = await xdB.view.more('users', {
  filter: user => user.active === true,
  sort: { key: 'name', order: 'asc' }
});
console.log('Active users:', activeUsers.data);

// Delete the user
await xdB.del.id('users', user.record.id);
```

## Key Concepts

### File-Based Storage

XDB.js stores data in standard JSON files, with each file typically containing an array of record objects. This simple approach provides several benefits:

- **Human-Readable Data**: Easily inspect and edit your data
- **Version Control Friendly**: Track changes with Git or similar tools
- **Zero Configuration**: No server setup or connection strings
- **Portability**: Move your data with simple file operations

### Records and IDs

Every record in XDB.js has a unique identifier in the `id` field:

```javascript
// Adding a record without specifying an ID (auto-generated)
const result = await xdB.add.id('users', {
  name: 'Jane Smith',
  email: 'jane@example.com'
});
console.log(result.record.id); // Auto-generated ID

// Adding a record with a specific ID
await xdB.add.id('users', {
  id: 'user-custom-id-123',
  name: 'Bob Johnson',
  email: 'bob@example.com'
});
```

### Atomic Operations

XDB.js ensures data integrity through atomic operations:

1. Create a temporary file
2. Write the complete data to the temporary file
3. Perform a sync operation to ensure data is on disk
4. Atomically rename the temporary file to the target file

This approach prevents data corruption even during power failures or crashes.

### Concurrency Control

XDB.js implements file locking to prevent race conditions when multiple operations access the same data. The locking mechanism ensures that only one operation can modify a file at a time.

## Configuration

XDB.js offers extensive configuration options:

```javascript
await xdB.config({
  // Basic settings
  basePath: './data',                  // Where data files are stored
  logLevel: 'INFO',                    // DEBUG, INFO, WARN, ERROR, NONE
  
  // Caching settings
  cachingEnabled: true,                // Enable in-memory caching
  cacheTTL: 60000,                     // Cache time-to-live in milliseconds
  
  // Backup settings
  enableBackup: true,                  // Enable automatic backups
  backupExtension: '.bak',             // Backup file extension
  backupOnWriteOnly: true,             // Create backups only during writes
  backupOnAdd: false,                  // Create backups before adds
  backupOnEdit: false,                 // Create backups before edits
  backupOnDelete: false,               // Create backups before deletes
  
  // Indexing settings
  indexes: {
    'users.json': ['email', 'role'],   // Fields to index for faster queries
    'posts.json': ['authorId', 'slug']
  },
  
  // Schema validation
  enableSchemaValidation: true,        // Enable JSON Schema validation
  schemas: {
    'users.json': {
      type: 'object',
      required: ['name', 'email'],
      properties: {
        id: { type: 'string' },
        name: { type: 'string', minLength: 2 },
        email: { type: 'string', format: 'email' },
        active: { type: 'boolean', default: true }
      }
    }
  },
  
  // Relation settings
  enableRelationCache: true,           // Cache relationship results
  relationCacheTTL: 300000             // Relation cache TTL (5 minutes)
});
```

## Core API

XDB.js provides a clean, intuitive API organized by operation type:

### Directory Operations

```javascript
// Create a directory
await xdB.dir.add('blog/posts');

// Rename a directory
await xdB.dir.rename('blog/posts', 'blog/articles');

// Delete a directory
await xdB.dir.del('blog/articles');
```

### File Operations

```javascript
// Move/rename a file
await xdB.move.file('users.json', 'archive/users.json');
```

### Adding Data

```javascript
// Add a single record (auto-generates ID)
const result = await xdB.add.id('users', {
  name: 'John Doe',
  email: 'john@example.com'
});
const userId = result.record.id;

// Add multiple records (create or overwrite file)
await xdB.add.all('users', [
  { name: 'John Doe', email: 'john@example.com' },
  { name: 'Jane Smith', email: 'jane@example.com' }
]);
```

### Viewing Data

```javascript
// Get all records
const result = await xdB.view.all('users');
const allUsers = result.data;

// Get a specific record by ID
const result = await xdB.view.id('users', userId);
const user = result.record;

// Advanced query with filtering, sorting, and pagination
const result = await xdB.view.more('users', {
  filter: user => user.active && user.role === 'admin',
  sort: [
    { key: 'lastLogin', order: 'desc' },
    { key: 'name', order: 'asc' }
  ],
  skip: 0,
  limit: 10
});
const filteredUsers = result.data;
console.log(`Showing ${filteredUsers.length} of ${result.meta.total} results`);
```

### Editing Data

```javascript
// Edit a specific record by ID
await xdB.edit.id('users', userId, {
  lastLogin: new Date().toISOString(),
  loginCount: user.loginCount + 1
});

// Replace all records in a file
await xdB.edit.all('users', newUsersList);
```

### Deleting Data

```javascript
// Delete a specific record by ID
await xdB.del.id('users', userId);

// Delete all records (empty the file)
await xdB.del.all('users');
```

## Advanced Features

### Indexing System

XDB.js includes a sophisticated indexing system that significantly accelerates lookups:

```javascript
// Configure indexes
await xdB.config({
  indexes: {
    'users.json': ['email', 'role'],
    'posts.json': ['authorId', 'slug', 'publishedStatus']
  }
});

// Query using an indexed field (very fast)
const user = await xdB.query('users', 'email', 'john@example.com');
const adminUsers = await xdB.query('users', 'role', 'admin');
const draftPosts = await xdB.query('posts', 'publishedStatus', 'draft');
```

How indexing works:
1. For each indexed field, XDB.js maintains a separate index file mapping field values to record IDs
2. When records are added, edited, or deleted, indexes are automatically updated
3. Queries using `xdB.query()` utilize these indexes for fast lookups without scanning entire files

### Schema Validation

XDB.js provides robust data validation using JSON Schema:

```javascript
// Configure schemas
await xdB.config({
  enableSchemaValidation: true,
  schemas: {
    'users.json': {
      type: 'object',
      required: ['name', 'email'],
      properties: {
        id: { type: 'string' },
        name: { type: 'string', minLength: 2 },
        email: { type: 'string', format: 'email' },
        age: { type: 'integer', minimum: 0 },
        role: { type: 'string', enum: ['user', 'admin', 'guest'] },
        metadata: { type: 'object' }
      }
    }
  }
});

// This will fail validation
try {
  await xdB.add.id('users', {
    name: 'X', // Too short (minLength: 2)
    email: 'not-an-email',
    age: -5 // Below minimum (minimum: 0)
  });
} catch (error) {
  console.error('Validation error:', error.message);
}
```

### Relationship Management

XDB.js includes a powerful relationship system:

```javascript
// Define a one-to-many relationship (user -> posts)
xdB.relations.define('userPosts', {
  type: '1:N',
  localFile: 'users.json',
  localField: 'id',
  foreignFile: 'posts.json',
  foreignField: 'userId',
  onDelete: 'CASCADE' // Delete posts when user is deleted
});

// Define a many-to-many relationship (posts <-> tags)
xdB.relations.define('postTags', {
  type: 'N:M',
  localFile: 'posts.json',
  localField: 'id',
  foreignFile: 'tags.json',
  foreignField: 'id',
  junctionFile: 'post_tags.json',
  junctionLocalField: 'postId',
  junctionForeignField: 'tagId',
  onDelete: 'CASCADE'
});

// Get related data
const userPosts = await xdB.relations.getRelated('userPosts', userId);
const postTags = await xdB.relations.getRelated('postTags', postId);

// Include related data in query results
const result = await xdB.view.more('posts', {
  filter: post => post.published === true,
  include: ['postTags'], // Includes tags for each post
  includeStrategy: 'eager' // 'eager' or 'lazy'
});
```

Deletion strategies:
- **CASCADE**: Delete related records (or junction entries for N:M)
- **SET_NULL**: Set foreign key to null in related records
- **RESTRICT**: Prevent deletion if related records exist

### Event System

XDB.js provides an event system for extending functionality:

```javascript
// Add timestamps to records before they're added
xdB.on('beforeAddId', (data) => {
  data.newRecord.createdAt = new Date().toISOString();
});

// Log after records are updated
xdB.on('afterEditId', (data) => {
  console.log(`Record ${data.id} updated in ${data.filePath}`);
});

// Send notifications for deletions
xdB.on('afterDeleteId', (data) => {
  notifyAdministrator(`Record ${data.deletedId} deleted from ${data.filePath}`);
});

// Handle errors
xdB.on('errorDeleteId', (data) => {
  console.error(`Failed to delete record ${data.id}:`, data.error);
});

// Remove a listener
xdB.off('afterEditId', myLogFunction);
```

Available event names follow this pattern:
- `before<Operation>`: Fired before an operation
- `after<Operation>`: Fired after a successful operation
- `error<Operation>`: Fired when an operation fails

### Backup System

XDB.js includes an automatic backup system:

```javascript
// Configure backups
await xdB.config({
  enableBackup: true,
  backupExtension: '.bak',
  backupOnWriteOnly: false,
  backupOnAdd: true,
  backupOnEdit: true,
  backupOnDelete: true
});

// Restore from backup
try {
  await xdB.utils.restoreFromBackup('users.json');
  console.log('Successfully restored users.json from backup');
} catch (error) {
  console.error('Backup restoration failed:', error.message);
}

// Verify data integrity
const inconsistencies = await xdB.utils.verifyRelations();
if (inconsistencies.length > 0) {
  console.warn('Detected inconsistencies:', inconsistencies);
}
```

## Example Applications

### Blog System

```javascript
// Define schemas
await xdB.config({
  schemas: {
    'users.json': {
      type: 'object',
      required: ['name', 'email'],
      properties: {
        name: { type: 'string' },
        email: { type: 'string', format: 'email' },
        bio: { type: 'string' }
      }
    },
    'posts.json': {
      type: 'object',
      required: ['title', 'content', 'authorId'],
      properties: {
        title: { type: 'string' },
        content: { type: 'string' },
        authorId: { type: 'string' },
        slug: { type: 'string', pattern: '^[a-z0-9-]+$' },
        published: { type: 'boolean', default: false },
        publishDate: { type: 'string', format: 'date-time' }
      }
    },
    'comments.json': {
      type: 'object',
      required: ['postId', 'content'],
      properties: {
        postId: { type: 'string' },
        authorId: { type: 'string' },
        content: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' }
      }
    }
  },
  indexes: {
    'users.json': ['email'],
    'posts.json': ['authorId', 'slug', 'published'],
    'comments.json': ['postId', 'authorId']
  }
});

// Define relationships
xdB.relations.define('userPosts', {
  type: '1:N',
  localFile: 'users.json',
  localField: 'id',
  foreignFile: 'posts.json',
  foreignField: 'authorId',
  onDelete: 'CASCADE'
});

xdB.relations.define('postComments', {
  type: '1:N',
  localFile: 'posts.json',
  localField: 'id',
  foreignFile: 'comments.json',
  foreignField: 'postId',
  onDelete: 'CASCADE'
});

// Create a blog post
const author = await xdB.add.id('users', {
  name: 'John Doe',
  email: 'john@example.com',
  bio: 'Passionate writer and developer'
});

const post = await xdB.add.id('posts', {
  title: 'Getting Started with XDB.js',
  content: '# Introduction\n\nXDB.js is a powerful JSON database...',
  authorId: author.record.id,
  slug: 'getting-started-with-xdb',
  published: true,
  publishDate: new Date().toISOString()
});

// Add a comment
await xdB.add.id('comments', {
  postId: post.record.id,
  authorId: author.record.id,
  content: 'This is a self-comment!',
  createdAt: new Date().toISOString()
});

// Get a post with author and comments
const postResult = await xdB.view.id('posts', post.record.id);
const postWithDetails = {
  ...postResult.record,
  author: (await xdB.view.id('users', postResult.record.authorId)).record,
  comments: (await xdB.view.more('comments', {
    filter: comment => comment.postId === postResult.record.id,
    sort: { key: 'createdAt', order: 'desc' }
  })).data
};

console.log('Post with details:', postWithDetails);
```

### User Authentication System

```javascript
import crypto from 'crypto';
import bcrypt from 'bcrypt';

// Configure schemas
await xdB.config({
  schemas: {
    'users.json': {
      type: 'object',
      required: ['email', 'passwordHash'],
      properties: {
        email: { type: 'string', format: 'email' },
        passwordHash: { type: 'string' },
        role: { type: 'string', enum: ['user', 'admin'], default: 'user' },
        active: { type: 'boolean', default: true },
        lastLogin: { type: 'string', format: 'date-time' }
      }
    },
    'sessions.json': {
      type: 'object',
      required: ['userId', 'token', 'expires'],
      properties: {
        userId: { type: 'string' },
        token: { type: 'string' },
        expires: { type: 'string', format: 'date-time' },
        userAgent: { type: 'string' }
      }
    }
  },
  indexes: {
    'users.json': ['email'],
    'sessions.json': ['token', 'userId']
  }
});

// User registration
async function registerUser(email, password) {
  // Check if email exists
  const existingUsers = await xdB.query('users', 'email', email);
  if (existingUsers.length > 0) {
    throw new Error('Email already registered');
  }
  
  // Hash password and create user
  const passwordHash = await bcrypt.hash(password, 10);
  return await xdB.add.id('users', {
    email,
    passwordHash,
    role: 'user',
    active: true
  });
}

// User login
async function loginUser(email, password) {
  // Find user by email
  const users = await xdB.query('users', 'email', email);
  if (users.length === 0) {
    throw new Error('Invalid email or password');
  }
  
  const user = users[0];
  
  // Verify password
  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    throw new Error('Invalid email or password');
  }
  
  // Create session
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  
  await xdB.add.id('sessions', {
    userId: user.id,
    token,
    expires: expires.toISOString(),
    userAgent: 'User Agent String Here'
  });
  
  // Update last login
  await xdB.edit.id('users', user.id, {
    lastLogin: new Date().toISOString()
  });
  
  return { user, token, expires };
}

// Clean up expired sessions
async function cleanupExpiredSessions() {
  const now = new Date().toISOString();
  const allSessions = await xdB.view.all('sessions');
  
  const expiredSessions = allSessions.data.filter(
    session => session.expires < now
  );
  
  for (const session of expiredSessions) {
    await xdB.del.id('sessions', session.id);
  }
  
  console.log(`Cleaned up ${expiredSessions.length} expired sessions`);
}

// Demo usage
const user = await registerUser('test@example.com', 'password123');
const { token } = await loginUser('test@example.com', 'password123');
```

## Best Practices

### Data Organization

1. **Structure Your Files Logically**
   ```
   /data
     /users.json       # User records
     /posts.json       # Blog posts
     /comments.json    # Comments on posts
     /relations
       /post_tags.json # Junction table for posts<->tags
   ```

2. **Keep Files Manageable**
   - Aim to keep individual files under 10MB for optimal performance
   - Consider splitting large collections into multiple files when possible

3. **Use Meaningful Record IDs**
   - Auto-generated IDs are good for most cases
   - Consider semantic IDs for special use cases (e.g., `user-john-doe`)

### Performance Optimization

1. **Use Indexing Strategically**
   - Index fields used for frequent lookups
   - Avoid over-indexing; each index increases write overhead

2. **Optimize Query Patterns**
   - Use `query()` instead of `view.more()` for indexed fields
   - Use the caching system for read-heavy workloads

3. **Batch Operations When Possible**
   - Use `add.all()` and `edit.all()` for bulk operations
   - Minimize the number of write operations

### Data Integrity

1. **Use Schema Validation**
   - Define schemas for critical data structures
   - Validate input data before it reaches the database

2. **Use Relationships Properly**
   - Define relationships to maintain referential integrity
   - Choose appropriate onDelete strategies

3. **Implement Transaction-Like Flows**
   - For operations spanning multiple files, use careful error handling
   - Consider implementing rollback mechanisms for critical operations

## API Reference

### Configuration

```typescript
interface XdbConfig {
  basePath?: string;                    // Base directory for data files
  logLevel?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'NONE' | number;
  logFilePath?: string | null;          // Path for log file
  
  // Caching
  cachingEnabled?: boolean;             // Enable data caching
  cacheTTL?: number;                    // Cache time-to-live (ms)
  
  // Backup
  enableBackup?: boolean;               // Enable automatic backups
  backupExtension?: string;             // Backup file extension
  backupOnWriteOnly?: boolean;          // Backup only during writes
  backupOnAdd?: boolean;                // Backup before add operations
  backupOnEdit?: boolean;               // Backup before edit operations
  backupOnDelete?: boolean;             // Backup before delete operations
  
  // Indexing
  indexes?: Record<string, string[]>;   // File paths -> indexed fields
  
  // Schema validation
  enableSchemaValidation?: boolean;     // Enable JSON Schema validation
  schemas?: Record<string, any>;        // File paths -> JSON schemas
  
  // Relations
  enableRelationCache?: boolean;        // Cache relation query results
  relationCacheTTL?: number;            // Relation cache TTL (ms)
}

function config(options: XdbConfig): Promise<void>;
```

### Directory Operations

```typescript
namespace dir {
  function add(dirPath: string): Promise<{ path: string }>;
  function del(dirPath: string): Promise<{ path: string }>;
  function rename(oldPath: string, newPath: string): Promise<{ oldPath: string, newPath: string }>;
}
```

### File Operations

```typescript
namespace move {
  function file(sourcePath: string, targetPath: string): Promise<{ source: string, target: string }>;
}
```

### Data Operations

```typescript
namespace add {
  function all(filePath: string, initialData: any[] | object, options?: { overwrite: boolean }): Promise<{ path: string }>;
  function id(filePath: string, newRecord: object): Promise<{ path: string, record: object }>;
}

namespace view {
  function all(filePath: string): Promise<{ path: string, data: any[] }>;
  function id(filePath: string, id: string): Promise<{ path: string, record: object }>;
  function more(filePath: string, options?: {
    filter?: (record: any) => boolean,
    sort?: SortCriterion | SortCriterion[],
    skip?: number,
    limit?: number,
    include?: string[],
    includeStrategy?: 'eager' | 'lazy'
  }): Promise<{ path: string, data: any[], meta: PaginationInfo }>;
}

namespace edit {
  function all(filePath: string, newData: any[]): Promise<{ path: string }>;
  function id(filePath: string, id: string, newRecordData: object): Promise<{ path: string, record: object }>;
}

namespace del {
  function all(filePath: string): Promise<{ path: string }>;
  function id(filePath: string, id: string): Promise<{ path: string, deletedId: string }>;
}
```

### Advanced Operations

```typescript
function query(filePath: string, fieldName: string, fieldValue: any): Promise<any[]>;

namespace relations {
  function define(name: string, config: RelationConfig): void;
  function remove(name: string): void;
  function getRelated(relationName: string, localId: string): Promise<any | any[]>;
}

namespace utils {
  function restoreFromBackup(filePath: string): Promise<{ path: string, restoredFrom: string }>;
  function verifyRelations(): Promise<Inconsistency[]>;
}

// Event system
function on(eventName: string, listener: (data: any) => void): void;
function off(eventName: string, listener: (data: any) => void): void;
```

### Lightweight JSON Database Comparison

| Feature | XDB.js | lowdb | json-db | NeDB | json-storage | unqlite |
|---------|:------:|:-----:|:-------:|:----:|:------------:|:-------:|
| **Setup Simplicity** | ★★★★★ | ★★★★☆ | ★★★★☆ | ★★★★☆ | ★★★★★ | ★★★☆☆ |
| **Zero Dependencies** | ★★★★★ | ★★★☆☆ | ★★☆☆☆ | ★★★☆☆ | ★★★★☆ | ★★★☆☆ |
| **File-Based Storage** | ★★★★★ | ★★★★★ | ★★★★★ | ★★★★☆ | ★★★★★ | ★★★★★ |
| **Atomic Operations** | ★★★★★ | ★★☆☆☆ | ★★★☆☆ | ★★★☆☆ | ★★☆☆☆ | ★★★★☆ |
| **Schema Validation** | ★★★★☆ | ★☆☆☆☆ | ★★☆☆☆ | ★☆☆☆☆ | ★☆☆☆☆ | ☆☆☆☆☆ |
| **Relationship Management** | ★★★★☆ | ☆☆☆☆☆ | ★☆☆☆☆ | ★☆☆☆☆ | ☆☆☆☆☆ | ☆☆☆☆☆ |
| **Indexing System** | ★★★★☆ | ☆☆☆☆☆ | ★☆☆☆☆ | ★★★☆☆ | ☆☆☆☆☆ | ★★☆☆☆ |
| **Query Capabilities** | ★★★★☆ | ★★☆☆☆ | ★★★☆☆ | ★★★★☆ | ★★☆☆☆ | ★★☆☆☆ |
| **Performance (Small Data)** | ★★★★☆ | ★★★★★ | ★★★★☆ | ★★★★☆ | ★★★★★ | ★★★★☆ |
| **Performance (Medium Data)** | ★★★★☆ | ★★★☆☆ | ★★★☆☆ | ★★★☆☆ | ★★☆☆☆ | ★★★☆☆ |
| **Performance (Large Data)** | ★★★☆☆ | ★☆☆☆☆ | ★★☆☆☆ | ★★★☆☆ | ★☆☆☆☆ | ★★★☆☆ |
| **Concurrency Control** | ★★★★☆ | ★☆☆☆☆ | ★★☆☆☆ | ★★★☆☆ | ★☆☆☆☆ | ★★★☆☆ |
| **Event System** | ★★★★★ | ☆☆☆☆☆ | ★☆☆☆☆ | ★☆☆☆☆ | ☆☆☆☆☆ | ☆☆☆☆☆ |
| **Backup Capabilities** | ★★★★☆ | ☆☆☆☆☆ | ★☆☆☆☆ | ☆☆☆☆☆ | ☆☆☆☆☆ | ★☆☆☆☆ |
| **Documentation** | ★★★★★ | ★★★★☆ | ★★★☆☆ | ★★★★☆ | ★★☆☆☆ | ★★★☆☆ |
| **Community Support** | ☆☆☆☆☆ (only me xd) | ★★★★☆ | ★★★☆☆ | ★★★★☆ | ★★☆☆☆ | ★★☆☆☆ |
| **Active Development** | ★★★★★ | ★★★☆☆ | ★★★☆☆ | ★★☆☆☆ | ★★☆☆☆ | ★★☆☆☆ |

### Comparison with Traditional Database Systems

| Feature | XDB.js | SQLite | MongoDB |
|---------|:------:|:------:|:-------:|
| **Setup Complexity** | ★☆☆☆☆ | ★★★☆☆ | ★★★★☆ |
| **Learning Curve** | ★☆☆☆☆ | ★★★☆☆ | ★★★☆☆ |
| **Schema Flexibility** | ★★★★★ | ★★☆☆☆ | ★★★★☆ |
| **Relationship Management** | ★★★☆☆ | ★★★★★ | ★★★☆☆ |
| **Indexing & Performance** | ★★★☆☆ | ★★★★☆ | ★★★★★ |
| **Querying Power** | ★★★☆☆ | ★★★★★ | ★★★★★ |
| **Scalability** | ★★☆☆☆ | ★★★☆☆ | ★★★★★ |
| **Use Case Alignment** | ★★★★★ | ★★★★☆ | ★★★☆☆ |

## License

XDB.js is released under the MIT License.

```
MIT License

Copyright (c) 2025 Jakub Śledzikowski

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
