# xdB: File Management Library Collection for Node.js

![XDB Banner](https://jsle.eu/xdb-baner2.png)
 
**Version:** 1.0.0 | **License:** MIT | **Node.js:** ≥18.0.0 | **Zero Dependencies:** Yes!

## 🚀 Discover the Power of Choice

xdB is a comprehensive collection of file and data management libraries for Node.js, designed to give you the perfect tool for every project need. From simple JSON databases to complete file management systems, choose the library that fits your requirements exactly – no bloat, no complexity you don't need.

**Why choose xdB?** Because one size doesn't fit all. Whether you're building a quick prototype, a desktop application, or a complex data management system, we have the right tool for your specific use case.

---

## 📚 Choose Your Perfect Tool

### 🗃️ **xdFiles.js** - Complete File Management System
**The powerhouse** for comprehensive file operations and data management.

- **Full file system operations** (read, write, copy, move, stream)
- **Advanced JSON database** with all premium features
- **File streaming** for large files
- **Encryption & compression** support
- **File adapters** for different formats (JSON, text, binary)
- **Event system** with hooks and watchers
- **Backup & versioning** system

**Perfect for:** Desktop applications, file processing systems, content management, data pipelines

---

### 🔗 **xdb.js** - Advanced JSON Database  
**The complete database** with enterprise features.

- **Full CRUD operations** with atomic writes
- **Relationship management** (1:1, 1:N, N:M) with onDelete strategies
- **Indexing engine** for fast queries
- **Schema validation** with JSON Schema
- **Backup system** with restore capabilities
- **Event system** for operation lifecycle hooks
- **Relation cache** with TTL

**Perfect for:** Complex applications, data with relationships, systems requiring validation

---

### ⚡ **xdbLite.js** - Balanced Solution
**The golden middle** - powerful yet simple.

- **Essential CRUD operations** with file locking
- **Caching system** for improved performance  
- **Directory management** utilities
- **File operations** (move, copy)
- **Advanced querying** with filtering and sorting
- **Configurable logging** system

**Perfect for:** Medium applications, rapid prototyping, desktop apps, when you need more than nano but less than full

---

### 🎯 **xdbNano.js** - Minimalist Engine
**The lightweight champion** for simple needs.

- **Pure CRUD operations** only
- **Minimal footprint** and maximum speed
- **File locking** for data integrity
- **Zero configuration** required

**Perfect for:** Microservices, simple storage needs, embedded applications, when simplicity is key

---

### 🔄 **xdbLiteRelations.js** - Relations Extension
**Add relationships** to your xdbLite setup.

- **One-to-many relationships** with caching
- **Many-to-many relationships** via junction tables
- **Cascade operations** and integrity checks
- **Relation cache** for performance

**Perfect for:** Extending xdbLite when you need relationships but want to keep it lightweight

---

## 🎯 When to Use Each Library

### Choose **xdFiles** when you need:
- Complete file management capabilities
- File streaming and processing
- Multiple file format support
- Desktop applications with file operations
- Content management systems
- Data transformation pipelines

### Choose **xdb** when you need:
- Complex data relationships
- Schema validation and data integrity
- Advanced querying and indexing
- Enterprise-level features
- Backup and recovery systems
- Event-driven architectures

### Choose **xdbLite** when you need:
- Solid CRUD with some extras
- File and directory management
- Caching for better performance
- Medium complexity applications
- Balance between features and simplicity

### Choose **xdbNano** when you need:
- Pure simplicity and speed
- Minimal resource usage
- Quick prototypes
- Embedded storage
- Microservices with simple data needs

### Choose **xdbLiteRelations** when you need:
- xdbLite + relationship capabilities
- Lightweight but connected data
- Performance-focused relations

---

## 🚀 Quick Start Examples

### xdFiles.js - File Management System
```javascript
import xdb from './xdFiles/xdFiles.js';

// Configure the system
await xdb.config({
  basePath: './data',
  cachingEnabled: true,
  versioningEnabled: true,
  indexingEnabled: true
});

// File operations
await xdb.file.write('document.txt', 'Hello World');
const content = await xdb.view.all('document.txt');

// JSON database operations  
await xdb.add.id('users.json', { name: 'Alice', email: 'alice@example.com' });
const user = await xdb.view.id('users.json', userId);

// File streaming
const readStream = await xdb.stream('large-file.json').read();
const writeStream = await xdb.stream('output.json').write();
```

### xdb.js - Advanced Database
```javascript
import xdb from './xdb-full/xdb.js';

// Configure with relations and schemas
await xdb.config({
  basePath: './database',
  enableSchemaValidation: true,
  schemas: {
    'users.json': { /* JSON Schema */ }
  }
});

// Define relationships
xdb.relations.define('userPosts', {
  type: '1:N',
  localFile: 'users.json',
  foreignFile: 'posts.json',
  localField: 'id',
  foreignField: 'authorId',
  onDelete: 'CASCADE'
});

// CRUD with relations
const user = await xdb.add.id('users', { name: 'Bob' });
await xdb.add.id('posts', { title: 'My Post', authorId: user.record.id });
const userPosts = await xdb.relations.getRelated('userPosts', user.record.id);
```

### xdbLite.js - Balanced Solution
```javascript
import xdbLite from './xdb-another-versions/xdbLite.js';

// Quick configuration
await xdbLite.config({ 
  basePath: './data', 
  cachingEnabled: true 
});

// Essential operations
await xdbLite.add.all('products', [
  { name: 'Product 1', price: 100 },
  { name: 'Product 2', price: 200 }
]);

// Advanced querying
const expensive = await xdbLite.view.more('products', {
  filter: product => product.price > 150,
  sort: [{ key: 'price', order: 'desc' }],
  limit: 10
});
```

### xdbNano.js - Minimalist Engine
```javascript
import xdbNano from './xdb-another-versions/xdbNano.js';

// Zero configuration needed
xdbNano.setBasePath('./simple-data');

// Pure CRUD operations
const note = await xdbNano.add.id('notes', { text: 'Quick note' });
await xdbNano.edit.id('notes', note.id, { text: 'Updated note' });
const allNotes = await xdbNano.view.all('notes');
await xdbNano.del.id('notes', note.id);
```

### xdbLiteRelations.js - Relations Extension
```javascript
import xdbLite from './xdb-another-versions/xdbLite.js';
import relations from './xdb-another-versions/xdbLiteRelations.js';

// Setup base + relations
await xdbLite.config({ basePath: './data' });

// Create one-to-many relationship
await relations.createOneToMany({
  fromCollection: 'users',
  fromId: 'user123',
  toCollection: 'orders',
  toField: 'userId',
  toIds: ['order1', 'order2']
});

// Get related data
const userOrders = await relations.getRelated({
  fromCollection: 'users',
  fromId: 'user123',
  toCollection: 'orders',
  toField: 'userId'
});
```

---

## 📊 Library Comparison Matrix

| Feature | xdFiles | xdb | xdbLite | xdbNano | Relations Extension |
|---------|:-------:|:---:|:-------:|:-------:|:------------------:|
| **Core CRUD** | ✅ | ✅ | ✅ | ✅ | - |
| **File Operations** | ✅ | ❌ | ✅ | ❌ | - |
| **File Streaming** | ✅ | ❌ | ❌ | ❌ | - |
| **Relationships** | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Indexing** | ✅ | ✅ | ❌ | ❌ | - |
| **Schema Validation** | ✅ | ✅ | ❌ | ❌ | - |
| **Caching** | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Event System** | ✅ | ✅ | ❌ | ❌ | - |
| **Backup/Versioning** | ✅ | ✅ | ❌ | ❌ | - |
| **Encryption** | ✅ | ❌ | ❌ | ❌ | - |
| **Bundle Size** | Large | Medium | Small | Tiny | Tiny |
| **Complexity** | High | Medium | Low | Minimal | Low |

---

## 🆚 Comparison with Alternatives

### Lightweight JSON Database Comparison

| Feature | xdB Family | lowdb | json-db | NeDB |
|---------|:----------:|:-----:|:-------:|:----:|
| Installation | ★★★★★ | ★★★★☆ | ★★★★☆ | ★★☆☆☆ |
| Configuration | ★★★★★ | ★★★★☆ | ★★★★☆ | ★★★☆☆ |
| API Intuitiveness | ★★★★★ | ★★★★★ | ★★★★☆ | ★★★☆☆ |
| Zero Dependencies | ★★★★★ | ★★★☆☆ | ★★☆☆☆ | ★★★☆☆ |
| File Storage Structure | ★★★★★ | ★★★★★ | ★★★★★ | ★★★☆☆ |
| Atomic Operations | ★★★★★ | ★★☆☆☆ | ★★★☆☆ | ★★★☆☆ |
| Schema Validation | ★★★★☆ | ★☆☆☆☆ | ★★☆☆☆ | ★☆☆☆☆ |
| Relationship Management | ★★★★☆ | ☆☆☆☆☆ | ★☆☆☆☆ | ☆☆☆☆☆ |
| File Management | ★★★★★ | ☆☆☆☆☆ | ☆☆☆☆☆ | ☆☆☆☆☆ |
| Read Performance (<1MB) | ★★★★☆ | ★★★★★ | ★★★★☆ | ★★★☆☆ |
| Write Performance (<1MB) | ★★★★☆ | ★★★★★ | ★★★★☆ | ★★★☆☆ |
| Backup Options | ★★★★☆ | ☆☆☆☆☆ | ☆☆☆☆☆ | ☆☆☆☆☆ |
| Documentation Quality | ★★★★★ | ★★★★☆ | ★★★☆☆ | ★★☆☆☆ |

### Comparison with Traditional Databases

| Feature | xdB Family | SQLite | MongoDB |
|---------|:----------:|:------:|:-------:|
| Setup Complexity | ★☆☆☆☆ | ★★★☆☆ | ★★★★☆ |
| Schema Flexibility | ★★★★★ | ★★☆☆☆ | ★★★★☆ |
| Relationship Management | ★★★☆☆ | ★★★★★ | ★★★☆☆ |
| Indexing and Performance | ★★★☆☆ | ★★★★☆ | ★★★★★ |
| Scalability | ★★☆☆☆ | ★★★☆☆ | ★★★★★ |
| Node.js Usability | ★★★★★ | ★★★★☆ | ★★★☆☆ |
| File Management | ★★★★★ | ☆☆☆☆☆ | ☆☆☆☆☆ |

---

## 📁 Repository Structure

```
xdB/
├── xdFiles/                    # Complete file management system
│   ├── xdFiles.js             # Main library
│   └── README.md              # Detailed documentation
├── xdb-full/                   # Advanced JSON database
│   ├── xdb.js                 # Main library  
│   ├── tech-doc.md            # Technical documentation
│   └── README.md              # User guide
├── xdb-another-versions/       # Lightweight alternatives
│   ├── xdbLite.js             # Balanced solution
│   ├── xdbNano.js             # Minimalist engine
│   ├── xdbLiteRelations.js    # Relations extension
│   └── README.md              # Usage guide
└── README.md                   # This file
```

---

## 🏆 Why xdB is the Right Choice

**🎯 Perfect Fit:** Choose exactly what you need - no more, no less  
**🚀 Zero Dependencies:** All libraries work independently without external packages  
**⚡ Performance Focused:** Optimized for Node.js with atomic operations and file locking  
**📚 Well Documented:** Comprehensive documentation for every library  
**🔧 Battle Tested:** Used in production applications and desktop software  
**🆓 Open Source:** MIT licensed - free to use, modify, and distribute  

Experience a significant boost in productivity with the right tool for your project!

---

## 🤝 Join the Community

xdB is more than just a tool collection; it represents a forward-thinking approach to file and data management. Join the community and discover the ease of creating powerful applications with the perfect library for your needs.

**Contributors welcome!** Whether you're fixing bugs, adding features, or improving documentation - every contribution makes xdB better for everyone.

---

## 📄 License

xdB is released under the MIT License.

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

---

**Author:** Jakub Śledzikowski  
**Email:** jsledzikowski.web@gmail.com  
**Website:** [jsle.eu](https://jsle.eu)
