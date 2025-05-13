#   XDB.js: A Powerful and Lightweight JSON Database for Node.js! ![XDB Banner](https://jsle.eu/xdB/xdb-banner.png)

**Public version:** 1.0.0 (real: 6.4.1) | **License:** MIT | **Node.js:** ≥18.0.0 | **Zero Dependencies:** Yes!

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

### Lightweight JSON Database Comparison

| Feature                  | XDB.js | lowdb  | json-db | NeDB   |
|--------------------------|:------:|:------:|:-------:|:------:|
| Installation             | ★★★★★  | ★★★★☆  | ★★★★☆   | ★★☆☆☆  |
| Configuration            | ★★★★★  | ★★★★☆  | ★★★★☆   | ★★★☆☆  |
| API Intuitiveness        | ★★★★★  | ★★★★★  | ★★★★☆   | ★★★☆☆  |
| Zero Dependencies        | ★★★★★  | ★★★☆☆  | ★★☆☆☆   | ★★★☆☆  |
| File Storage Structure   | ★★★★★  | ★★★★★  | ★★★★★   | ★★★☆☆  |
| Atomic Operations        | ★★★★★  | ★★☆☆☆  | ★★★☆☆   | ★★★☆☆  |
| Schema Validation        | ★★★★☆  | ★☆☆☆☆  | ★★☆☆☆   | ★☆☆☆☆  |
| Relationship Management  | ★★★★☆  | ☆☆☆☆☆  | ★☆☆☆☆   | ☆☆☆☆☆  |
| Read Performance (<1MB)  | ★★★★☆  | ★★★★★  | ★★★★☆   | ★★★☆☆  |
| Write Performance (<1MB) | ★★★★☆  | ★★★★★  | ★★★★☆   | ★★★☆☆  |
| Backup Options           | ★★★★☆  | ☆☆☆☆☆  | ☆☆☆☆☆   | ☆☆☆☆☆  |
| Documentation Quality    | ★★★★★  | ★★★★☆  | ★★★☆☆   | ★★☆☆☆  |

---

### Comparison with Traditional Databases

| Feature                  | XDB.js | SQLite  | MongoDB |
|--------------------------|:------:|:-------:|:-------:|
| Setup Complexity         | ★☆☆☆☆  | ★★★☆☆   | ★★★★☆   |
| Schema Flexibility       | ★★★★★  | ★★☆☆☆   | ★★★★☆   |
| Relationship Management  | ★★★☆☆  | ★★★★★   | ★★★☆☆   |
| Indexing and Performance | ★★★☆☆  | ★★★★☆   | ★★★★★   |
| Scalability              | ★★☆☆☆  | ★★★☆☆   | ★★★★★   |
| Node.js Usability        | ★★★★★  | ★★★★☆   | ★★★☆☆   |

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
