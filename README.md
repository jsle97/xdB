#   XDB.js: A Powerful and Lightweight JSON Database for Node.js! ![XDB Banner](https://jsle.eu/xdB/xdb-banner.png)

**Version:** 6.4.0 | **License:** MIT | **Node.js:** ≥18.0.0 | **Zero Dependencies:** Yes!

##   Discover the Power of Simplicity

XDB.js is a powerful yet lightweight JSON-based database system for Node.js that simplifies data management by reducing the complexity of traditional databases. Imagine building applications without the overhead of servers, complex connections, or lengthy setup processes. XDB.js combines the ease of file-based storage with robust features such as indexing, relationships, schema validation, and more, enabling faster, safer, and more manageable projects. It's an ideal choice for developers who want to focus on development rather than database administration.

##   Why XDB.js is a Great Choice

XDB.js eliminates the bloat of conventional databases while providing essential features. Designed for applications where speed and minimal setup are crucial, yet data integrity and relationships are still important, it offers a streamlined approach to data storage. Your data is stored in easily readable JSON files, allowing for straightforward inspection, editing, and change tracking, similar to working with regular text files.

###   Key Features

* **Zero Dependencies:** Operates independently without reliance on external libraries.
* **Full CRUD Operations:** Provides an intuitive interface for efficient JSON data handling.
* **Atomic Operations:** Ensures data integrity even in the event of failures.
* **Indexing Engine:** Enables rapid data searches, boosting application performance.
* **Schema Validation:** Maintains data consistency with built-in JSON schema validation.
* **Relationship Management:** Simplifies the definition and management of 1:1, 1:N, and N:M relationships.
* **Event System:** Allows integration with operation lifecycles for custom logic and automation.
* **Backup System:** Offers automatic backups and recovery for data safety.
* **Concurrency Control:** Prevents conflicts through file locking, ensuring smooth operation.
* **Advanced Querying:** Facilitates easy filtering, sorting, and pagination.
* **Promise-Based API:** Supports clean, asynchronous workflows for improved coding efficiency.

###   When to Use XDB.js

XDB.js is particularly well-suited for:

* Rapid prototyping and MVPs where speed is essential.
* Small to medium-sized applications requiring robust functionality without excessive complexity.
* Node.js desktop applications, such as those built with Electron or NW.js.
* Projects where minimal configuration is desired.
* Applications with naturally JSON-structured data.
* Situations where SQL databases are too cumbersome and basic file I/O is insufficient.

Experience a significant boost in productivity!

##   Getting Started

XDB.js is easy to integrate into your projects. Simply download and incorporate it to begin building immediately. Configuration is straightforward, involving setting basic options like data file paths, logging levels, and indexing settings.

##   Core Concepts

XDB.js stores data in standard JSON files, enhancing readability and ease of use. Each record is assigned a unique ID, and operations are atomic to guarantee data integrity. Concurrency control, using file locking, ensures stable performance in multi-threaded environments.

##   Advanced Capabilities

XDB.js provides advanced tools to enhance your applications, from a powerful indexing system for fast searches to schema validation for maintaining data integrity. Relationship management simplifies the navigation of data connections, while the event system allows for dynamic functionality extensions. Background backups protect your data from unexpected events.

##   Example Applications

Consider building a comprehensive blog system with users, posts, and comments, all seamlessly integrated, secure, and scalable. Or imagine developing an authentication system with smooth registration, login, and session management. XDB.js makes such projects not only feasible but also enjoyable!

##   Best Practices

For optimal results with XDB.js, organize your data logically, utilize indexing to enhance performance, and ensure data integrity through validation. XDB.js promotes efficient design practices to maximize benefits and minimize potential issues.

##   Comparison to Alternatives

XDB.js offers a compelling combination of simplicity and power.

###   Lightweight JSON Database Comparison

|   Feature                       |   XDB.js                                   |   lowdb                                     |   json-db                                  |   NeDB                                       |   json-storage                             |   unqlite                                     |
| :---------------------------- | :----------------------------------------- | :---------------------------------------- | :--------------------------------------- | :------------------------------------------ | :----------------------------------------- | :------------------------------------------- |
|   **Installation** |   ★★★★★ (Simple npm install)              |   ★★★★☆ (npm install)                       |   ★★★★☆ (npm install)                      |   ★★★★☆ (npm install)                       |   ★★★★★ (npm install)                      |   ★★★☆☆ (npm install, some native build) |
|   **Configuration** |   ★★★★★ (Zero config default)            |   ★★★★☆ (Minimal file setup)              |   ★★★★☆ (File path required)             |   ★★★★☆ (File path required)                |   ★★★★☆ (File path required)                |   ★★★☆☆ (File path, more options)          |
|   **API Learning Curve** |   ★★★★★ (Intuitive JS API)                |   ★★★★★ (Very simple API)                  |   ★★★★☆ (Standard JS ops)                 |   ★★★★☆ (MongoDB-like API)                  |   ★★★★☆ (Simple methods)                    |   ★★★☆☆ (C API, JS wrapper)                |
|   **Zero External Dependencies** |   ★★★★★ (Pure JS)                          |   ★★★☆☆ (Uses lodash)                     |   ★★☆☆☆ (Multiple dependencies)            |   ★★★☆☆ (Uses loki)                         |   ★★★★☆ (Pure JS)                           |   ★★★☆☆ (Native lib)                       |
|   **File Storage Structure** |   ★★★★★ (One file per "table")           |   ★★★★★ (One file per DB)                 |   ★★★★★ (One file per DB)                |   ★★★★☆ (Datafile + indexes)                |   ★★★★★ (One file per DB)                 |   ★★★★★ (Single DB file)                   |
|   **Atomic Writes** |   ★★★★★ (File-level atomic)              |   ★★☆☆☆ (In-memory, risk of data loss)     |   ★★★☆☆ (File-level, basic)             |   ★★★☆☆ (File-level)                      |   ★★☆☆☆ (In-memory)                         |   ★★★★☆ (Transactional)                    |
|   **Schema Validation Type** |   ★★★★☆ (JSON Schema)                      |   ★☆☆☆☆ (None)                            |   ★★☆☆☆ (Basic type checks)               |   ★☆☆☆☆ (None)                              |   ★☆☆☆☆ (None)                              |   ☆☆☆☆☆ (None)                               |
|   **Rel. Definition** |   ★★★★☆ (Explicit JS config)             |   ☆☆☆☆☆ (None)                            |   ★☆☆☆☆ (None)                           |   ☆☆☆☆☆ (None)                              |   ☆☆☆☆☆ (None)                              |   ☆☆☆☆☆ (None)                               |
|   **Rel. Querying** |   ★★★★☆ (Integrated methods)             |   ☆☆☆☆☆ (Manual filtering)                |   ★☆☆☆☆ (Manual filtering)               |   ☆☆☆☆☆ (Manual filtering)                  |   ☆☆☆☆☆ (Manual filtering)                  |   ☆☆☆☆☆ (None)                               |
|   **Basic Querying** |   ★★★★★ (ID lookup)                      |   ★★★★★ (ID lookup)                       |   ★★★★★ (ID lookup)                      |   ★★★★★ (ID lookup)                         |   ★★★★★ (ID lookup)                       |   ★★★★★ (Key-value)                         |
|   **Filtering** |   ★★★★☆ (Flexible functions)             |   ★★☆☆☆ (lodash methods)                  |   ★★★☆☆ (Basic filtering)                |   ★★★★☆ (MongoDB-like syntax)               |   ★★☆☆☆ (Basic filtering)                   |   ★★☆☆☆ (Limited)                           |
|   **Sorting** |   ★★★★☆ (Multi-field, custom)            |   ★★☆☆☆ (lodash methods)                  |   ★★★☆☆ (Basic sorting)                  |   ★★★★☆ (Sort options)                      |   ★★☆☆☆ (None)                              |   ★★☆☆☆ (Limited)                           |
|   **Joins** |   ★★★☆☆ (Programmatic)                 |   ☆☆☆☆☆ (None)                            |   ☆☆☆☆☆ (None)                           |   ☆☆☆☆☆ (None)                              |   ☆☆☆☆☆ (None)                              |   ☆☆☆☆☆ (None)                               |
|   **Index Creation** |   ★★★★☆ (Configurable)                   |   ☆☆☆☆☆ (None)                            |   ★☆☆☆☆ (None)                           |   ★★★☆☆ (Automatic)                       |   ☆☆☆☆☆ (None)                              |   ★★☆☆☆ (Limited)                           |
|   **Read Perf. (<1MB)** |   ★★★★☆ (Fast)                           |   ★★★★★ (Very fast)                       |   ★★★★☆ (Good)                           |   ★★★★☆ (Good)                              |   ★★★★★ (Fast)                            |   ★★★★☆ (Good)                               |
|   **Write Perf. (<1MB)** |   ★★★★☆ (Fast)                           |   ★★★★★ (Fast)                          |   ★★★★☆ (Good)                           |   ★★★★☆ (Good)                              |   ★★★★★ (Fast)                            |   ★★★★☆ (Good)                               |
|   **Read Perf. (1MB-100MB)** |   ★★★★☆ (Good)                           |   ★★★☆☆ (Moderate)                        |   ★★★☆☆ (Moderate)                     |   ★★★☆☆ (Moderate)                        |   ★★☆☆☆ (Slower)                            |   ★★★☆☆ (Moderate)                         |
|   **Write Perf. (1MB-100MB)** |   ★★★★☆ (Good)                           |   ★★★☆☆ (Moderate)                        |   ★★★☆☆ (Moderate)                     |   ★★★☆☆ (Moderate)                        |   ★★☆☆☆ (Slower)                            |   ★★★☆☆ (Moderate)                         |
|   **Read Perf. (>100MB)** |   ★★★☆☆ (Scales decently)                |   ★☆☆☆☆ (Poor)                            |   ★★☆☆☆ (Poor)                           |   ★★★☆☆ (Decent)                          |   ★☆☆☆☆ (Very slow)                       |   ★★★☆☆ (Decent)                           |
|   **Write Perf. (>100MB)** |   ★★★☆☆ (Scales decently)                |   ★☆☆☆☆ (Poor)                            |   ★★☆☆☆ (Poor)                           |   ★★★☆☆ (Decent)                          |   ★☆☆☆☆ (Very slow)                       |   ★★★☆☆ (Decent)                           |
|   **Concurrency Control Type** |   ★★★★☆ (File locking)                   |   ★☆☆☆☆ (None)                            |   ★★☆☆☆ (Basic file locking)             |   ★★★☆☆ (File-level)                      |   ★☆☆☆☆ (None)                              |   ★★★☆☆ (Transactions)                     |
|   **Concurrency Granularity** |   ★★★★☆ (File)                             |   ★☆☆☆☆ (None)                            |   ★★☆☆☆ (File)                           |   ★★★☆☆ (File)                            |   ★☆☆☆☆ (None)                              |   ★★★☆☆ (DB)                               |
|   **Event System Flexibility** |   ★★★★★ (Comprehensive hooks)            |   ☆☆☆☆☆ (None)                            |   ☆☆☆☆☆ (None)                           |   ☆☆☆☆☆ (None)                              |   ☆☆☆☆☆ (None)                              |   ☆☆☆☆☆ (None)                               |
|   **Backup Type** |   ★★★★☆ (Automatic, configurable)        |   ☆☆☆☆☆ (Manual only)                     |   ☆☆☆☆☆ (Manual only)                    |   ☆☆☆☆☆ (Manual only)                       |   ☆☆☆☆☆ (Manual only)                       |   ☆☆☆☆☆ (Manual only)                        |
|   **Documentation Quality** |   ★★★★★ (Detailed, examples)             |   ★★★★☆ (Good, clear)                       |   ★★★☆☆ (Basic)                          |   ★★★★☆ (Comprehensive)                   |   ★★☆☆☆ (Limited)                           |   ★★★☆☆ (Decent)                           |
|   **Community Size** |   ☆☆☆☆☆ (Solo dev)                       |   ★★★★☆ (Active community)                |   ★★★☆☆ (Moderate)                       |   ★★★★☆ (Active community)                  |   ★★☆☆☆ (Small)                             |   ★★☆☆☆ (Small)                              |
|   **Development Activity** |   ★★★★★ (Regular updates)                |   ★★★☆☆ (Occasional updates)              |   ★★★☆☆ (Occasional updates)             |   ★★☆☆☆ (Less active)                       |   ★★☆☆☆ (Less active)                       |   ★★☆☆☆ (Less active)                        |

###   Comparison with Traditional Database Systems

|   Feature                   |   XDB.js                               |   SQLite                                 |   MongoDB                                  |
| :------------------------ | :------------------------------------- | :--------------------------------------- | :----------------------------------------- |
|   **Setup Complexity** |   ★☆☆☆☆ (Zero setup, file-based)     |   ★★★☆☆ (Requires installation)          |   ★★★★☆ (Server setup, configuration)      |
|   **Learning Curve** |   ★☆☆☆☆ (Simple JS API)              |   ★★★☆☆ (SQL knowledge required)         |   ★★★☆☆ (NoSQL, complex concepts)          |
|   **Schema Flexibility** |   ★★★★★ (Highly flexible JSON)       |   ★★☆☆☆ (Strict, predefined schema)      |   ★★★★☆ (Flexible, schema-less)            |
|   **Relationship Management** |   ★★★☆☆ (Programmatic management)    |   ★★★★★ (Built-in relational model)      |   ★★★☆☆ (Manual, application-level)        |
|   **Indexing & Performance** |   ★★★☆☆ (Configurable indexing)      |   ★★★★☆ (Optimized indexing)             |   ★★★★★ (Advanced indexing)               |
|   **Querying Power** |   ★★★☆☆ (Flexible JS functions)      |   ★★★★★ (Powerful SQL queries)           |   ★★★★★ (Rich NoSQL query language)        |
|   **Scalability** |   ★★☆☆☆ (Limited horizontal scale)   |   ★★★☆☆ (Good vertical scale)            |   ★★★★★ (Excellent horizontal scale)      |
|   **Use Case Alignment** |   ★★★★★ (Small/medium Node.js apps) |   ★★★★☆ (Embedded, mobile, desktop)      |   ★★★☆☆ (Large-scale, distributed systems) |

##   Join the Community - MIT License

XDB.js is more than just a tool; it represents a forward-thinking approach to databases. Join the community and discover the ease of creating powerful applications. Released under the open-source MIT license, it's free to download, modify, and share!

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
