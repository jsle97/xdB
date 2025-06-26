/* xdFiles - A modern file system database for Node.js 
 * ------------------------------------------------------------------------------
 * Status: Private prototype
 * License: MIT
 * ------------------------------------------------------------------------------
 * Copyright (c) 2025 Jakub Śledzikowski <jsledzikowski.web@gmail.com>
 *
 */

import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import zlib from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Transform, Readable, Writable } from "node:stream";
import { Worker } from "node:worker_threads";
import { promisify } from "node:util";

const XDB_ERROR_CODES = {
 FILE_NOT_FOUND: "XDB_FILE_NOT_FOUND",
 DIR_NOT_FOUND: "XDB_DIR_NOT_FOUND",
 IO_ERROR: "XDB_IO_ERROR",
 INVALID_JSON: "XDB_INVALID_JSON",
 RECORD_NOT_FOUND: "XDB_RECORD_NOT_FOUND",
 RECORD_EXISTS: "XDB_RECORD_EXISTS",
 OPERATION_FAILED: "XDB_OPERATION_FAILED",
 INVALID_ADAPTER: "XDB_INVALID_ADAPTER",
 UNSUPPORTED_FORMAT: "XDB_UNSUPPORTED_FORMAT",
 STREAM_ERROR: "XDB_STREAM_ERROR",
 ENCRYPTION_ERROR: "XDB_ENCRYPTION_ERROR",
 PERMISSION_DENIED: "XDB_PERMISSION_DENIED",
 CHECKSUM_MISMATCH: "XDB_CHECKSUM_MISMATCH",
 VERSION_CONFLICT: "XDB_VERSION_CONFLICT",
 QUERY_ERROR: "XDB_QUERY_ERROR"
};

const LOG_LEVELS = {
 DEBUG: 10,
 INFO: 20,
 WARN: 30,
 ERROR: 40,
 NONE: 100
};

const MIME_TYPES = {
 'json': 'application/json',
 'txt': 'text/plain',
 'html': 'text/html',
 'css': 'text/css',
 'js': 'application/javascript',
 'xml': 'application/xml',
 'pdf': 'application/pdf',
 'zip': 'application/zip',
 'jpg': 'image/jpeg',
 'jpeg': 'image/jpeg',
 'png': 'image/png',
 'gif': 'image/gif',
 'mp3': 'audio/mpeg',
 'mp4': 'video/mp4',
 'avi': 'video/x-msvideo'
};

const MAGIC_BYTES = {
 'ffd8ff': 'image/jpeg',
 '89504e47': 'image/png',
 '47494638': 'image/gif',
 '25504446': 'application/pdf',
 '504b0304': 'application/zip',
 '7b': 'application/json',
 '3c': 'text/html'
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let basePath = __dirname;
let currentLogLevel = LOG_LEVELS.INFO;
let cachingEnabled = false;
let cacheTTL = 60000;
let encryptionKey = null;
let compressionEnabled = false;
let versioningEnabled = false;
let indexingEnabled = false;

const fileLocks = new Map();
const dataCache = new Map();
const fileDescriptors = new Map();
const fileIndex = new Map();
const versionStore = new Map();
const adapters = new Map();
const watchers = new Map();
const eventHandlers = new Map();

function log(level, message, ...args) {
 if (level < currentLogLevel) return;
 const timestamp = new Date().toISOString();
 const levelName = Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === level) || "UNKNOWN";
 const formattedMessage = `[${timestamp}] [${levelName}] ${message}`;
 switch (level) {
  case LOG_LEVELS.DEBUG: console.debug(formattedMessage, ...args); break;
  case LOG_LEVELS.INFO: console.log(formattedMessage, ...args); break;
  case LOG_LEVELS.WARN: console.warn(formattedMessage, ...args); break;
  case LOG_LEVELS.ERROR: console.error(formattedMessage, ...args); break;
 }
}

function createXdbError(message, code = XDB_ERROR_CODES.OPERATION_FAILED) {
 const error = new Error(message);
 error.code = code;
 return error;
}

function ensureJsonExtension(filePath) {
 if (!filePath.toLowerCase().endsWith(".json")) {
  return filePath + ".json";
 }
 return filePath;
}

async function ensureDirectoryExists(dirPath) {
 try {
  await fs.mkdir(dirPath, { recursive: true });
 } catch (error) {
  if (error.code !== "EEXIST") {
   throw createXdbError(`Błąd tworzenia katalogu ${dirPath}: ${error.message}`, XDB_ERROR_CODES.IO_ERROR);
  }
 }
}

function generateId(length = 16) {
 try {
  const buffer = crypto.randomBytes(Math.ceil(length * 0.75));
  const base64 = buffer.toString('base64')
   .replace(/\+/g, '-')
   .replace(/\//g, '_')
   .replace(/=/g, '');
  const timestamp = Date.now().toString(36);
  const combined = timestamp + base64;
  return combined.slice(0, length);
 } catch (err) {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_";
  let result = '';
  const timestamp = Date.now().toString(36);
  const randomPart = Array(length - timestamp.length)
   .fill(0)
   .map(() => chars.charAt(Math.floor(Math.random() * chars.length)))
   .join('');
  return (timestamp + randomPart).slice(0, length);
 }
}

function createFileDescriptor(filePath, stats = null) {
 return {
  path: filePath,
  fullPath: path.resolve(basePath, filePath),
  stats: stats,
  mimeType: null,
  encoding: null,
  checksum: null,
  metadata: {},
  adapter: null,
  permissions: null,
  versions: [],
  exists: true,
  
  analyze: async function() {
   try {
    this.stats = await fs.stat(this.fullPath);
    this.permissions = this.stats.mode;
    this.mimeType = await detectMimeType(this.fullPath);
    this.adapter = getAdapterForMimeType(this.mimeType);
    if (this.stats.isFile()) {
     this.checksum = await calculateChecksum(this.fullPath);
    }
   } catch (error) {
    if (error.code === 'ENOENT') {
     this.exists = false;
     const ext = path.extname(this.fullPath).slice(1).toLowerCase();
     this.mimeType = MIME_TYPES[ext] || 'application/octet-stream';
     this.adapter = getAdapterForMimeType(this.mimeType);
     this.stats = {
      size: 0,
      isFile: () => true,
      isDirectory: () => false,
      mode: 0o644,
      birthtime: new Date(),
      mtime: new Date(),
      atime: new Date()
     };
    } else {
     throw error;
    }
   }
   return this;
  },
  
  toJSON: function() {
   return {
    path: this.path,
    exists: this.exists,
    size: this.stats?.size,
    mimeType: this.mimeType,
    encoding: this.encoding,
    checksum: this.checksum,
    created: this.stats?.birthtime,
    modified: this.stats?.mtime,
    accessed: this.stats?.atime,
    permissions: this.permissions,
    metadata: this.metadata,
    versions: this.versions.length
   };
  }
 };
}

async function detectMimeType(filePath) {
 const ext = path.extname(filePath).slice(1).toLowerCase();
 if (MIME_TYPES[ext]) return MIME_TYPES[ext];

 try {
  const buffer = Buffer.alloc(8);
  const fd = await fs.open(filePath, 'r');
  await fd.read(buffer, 0, 8, 0);
  await fd.close();
  
  const hex = buffer.toString('hex');
  for (const [magic, mime] of Object.entries(MAGIC_BYTES)) {
   if (hex.startsWith(magic)) return mime;
  }
 } catch (error) {
  if (error.code === 'ENOENT' && ext) {
   return MIME_TYPES[ext] || 'application/octet-stream';
  }
 }

 return 'application/octet-stream';
}

async function calculateChecksum(filePath, algorithm = 'sha256') {
 const hash = crypto.createHash(algorithm);
 const stream = fsSync.createReadStream(filePath);
 for await (const chunk of stream) {
  hash.update(chunk);
 }
 return hash.digest('hex');
}

const BaseAdapter = {
 read: async function(descriptor) {
  throw new Error('read() must be implemented by adapter');
 },
 
 write: async function(descriptor, data) {
  throw new Error('write() must be implemented by adapter');
 },
 
 transform: async function(descriptor, transformer) {
  const data = await this.read(descriptor);
  return transformer(data);
 },
 
 supportsStreaming: function() {
  return false;
 },
 
 supportsIndexing: function() {
  return false;
 }
};

const JSONAdapter = {
 ...BaseAdapter,
 
 read: async function(descriptor) {
  const content = await fs.readFile(descriptor.fullPath, 'utf-8');
  try {
   return JSON.parse(content);
  } catch (error) {
   throw createXdbError(`Nieprawidłowy JSON w pliku ${descriptor.path}: ${error.message}`, XDB_ERROR_CODES.INVALID_JSON);
  }
 },
 
 write: async function(descriptor, data) {
  const content = JSON.stringify(data);
  await atomicWrite(descriptor.path, content);
 },
 
 supportsIndexing: function() {
  return true;
 },
 
 index: async function(descriptor, data) {
  const indexes = [];
  const traverse = (obj, path = '') => {
   for (const [key, value] of Object.entries(obj)) {
    const fullPath = path ? `${path}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
     traverse(value, fullPath);
    } else {
     indexes.push({ path: fullPath, value, type: typeof value });
    }
   }
  };
  if (Array.isArray(data)) {
   data.forEach((item, index) => {
    if (item && typeof item === 'object') {
     traverse(item, `[${index}]`);
    }
   });
  } else if (data && typeof data === 'object') {
   traverse(data);
  }
  return indexes;
 }
};

const TextAdapter = {
 ...BaseAdapter,
 
 read: async function(descriptor) {
  const encoding = descriptor.encoding || 'utf-8';
  return await fs.readFile(descriptor.fullPath, encoding);
 },
 
 write: async function(descriptor, data) {
  const encoding = descriptor.encoding || 'utf-8';
  await atomicWrite(descriptor.path, data, encoding);
 },
 
 supportsStreaming: function() {
  return true;
 },
 
 supportsIndexing: function() {
  return true;
 },
 
 index: async function(descriptor, data) {
  const words = data.toLowerCase().split(/\s+/);
  const wordCount = {};
  words.forEach(word => {
   word = word.replace(/[^a-z0-9]/g, '');
   if (word) wordCount[word] = (wordCount[word] || 0) + 1;
  });
  return Object.entries(wordCount).map(([word, count]) => ({
   path: 'content',
   value: word,
   type: 'word',
   count
  }));
 }
};

const BinaryAdapter = {
 ...BaseAdapter,
 
 read: async function(descriptor) {
  return await fs.readFile(descriptor.fullPath);
 },
 
 write: async function(descriptor, data) {
  await atomicWriteBinary(descriptor.path, data);
 },
 
 supportsStreaming: function() {
  return true;
 }
};

const StreamAdapter = {
 ...BaseAdapter,
 
 createReadStream: function(descriptor, options = {}) {
  return fsSync.createReadStream(descriptor.fullPath, options);
 },
 
createWriteStream: function(descriptor, options = {}) {
 const dirPath = path.dirname(descriptor.fullPath);
 try {
  fsSync.mkdirSync(dirPath, { recursive: true });
 } catch (error) {
  if (error.code !== 'EEXIST') throw error;
 }
 
 const tempPath = descriptor.fullPath + '.tmp' + Date.now() + Math.random();
 
 let finished = false;
 let finishResolve, finishReject;
 
 const finishPromise = new Promise((resolve, reject) => {
  finishResolve = resolve;
  finishReject = reject;
 });
 
 const stream = fsSync.createWriteStream(tempPath, options);
 
 const handleFinish = async () => {
  if (!finished) {
   finished = true;
   try {
    await fs.rename(tempPath, descriptor.fullPath);
    invalidateCache(descriptor.path); // Clears dataCache
    fileDescriptors.delete(descriptor.path); // <--- FIX: Clear stale file descriptor
    emitEvent('write', descriptor.path);
    finishResolve();
   } catch (error) {
    // Attempt to clean up the temporary file if rename failed
    try {
     await fs.unlink(tempPath);
    } catch (unlinkError) {
     log(LOG_LEVELS.WARN, `Nie udało się usunąć pliku tymczasowego ${tempPath} po błędzie zapisu (rename): ${unlinkError.message}`);
    }
    finishReject(error);
   }
  }
 };
 
 stream.on('finish', handleFinish);
 
 stream.on('error', async (error) => { // Made async for await fs.unlink
  if (!finished) {
   finished = true;
   // Attempt to clean up the temporary file on stream error
   try {
    await fs.unlink(tempPath);
   } catch (unlinkError) {
    log(LOG_LEVELS.WARN, `Nie udało się usunąć pliku tymczasowego ${tempPath} po błędzie strumienia: ${unlinkError.message}`);
   }
   finishReject(error);
  }
 });
 
 stream._finishPromise = finishPromise;
 stream.waitForFinish = async () => stream._finishPromise;
 return stream;
},
 
 supportsStreaming: function() {
  return true;
 }
};

function registerAdapter(mimeType, adapter) {
 adapters.set(mimeType, adapter);
}

function getAdapterForMimeType(mimeType) {
 if (adapters.has(mimeType)) {
  return adapters.get(mimeType);
 }
 if (mimeType.startsWith('text/')) {
  return adapters.get('text/*');
 }
 return adapters.get('*/*');
}

registerAdapter('application/json', JSONAdapter);
registerAdapter('text/*', TextAdapter);
registerAdapter('*/*', BinaryAdapter);

async function getFileDescriptor(filePath) {
 if (fileDescriptors.has(filePath)) {
  return fileDescriptors.get(filePath);
 }
 const descriptor = createFileDescriptor(filePath);
 await descriptor.analyze();
 fileDescriptors.set(filePath, descriptor);
 return descriptor;
}

function getCacheKey(filePath, id = null) {
 return id ? `${filePath}:${id}` : filePath;
}

function getCachedData(filePath, id = null) {
 if (!cachingEnabled) return null;
 const key = getCacheKey(filePath, id);
 const cached = dataCache.get(key);
 if (!cached) return null;
 const now = Date.now();
 if (now - cached.timestamp > cacheTTL) {
  dataCache.delete(key);
  return null;
 }
 log(LOG_LEVELS.DEBUG, `Cache hit dla: ${key}`);
 return cached.data;
}

function setCachedData(filePath, data, id = null) {
 if (!cachingEnabled) return;
 const key = getCacheKey(filePath, id);
 dataCache.set(key, {
  data,
  timestamp: Date.now()
 });
 log(LOG_LEVELS.DEBUG, `Dodano do cache: ${key}`);
}

function invalidateCache(filePath, id = null) {
 if (!cachingEnabled) return;
 if (id) {
  const key = getCacheKey(filePath, id);
  dataCache.delete(key);
  log(LOG_LEVELS.DEBUG, `Usunięto z cache: ${key}`);
 } else {
  const prefix = getCacheKey(filePath);
  for (const key of dataCache.keys()) {
   if (key === prefix || key.startsWith(`${prefix}:`)) {
    dataCache.delete(key);
    log(LOG_LEVELS.DEBUG, `Usunięto z cache: ${key}`);
   }
  }
 }
}

function clearAllCache() {
 dataCache.clear();
 log(LOG_LEVELS.INFO, `Wyczyszczono cały cache`);
}

async function acquireLock(filePath, timeout = 5000) {
 const fullPath = path.resolve(basePath, filePath);
 const start = Date.now();
 log(LOG_LEVELS.DEBUG, `Próba uzyskania blokady dla: ${filePath}`);
 while (fileLocks.has(fullPath)) {
  if (Date.now() - start > timeout) {
   throw createXdbError(`Timeout podczas oczekiwania na blokadę pliku ${filePath} po ${timeout}ms`, XDB_ERROR_CODES.OPERATION_FAILED);
  }
  await fileLocks.get(fullPath);
 }
 let release;
 const lockPromise = new Promise(resolve => {
  release = resolve;
 });
 fileLocks.set(fullPath, lockPromise);
 log(LOG_LEVELS.DEBUG, `Uzyskano blokadę dla: ${filePath}`);
 return () => releaseLock(fullPath, release);
}

function releaseLock(fullPath, release) {
 if (fileLocks.has(fullPath)) {
  if (release) release();
  fileLocks.delete(fullPath);
  log(LOG_LEVELS.DEBUG, `Zwolniono blokadę dla: ${fullPath}`);
 }
}

async function atomicWrite(filePath, data, encoding = 'utf-8') {
 const fullPath = path.resolve(basePath, filePath);
 let tempPath;
 let fileHandle;
 try {
  tempPath = fullPath + ".tmp" + Date.now() + Math.random();
  await ensureDirectoryExists(path.dirname(fullPath));
  fileHandle = await fs.open(tempPath, "w");
  await fileHandle.writeFile(data, encoding);
  await fileHandle.sync();
  await fileHandle.close();
  fileHandle = null;
  await fs.rename(tempPath, fullPath);
  log(LOG_LEVELS.DEBUG, `Pomyślnie zapisano plik: ${filePath}`);
  invalidateCache(filePath);
  emitEvent('write', filePath);
 } catch (error) {
  if (fileHandle) {
   try {
    await fileHandle.close();
   } catch (closeError) {}
  }
  if (tempPath) {
   try {
    await fs.unlink(tempPath);
   } catch (e) {}
  }
  throw createXdbError(`Atomowy zapis do ${filePath} nie powiódł się: ${error.message}`, XDB_ERROR_CODES.IO_ERROR);
 }
}

async function atomicWriteBinary(filePath, buffer) {
 const fullPath = path.resolve(basePath, filePath);
 let tempPath;
 let fileHandle;
 try {
  tempPath = fullPath + ".tmp" + Date.now() + Math.random();
  await ensureDirectoryExists(path.dirname(fullPath));
  fileHandle = await fs.open(tempPath, "w");
  await fileHandle.writeFile(buffer);
  await fileHandle.sync();
  await fileHandle.close();
  fileHandle = null;
  await fs.rename(tempPath, fullPath);
  log(LOG_LEVELS.DEBUG, `Pomyślnie zapisano plik binarny: ${filePath}`);
  invalidateCache(filePath);
  emitEvent('write', filePath);
 } catch (error) {
  if (fileHandle) {
   try {
    await fileHandle.close();
   } catch (closeError) {}
  }
  if (tempPath) {
   try {
    await fs.unlink(tempPath);
   } catch (e) {}
  }
  throw createXdbError(`Atomowy zapis binarny do ${filePath} nie powiódł się: ${error.message}`, XDB_ERROR_CODES.IO_ERROR);
 }
}

function emitEvent(event, ...args) {
 const handlers = eventHandlers.get(event) || [];
 handlers.forEach(handler => {
  try {
   handler(...args);
  } catch (error) {
   log(LOG_LEVELS.ERROR, `Błąd w event handlerze dla ${event}: ${error.message}`);
  }
 });
}

function on(event, handler) {
 if (!eventHandlers.has(event)) {
  eventHandlers.set(event, []);
 }
 eventHandlers.get(event).push(handler);
}

function off(event, handler) {
 if (eventHandlers.has(event)) {
  const handlers = eventHandlers.get(event);
  const index = handlers.indexOf(handler);
  if (index > -1) {
   handlers.splice(index, 1);
  }
 }
}

async function encrypt(data, key = encryptionKey) {
 if (!key || key === null) throw createXdbError('Brak klucza szyfrowania', XDB_ERROR_CODES.ENCRYPTION_ERROR);
 const iv = crypto.randomBytes(16);
 const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
 const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
 return Buffer.concat([iv, encrypted]);
}

async function decrypt(encryptedData, key = encryptionKey) {
 if (!key) throw createXdbError('Brak klucza szyfrowania', XDB_ERROR_CODES.ENCRYPTION_ERROR);
 const iv = encryptedData.slice(0, 16);
 const encrypted = encryptedData.slice(16);
 const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
 const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
 return decrypted;
}

async function compress(data) {
 return new Promise((resolve, reject) => {
  zlib.gzip(data, (err, compressed) => {
   if (err) reject(err);
   else resolve(compressed);
  });
 });
}

async function decompress(data) {
 return new Promise((resolve, reject) => {
  zlib.gunzip(data, (err, decompressed) => {
   if (err) reject(err);
   else resolve(decompressed);
  });
 });
}

async function createVersion(filePath) {
 if (!versioningEnabled) return null;
 const descriptor = await getFileDescriptor(filePath);
 const data = await descriptor.adapter.read(descriptor);
 const version = {
  id: generateId(),
  timestamp: Date.now(),
  checksum: descriptor.checksum,
  size: descriptor.stats.size,
  data: compressionEnabled ? await compress(JSON.stringify(data)) : data
 };
 if (!versionStore.has(filePath)) {
  versionStore.set(filePath, []);
 }
 versionStore.get(filePath).push(version);
 descriptor.versions.push(version.id);
 return version.id;
}

async function getVersion(filePath, versionId) {
 if (!versionStore.has(filePath)) {
  throw createXdbError(`Brak wersji dla pliku ${filePath}`, XDB_ERROR_CODES.VERSION_CONFLICT);
 }
 const versions = versionStore.get(filePath);
 const version = versions.find(v => v.id === versionId);
 if (!version) {
  throw createXdbError(`Wersja ${versionId} nie została znaleziona`, XDB_ERROR_CODES.VERSION_CONFLICT);
 }
 const data = compressionEnabled ? JSON.parse(await decompress(version.data)) : version.data;
 return { ...version, data };
}

async function indexFile(filePath) {
 if (!indexingEnabled) return;
 const descriptor = await getFileDescriptor(filePath);
 if (!descriptor.adapter.supportsIndexing()) return;
 const data = await descriptor.adapter.read(descriptor);
 const indexes = await descriptor.adapter.index(descriptor, data);
 fileIndex.set(filePath, indexes);
 return indexes;
}

async function searchIndex(query, options = {}) {
 if (!indexingEnabled) {
  throw createXdbError('Indeksowanie wyłączone', XDB_ERROR_CODES.QUERY_ERROR);
 }
 const results = [];
 for (const [filePath, indexes] of fileIndex.entries()) {
  const matches = indexes.filter(index => {
   if (options.field && index.path !== options.field) return false;
   if (options.type && index.type !== options.type) return false;
   const value = String(index.value).toLowerCase();
   const searchQuery = String(query).toLowerCase();
   if (options.exact) {
    return value === searchQuery;
   }
   return value.includes(searchQuery);
  });
  if (matches.length > 0) {
   results.push({ file: filePath, matches });
  }
 }
 return results;
}

function createQueryBuilder() {
 return {
  conditions: [],
  selections: [],
  orderBy: [],
  limitValue: null,
  offsetValue: null,
  
  where: function(field, operator, value) {
   this.conditions.push({ field, operator, value });
   return this;
  },
  
  select: function(fields) {
   this.selections = Array.isArray(fields) ? fields : [fields];
   return this;
  },
  
  order: function(field, direction = 'asc') {
   this.orderBy.push({ field, direction });
   return this;
  },
  
  limit: function(n) {
   this.limitValue = n;
   return this;
  },
  
  offset: function(n) {
   this.offsetValue = n;
   return this;
  },
  
  execute: async function(filePath = null) {
   const results = [];
   const filesToSearch = filePath ? [filePath] : Array.from(fileDescriptors.keys());
   
   for (const file of filesToSearch) {
    try {
     const descriptor = await getFileDescriptor(file);
     const data = await descriptor.adapter.read(descriptor);
     
     if (Array.isArray(data)) {
      const filtered = data.filter(record => {
       return this.conditions.every(condition => {
        const value = record[condition.field];
        switch (condition.operator) {
         case '=': return value == condition.value;
         case '!=': return value != condition.value;
         case '>': return value > condition.value;
         case '<': return value < condition.value;
         case '>=': return value >= condition.value;
         case '<=': return value <= condition.value;
         case 'like': return String(value).toLowerCase().includes(String(condition.value).toLowerCase());
         case 'in': return Array.isArray(condition.value) && condition.value.includes(value);
         default: return false;
        }
       });
      });
      
      let processed = filtered;
      
      if (this.orderBy.length > 0) {
       processed.sort((a, b) => {
        for (const order of this.orderBy) {
         const valA = a[order.field];
         const valB = b[order.field];
         const direction = order.direction === 'desc' ? -1 : 1;
         if (valA < valB) return -1 * direction;
         if (valA > valB) return 1 * direction;
        }
        return 0;
       });
      }
      
      if (this.offsetValue !== null) {
       processed = processed.slice(this.offsetValue);
      }
      
      if (this.limitValue !== null) {
       processed = processed.slice(0, this.limitValue);
      }
      
      if (this.selections.length > 0) {
       processed = processed.map(record => {
        const selected = {};
        this.selections.forEach(field => {
         if (field in record) selected[field] = record[field];
        });
        return selected;
       });
      }
      
      results.push(...processed.map(item => ({ file, data: item })));
     }
    } catch (error) {
     log(LOG_LEVELS.WARN, `Błąd podczas wykonywania zapytania dla ${file}: ${error.message}`);
    }
   }
   
   return results;
  }
 };
}

function createBatchOperation() {
 return {
  operations: [],
  
  copy: function(source, target) {
   this.operations.push({ type: 'copy', source, target });
   return this;
  },
  
  move: function(source, target) {
   this.operations.push({ type: 'move', source, target });
   return this;
  },
  
  delete: function(path) {
   this.operations.push({ type: 'delete', path });
   return this;
  },
  
  write: function(path, data, options) {
   this.operations.push({ type: 'write', path, data, options });
   return this;
  },
  
  commit: async function() {
   const results = [];
   const rollback = [];
   
   for (const op of this.operations) {
    try {
     let result;
     switch (op.type) {
      case 'copy':
       result = await copyFile(op.source, op.target);
       rollback.push({ type: 'delete', path: op.target });
       break;
      case 'move':
       result = await moveFile(op.source, op.target);
       rollback.push({ type: 'move', source: op.target, target: op.source });
       break;
      case 'delete':
       const fullPath = path.resolve(basePath, op.path);
       try {
        await fs.stat(fullPath);
       } catch (statError) {
        if (statError.code === 'ENOENT') {
         throw createXdbError(`Plik ${op.path} nie istnieje`, XDB_ERROR_CODES.FILE_NOT_FOUND);
        }
        throw statError;
       }
       const descriptor = await getFileDescriptor(op.path);
       const backup = await descriptor.adapter.read(descriptor);
       result = await deleteFile(op.path);
       rollback.push({ type: 'write', path: op.path, data: backup });
       break;
      case 'write':
       let existingData = null;
       try {
        const descriptor = await getFileDescriptor(op.path);
        existingData = await descriptor.adapter.read(descriptor);
       } catch (e) {}
       result = await writeFile(op.path, op.data, op.options || {});
       if (existingData) {
        rollback.push({ type: 'write', path: op.path, data: existingData });
       } else {
        rollback.push({ type: 'delete', path: op.path });
       }
       break;
     }
     results.push({ operation: op, result, success: true });
    } catch (error) {
     results.push({ operation: op, error: error.message, success: false });
     
     for (const rbOp of rollback.reverse()) {
      try {
       switch (rbOp.type) {
        case 'copy': await copyFile(rbOp.source, rbOp.target); break;
        case 'move': await moveFile(rbOp.source, rbOp.target); break;
        case 'delete': await deleteFile(rbOp.path); break;
        case 'write': await writeFile(rbOp.path, rbOp.data); break;
       }
      } catch (rbError) {
       log(LOG_LEVELS.ERROR, `Błąd podczas rollback: ${rbError.message}`);
      }
     }
     
     throw createXdbError(`Batch operation failed: ${error.message}`, XDB_ERROR_CODES.OPERATION_FAILED);
    }
   }
   
   return results;
  }
 };
}

async function copyFile(source, target) {
 const sourceDesc = await getFileDescriptor(source);
 await ensureDirectoryExists(path.dirname(path.resolve(basePath, target)));
 await fs.copyFile(sourceDesc.fullPath, path.resolve(basePath, target));
 emitEvent('copy', source, target);
 emitEvent('write', target);
 return { source, target };
}

async function deleteFile(filePath) {
 const fullPath = path.resolve(basePath, filePath);
 try {
  await fs.stat(fullPath);
 } catch (statError) {
  if (statError.code === 'ENOENT') {
   throw createXdbError(`Plik ${filePath} nie istnieje`, XDB_ERROR_CODES.FILE_NOT_FOUND);
  }
  throw statError;
 }
 await fs.unlink(fullPath);
 fileDescriptors.delete(filePath);
 invalidateCache(filePath);
 emitEvent('delete', filePath);
 return { path: filePath };
}

async function writeFile(filePath, data, options = {}) {
 if (options.raw) {
  await atomicWrite(filePath, typeof data === 'string' ? data : JSON.stringify(data));
  fileDescriptors.delete(filePath);
  if (versioningEnabled || indexingEnabled) {
   await getFileDescriptor(filePath);
  }
  return { path: filePath };
 }
 
 const descriptor = await getFileDescriptor(filePath);
 if (!descriptor.adapter) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  descriptor.mimeType = MIME_TYPES[ext] || 'application/octet-stream';
  descriptor.adapter = getAdapterForMimeType(descriptor.mimeType);
 }
 
 await descriptor.adapter.write(descriptor, data);
 
 fileDescriptors.delete(filePath);
 await getFileDescriptor(filePath);
 
 if (versioningEnabled) {
  await createVersion(filePath);
 }
 if (indexingEnabled && descriptor.adapter.supportsIndexing()) {
  await indexFile(filePath);
 }
 return { path: filePath };
}

async function stat(filePath) {
 const descriptor = await getFileDescriptor(filePath);
 return descriptor.toJSON();
}

function stream(filePath) {
 return {
  read: async (options = {}) => {
   const descriptor = await getFileDescriptor(filePath);
   if (!descriptor.adapter.supportsStreaming()) {
    throw createXdbError(`Adapter dla ${descriptor.mimeType} nie wspiera streamingu`, XDB_ERROR_CODES.UNSUPPORTED_FORMAT);
   }
   return StreamAdapter.createReadStream(descriptor, options);
  },
  write: async (options = {}) => {
   const descriptor = await getFileDescriptor(filePath);
   if (!descriptor.adapter.supportsStreaming()) {
    throw createXdbError(`Adapter dla ${descriptor.mimeType} nie wspiera streamingu`, XDB_ERROR_CODES.UNSUPPORTED_FORMAT);
   }
   const writeStream = StreamAdapter.createWriteStream(descriptor, options);
   
   // POPRAWKA: Upewniamy się, że właściwości są dostępne
   if (!writeStream.waitForFinish) {
    log(LOG_LEVELS.WARN, 'Stream nie posiada metody waitForFinish');
   }
   
   return writeStream;
  }
 };
}

async function streamPipe(source, target, transform = null) {
 const sourceStream = await stream(source).read();
 const targetStream = await stream(target).write();
 
 try {
  if (transform) {
   await pipeline(sourceStream, transform, targetStream);
  } else {
   await pipeline(sourceStream, targetStream);
  }
  
  // POPRAWKA: Czekamy na pełne zakończenie zapisu
  if (targetStream.waitForFinish) {
   await targetStream.waitForFinish();
  }
  
  return { source, target };
 } catch (error) {
  throw createXdbError(`Błąd podczas przesyłania strumienia z ${source} do ${target}: ${error.message}`, XDB_ERROR_CODES.STREAM_ERROR);
 }
}

async function watch(filePath, callback) {
 const fullPath = path.resolve(basePath, filePath);
 const watcher = fsSync.watch(fullPath, async (eventType, filename) => {
  try {
   const descriptor = await getFileDescriptor(filePath);
   callback(eventType, filePath, descriptor);
  } catch (error) {
   callback('error', filePath, error);
  }
 });
 watchers.set(filePath, watcher);
 return () => {
  watcher.close();
  watchers.delete(filePath);
 };
}

async function chunk(filePath, chunkSize = 1024 * 1024, processor) {
 const descriptor = await getFileDescriptor(filePath);
 if (!descriptor.stats || !descriptor.exists) {
  throw createXdbError(`Plik ${filePath} nie istnieje`, XDB_ERROR_CODES.FILE_NOT_FOUND);
 }
 const fileSize = descriptor.stats.size;
 let position = 0;
 let chunkIndex = 0;
 
 while (position < fileSize) {
  const buffer = Buffer.alloc(Math.min(chunkSize, fileSize - position));
  const fd = await fs.open(descriptor.fullPath, 'r');
  await fd.read(buffer, 0, buffer.length, position);
  await fd.close();
  
  const result = await processor(buffer, chunkIndex, position, fileSize);
  if (result === false) break;
  
  position += buffer.length;
  chunkIndex++;
 }
 
 return { chunks: chunkIndex, totalSize: fileSize };
}

async function setConfig(options = {}) {
 if (options.basePath) {
  basePath = path.resolve(options.basePath);
  log(LOG_LEVELS.INFO, `Ustawiono ścieżkę bazową: ${basePath}`);
 }
 if (options.logLevel !== undefined) {
  const requestedLevel = options.logLevel.toUpperCase ? options.logLevel.toUpperCase() : options.logLevel;
  if (typeof requestedLevel === 'string' && LOG_LEVELS[requestedLevel] !== undefined) {
   currentLogLevel = LOG_LEVELS[requestedLevel];
   log(LOG_LEVELS.INFO, `Ustawiono poziom logowania: ${requestedLevel}`);
  } else if (typeof requestedLevel === 'number') {
   currentLogLevel = requestedLevel;
  }
 }
 if (options.cachingEnabled !== undefined) {
  cachingEnabled = !!options.cachingEnabled;
  log(LOG_LEVELS.INFO, `Cache ${cachingEnabled ? 'włączony' : 'wyłączony'}`);
  if (!cachingEnabled) clearAllCache();
 }
 if (options.cacheTTL !== undefined && typeof options.cacheTTL === 'number' && options.cacheTTL > 0) {
  cacheTTL = options.cacheTTL;
  log(LOG_LEVELS.INFO, `Ustawiono TTL cache: ${cacheTTL}ms`);
 }
 if (options.encryptionKey !== undefined) {
  encryptionKey = options.encryptionKey;
  if (options.encryptionKey) {
   log(LOG_LEVELS.INFO, `Ustawiono klucz szyfrowania`);
  } else {
   log(LOG_LEVELS.INFO, `Usunięto klucz szyfrowania`);
  }
 }
 if (options.compressionEnabled !== undefined) {
  compressionEnabled = !!options.compressionEnabled;
  log(LOG_LEVELS.INFO, `Kompresja ${compressionEnabled ? 'włączona' : 'wyłączona'}`);
 }
 if (options.versioningEnabled !== undefined) {
  versioningEnabled = !!options.versioningEnabled;
  log(LOG_LEVELS.INFO, `Wersjonowanie ${versioningEnabled ? 'włączone' : 'wyłączone'}`);
 }
 if (options.indexingEnabled !== undefined) {
  indexingEnabled = !!options.indexingEnabled;
  log(LOG_LEVELS.INFO, `Indeksowanie ${indexingEnabled ? 'włączone' : 'wyłączone'}`);
 }
 return {
  basePath,
  logLevel: currentLogLevel,
  cachingEnabled,
  cacheTTL,
  encryptionKey: encryptionKey ? '***' : null,
  compressionEnabled,
  versioningEnabled,
  indexingEnabled
 };
}

async function addDir(dirPath) {
 try {
  const fullPath = path.resolve(basePath, dirPath);
  await ensureDirectoryExists(fullPath);
  log(LOG_LEVELS.INFO, `Utworzono katalog: ${dirPath}`);
  return { path: fullPath };
 } catch (error) {
  log(LOG_LEVELS.ERROR, `Błąd podczas tworzenia katalogu ${dirPath}: ${error.message}`);
  throw createXdbError(`Nie udało się utworzyć katalogu ${dirPath}: ${error.message}`, XDB_ERROR_CODES.IO_ERROR);
 }
}

async function delDir(dirPath) {
 let release = null;
 const fullPath = path.resolve(basePath, dirPath);
 try {
  release = await acquireLock(dirPath);
  try {
   await fs.stat(fullPath);
  } catch (statError) {
   if (statError.code === "ENOENT") {
    throw createXdbError(`Katalog ${dirPath} nie istnieje.`, XDB_ERROR_CODES.DIR_NOT_FOUND);
   }
   throw statError;
  }
  await fs.rm(fullPath, { recursive: true, force: true });
  log(LOG_LEVELS.INFO, `Usunięto katalog: ${dirPath}`);
  return { path: fullPath };
 } catch (error) {
  log(LOG_LEVELS.ERROR, `Błąd podczas usuwania katalogu ${dirPath}: ${error.message}`);
  if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
  throw createXdbError(`Nie udało się usunąć katalogu ${dirPath}: ${error.message}`, XDB_ERROR_CODES.IO_ERROR);
 } finally {
  if (release) release();
 }
}

async function renameDir(oldPath, newPath) {
 let release = null;
 const oldFullPath = path.resolve(basePath, oldPath);
 const newFullPath = path.resolve(basePath, newPath);
 try {
  release = await acquireLock(oldPath);
  try {
   await fs.stat(oldFullPath);
  } catch (error) {
   if (error.code === "ENOENT") {
    throw createXdbError(`Katalog źródłowy ${oldPath} nie istnieje.`, XDB_ERROR_CODES.DIR_NOT_FOUND);
   }
   throw createXdbError(`Nie udało się uzyskać dostępu do katalogu źródłowego ${oldPath}: ${error.message}`, error.code || XDB_ERROR_CODES.IO_ERROR);
  }
  await ensureDirectoryExists(path.dirname(newFullPath));
  await fs.rename(oldFullPath, newFullPath);
  log(LOG_LEVELS.INFO, `Zmieniono nazwę katalogu z ${oldPath} na ${newPath}`);
  return { oldPath: oldFullPath, newPath: newFullPath };
 } catch (error) {
  log(LOG_LEVELS.ERROR, `Błąd podczas zmiany nazwy katalogu z ${oldPath} na ${newPath}: ${error.message}`);
  if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
  throw createXdbError(`Nie udało się zmienić nazwy katalogu z ${oldPath} na ${newPath}: ${error.message}`, error.code || XDB_ERROR_CODES.IO_ERROR);
 } finally {
  if (release) release();
 }
}

async function moveFile(sourcePath, targetPath) {
 let release = null;
 const isJsonOperation = sourcePath.toLowerCase().endsWith('.json') || targetPath.toLowerCase().endsWith('.json');
 if (isJsonOperation) {
  sourcePath = ensureJsonExtension(sourcePath);
  targetPath = ensureJsonExtension(targetPath);
 }
 const sourceFullPath = path.resolve(basePath, sourcePath);
 const targetFullPath = path.resolve(basePath, targetPath);
 try {
  release = await acquireLock(sourcePath);
  try {
   await fs.stat(sourceFullPath);
  } catch (error) {
   if (error.code === "ENOENT") {
    throw createXdbError(`Plik źródłowy ${sourcePath} nie istnieje.`, XDB_ERROR_CODES.FILE_NOT_FOUND);
   }
   throw createXdbError(`Nie udało się uzyskać dostępu do pliku źródłowego ${sourcePath}: ${error.message}`, error.code || XDB_ERROR_CODES.IO_ERROR);
  }
  await ensureDirectoryExists(path.dirname(targetFullPath));
  await fs.rename(sourceFullPath, targetFullPath);
  invalidateCache(sourcePath);
  log(LOG_LEVELS.INFO, `Przeniesiono plik z ${sourcePath} do ${targetPath}`);
  return { source: sourceFullPath, target: targetFullPath };
 } catch (error) {
  log(LOG_LEVELS.ERROR, `Błąd podczas przenoszenia pliku z ${sourcePath} do ${targetPath}: ${error.message}`);
  if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
  throw createXdbError(`Nie udało się przenieść pliku z ${sourcePath} do ${targetPath}: ${error.message}`, error.code || XDB_ERROR_CODES.IO_ERROR);
 } finally {
  if (release) release();
 }
}

async function safeParseJSON(filePath) {
 const fullPath = path.resolve(basePath, filePath);
 const cachedData = getCachedData(filePath);
 if (cachedData !== null) return cachedData;
 try {
  const data = await fs.readFile(fullPath, "utf-8");
  try {
   const parsedData = JSON.parse(data);
   setCachedData(filePath, parsedData);
   return parsedData;
  } catch (parseError) {
   throw createXdbError(`Nieprawidłowy JSON w pliku ${filePath}: ${parseError.message}`, XDB_ERROR_CODES.INVALID_JSON);
  }
 } catch (readError) {
  if (readError.code === XDB_ERROR_CODES.INVALID_JSON) {
   throw readError;
  }
  if (readError.code === "ENOENT") {
   throw createXdbError(`Plik ${filePath} nie istnieje`, XDB_ERROR_CODES.FILE_NOT_FOUND);
  }
  throw createXdbError(`Błąd odczytu pliku ${filePath}: ${readError.message}`, XDB_ERROR_CODES.IO_ERROR);
 }
}

function validateId(id) {
 if (typeof id !== "string" || id.length === 0) {
  throw createXdbError(`Nieprawidłowe ID: ID musi być niepustym stringiem. Otrzymano: ${id}`, XDB_ERROR_CODES.OPERATION_FAILED);
 }
}

function validateRecord(record) {
 if (!record || typeof record !== "object" || Array.isArray(record)) {
  throw createXdbError("Rekord musi być niepustym obiektem.", XDB_ERROR_CODES.OPERATION_FAILED);
 }
}

async function addAll(filePath, initialData = [], options = { overwrite: true }) {
 let release = null;
 filePath = ensureJsonExtension(filePath);
 const fullPath = path.resolve(basePath, filePath);
 try {
  if (!initialData || typeof initialData !== "object") {
   throw createXdbError("Nieprawidłowe dane: Dane muszą być tablicą lub obiektem.", XDB_ERROR_CODES.OPERATION_FAILED);
  }
  let processedData = initialData;
  if (Array.isArray(initialData)) {
   processedData = initialData.map(record => {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
     throw createXdbError("Rekord musi być niepustym obiektem.", XDB_ERROR_CODES.OPERATION_FAILED);
    }
    let currentId = record.id;
    if (currentId === undefined || currentId === null) {
     currentId = generateId();
    } else {
     currentId = String(currentId);
    }
    return { ...record, id: currentId };
   });
   const ids = processedData.map(r => r.id);
   if (new Set(ids).size !== ids.length) {
    throw createXdbError(`Znaleziono zduplikowane ID w dostarczonych danych.`, XDB_ERROR_CODES.RECORD_EXISTS);
   }
  } else {
   validateRecord(initialData);
   let currentId = initialData.id;
   if (currentId === undefined || currentId === null) {
    currentId = generateId();
   } else {
    currentId = String(currentId);
   }
   processedData = { ...initialData, id: currentId };
  }
  release = await acquireLock(filePath);
  await ensureDirectoryExists(path.dirname(fullPath));
  let fileExists = false;
  try {
   await fs.stat(fullPath);
   fileExists = true;
  } catch (statError) {
   if (statError.code !== "ENOENT") throw statError;
  }
  if (fileExists && !options.overwrite) {
   throw createXdbError(`Plik ${filePath} już istnieje. Ustaw options.overwrite na true, aby nadpisać.`, XDB_ERROR_CODES.OPERATION_FAILED);
  }
  const dataToWrite = Array.isArray(processedData) ? processedData : [processedData];
  await atomicWrite(filePath, JSON.stringify(dataToWrite));
  log(LOG_LEVELS.INFO, `Dodano ${dataToWrite.length} rekordów do ${filePath}`);
  return { path: fullPath };
 } catch (error) {
  log(LOG_LEVELS.ERROR, `Błąd podczas dodawania danych do ${filePath}: ${error.message}`);
  if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
  throw createXdbError(`Nie udało się dodać danych do ${filePath}: ${error.message}`, error.code || XDB_ERROR_CODES.IO_ERROR);
 } finally {
  if (release) release();
 }
}

async function addRecordById(filePath, newRecord) {
 let release = null;
 filePath = ensureJsonExtension(filePath);
 const fullPath = path.resolve(basePath, filePath);
 try {
  validateRecord(newRecord);
  release = await acquireLock(filePath);
  let data;
  try {
   data = await safeParseJSON(filePath);
  } catch (error) {
   if (error.code === 'XDB_FILE_NOT_FOUND') {
    data = [];
   } else {
    throw error;
   }
  }
  if (!Array.isArray(data)) {
   throw createXdbError(`Nie można dodać rekordu: Plik ${filePath} istnieje, ale nie zawiera tablicy JSON.`, XDB_ERROR_CODES.OPERATION_FAILED);
  }
  let recordToAdd = { ...newRecord };
  if (recordToAdd.id === undefined || recordToAdd.id === null) {
   recordToAdd.id = generateId();
   let attempts = 0;
   const maxAttempts = 10;
   while (data.some(record => String(record.id) === String(recordToAdd.id)) && attempts < maxAttempts) {
    recordToAdd.id = generateId();
    attempts++;
    log(LOG_LEVELS.DEBUG, `Kolizja ID, próba ${attempts}/${maxAttempts}: ${recordToAdd.id}`);
   }
   if (attempts >= maxAttempts) {
    throw createXdbError(`Nie udało się wygenerować unikalnego ID dla ${filePath} po ${maxAttempts} próbach.`, XDB_ERROR_CODES.OPERATION_FAILED);
   }
  } else {
   recordToAdd.id = String(recordToAdd.id);
   validateId(recordToAdd.id);
   if (data.some(record => String(record.id) === String(recordToAdd.id))) {
    throw createXdbError(`Rekord z ID ${recordToAdd.id} już istnieje w ${filePath}.`, XDB_ERROR_CODES.RECORD_EXISTS);
   }
  }
  data.push(recordToAdd);
  await atomicWrite(filePath, JSON.stringify(data));
  log(LOG_LEVELS.INFO, `Dodano rekord z ID ${recordToAdd.id} do ${filePath}`);
  return { path: fullPath, record: recordToAdd };
 } catch (error) {
  log(LOG_LEVELS.ERROR, `Błąd podczas dodawania rekordu do ${filePath}: ${error.message}`);
  if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
  throw createXdbError(`Nie udało się dodać rekordu do ${filePath}: ${error.message}`, error.code || XDB_ERROR_CODES.IO_ERROR);
 } finally {
  if (release) release();
 }
}

async function editAll(filePath, newData) {
 let release = null;
 filePath = ensureJsonExtension(filePath);
 const fullPath = path.resolve(basePath, filePath);
 try {
  if (!newData || typeof newData !== "object") {
   throw createXdbError("Nieprawidłowe dane: Dane muszą być tablicą lub obiektem.", XDB_ERROR_CODES.OPERATION_FAILED);
  }
  if (Array.isArray(newData)) {
   for (const record of newData) {
    try {
     validateRecord(record);
     if (record.id !== undefined && record.id !== null) {
      record.id = String(record.id);
      validateId(record.id);
     }
    } catch (validationError) {
     throw createXdbError(`Nieprawidłowy rekord w tablicy danych: ${validationError.message}`, XDB_ERROR_CODES.OPERATION_FAILED);
    }
   }
  }
  release = await acquireLock(filePath);
  const dataWritten = Array.isArray(newData) ? newData : [newData];
  await atomicWrite(filePath, JSON.stringify(dataWritten));
  log(LOG_LEVELS.INFO, `Zaktualizowano ${filePath} - ${dataWritten.length} rekordów`);
  return { path: fullPath };
 } catch (error) {
  log(LOG_LEVELS.ERROR, `Błąd podczas edycji danych w ${filePath}: ${error.message}`);
  if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
  throw createXdbError(`Nie udało się edytować danych w ${filePath}: ${error.message}`, error.code || XDB_ERROR_CODES.IO_ERROR);
 } finally {
  if (release) release();
 }
}

async function editRecordById(filePath, id, newRecord) {
 let release = null;
 filePath = ensureJsonExtension(filePath);
 const fullPath = path.resolve(basePath, filePath);
 try {
  const recordId = String(id);
  validateId(recordId);
  validateRecord(newRecord);
  release = await acquireLock(filePath);
  let data = await safeParseJSON(filePath);
  if (!Array.isArray(data)) {
   throw createXdbError(`Nie można edytować rekordu po ID: Plik ${filePath} nie zawiera tablicy JSON.`, XDB_ERROR_CODES.OPERATION_FAILED);
  }
  const recordIndex = data.findIndex(record => String(record.id) === recordId);
  if (recordIndex === -1) {
   throw createXdbError(`Rekord z ID ${recordId} nie został znaleziony w ${filePath}.`, XDB_ERROR_CODES.RECORD_NOT_FOUND);
  }
  const originalRecord = { ...data[recordIndex] };
  const updatedRecord = { ...originalRecord, ...newRecord, id: originalRecord.id };
  data[recordIndex] = updatedRecord;
  await atomicWrite(filePath, JSON.stringify(data));
  log(LOG_LEVELS.INFO, `Zaktualizowano rekord z ID ${recordId} w ${filePath}`);
  setCachedData(filePath, updatedRecord, recordId);
  return { path: fullPath, record: updatedRecord };
 } catch (error) {
  log(LOG_LEVELS.ERROR, `Błąd podczas edycji rekordu z ID ${id} w ${filePath}: ${error.message}`);
  if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
  throw createXdbError(`Nie udało się edytować rekordu z ID ${id} w ${filePath}: ${error.message}`, error.code || XDB_ERROR_CODES.IO_ERROR);
 } finally {
  if (release) release();
 }
}

async function deleteAll(filePath) {
 let release = null;
 filePath = ensureJsonExtension(filePath);
 const fullPath = path.resolve(basePath, filePath);
 try {
  release = await acquireLock(filePath);
  try {
   await fs.stat(fullPath);
   await atomicWrite(filePath, JSON.stringify([]));
  } catch (statError) {
   if (statError.code === "ENOENT") return { path: fullPath };
   throw statError;
  }
  log(LOG_LEVELS.INFO, `Usunięto wszystkie rekordy z ${filePath}`);
  return { path: fullPath };
 } catch (error) {
  log(LOG_LEVELS.ERROR, `Błąd podczas usuwania wszystkich rekordów z ${filePath}: ${error.message}`);
  if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
  throw createXdbError(`Nie udało się usunąć wszystkich rekordów z ${filePath}: ${error.message}`, error.code || XDB_ERROR_CODES.IO_ERROR);
 } finally {
  if (release) release();
 }
}

async function deleteRecordById(filePath, id) {
 let release = null;
 filePath = ensureJsonExtension(filePath);
 const fullPath = path.resolve(basePath, filePath);
 try {
  const recordId = String(id);
  validateId(recordId);
  release = await acquireLock(filePath);
  let data = await safeParseJSON(filePath);
  if (!Array.isArray(data)) {
   throw createXdbError(`Nie można usunąć rekordu po ID: Plik ${filePath} nie zawiera tablicy JSON.`, XDB_ERROR_CODES.OPERATION_FAILED);
  }
  const initialLength = data.length;
  const filteredData = data.filter(record => String(record.id) !== recordId);
  if (initialLength === filteredData.length) {
   throw createXdbError(`Rekord z ID ${recordId} nie został znaleziony w ${filePath}.`, XDB_ERROR_CODES.RECORD_NOT_FOUND);
  }
  await atomicWrite(filePath, JSON.stringify(filteredData));
  log(LOG_LEVELS.INFO, `Usunięto rekord z ID ${recordId} z ${filePath}`);
  invalidateCache(filePath, recordId);
  return { path: fullPath, deletedId: recordId };
 } catch (error) {
  log(LOG_LEVELS.ERROR, `Błąd podczas usuwania rekordu z ID ${id} z ${filePath}: ${error.message}`);
  if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
  throw createXdbError(`Nie udało się usunąć rekordu z ID ${id} z ${filePath}: ${error.message}`, error.code || XDB_ERROR_CODES.IO_ERROR);
 } finally {
  if (release) release();
 }
}

async function viewAll(filePath) {
 try {
  const descriptor = await getFileDescriptor(filePath);
  if (!descriptor.exists) {
   throw createXdbError(`Plik ${filePath} nie istnieje`, XDB_ERROR_CODES.FILE_NOT_FOUND);
  }
  
  if (filePath.toLowerCase().endsWith('.json')) {
   try {
    const parsedData = await safeParseJSON(filePath);
    return { path: descriptor.fullPath, data: parsedData };
   } catch (error) {
    // Przekazuj oryginalny kod błędu jeśli to błąd JSON
    if (error.code === XDB_ERROR_CODES.INVALID_JSON) {
     throw error;
    }
    throw error;
   }
  } else {
   const data = await descriptor.adapter.read(descriptor);
   return { path: descriptor.fullPath, data, descriptor: descriptor.toJSON() };
  }
 } catch (error) {
  log(LOG_LEVELS.ERROR, `Błąd podczas pobierania danych z ${filePath}: ${error.message}`);
  if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) {
   throw error;
  }
  if (error.code === 'ENOENT') {
   throw createXdbError(`Plik ${filePath} nie istnieje`, XDB_ERROR_CODES.FILE_NOT_FOUND);
  }
  throw createXdbError(`Nie udało się pobrać danych z ${filePath}: ${error.message}`, error.code || XDB_ERROR_CODES.OPERATION_FAILED);
 }
}

async function viewRecordById(filePath, id) {
 try {
  const recordId = String(id);
  validateId(recordId);
  const cachedRecord = getCachedData(filePath, recordId);
  if (cachedRecord !== null) {
   return {
    path: path.resolve(basePath, filePath),
    record: cachedRecord,
    fromCache: true
   };
  }
  filePath = ensureJsonExtension(filePath);
  const fullPath = path.resolve(basePath, filePath);
  const data = await safeParseJSON(filePath);
  if (!Array.isArray(data)) {
   throw createXdbError(`Nie można pobrać rekordu po ID: Plik ${filePath} nie zawiera tablicy JSON.`, XDB_ERROR_CODES.OPERATION_FAILED);
  }
  const record = data.find(record => String(record.id) === recordId);
  if (!record) {
   throw createXdbError(`Rekord z ID ${recordId} nie został znaleziony w ${filePath}.`, XDB_ERROR_CODES.RECORD_NOT_FOUND);
  }
  setCachedData(filePath, record, recordId);
  return { path: fullPath, record };
 } catch (error) {
  log(LOG_LEVELS.ERROR, `Błąd podczas pobierania rekordu z ID ${id} z ${filePath}: ${error.message}`);
  if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
  throw createXdbError(`Nie udało się pobrać rekordu z ID ${id} z ${filePath}: ${error.message}`, error.code || XDB_ERROR_CODES.OPERATION_FAILED);
 }
}

async function viewMore(filePath, options = {}) {
 try {
  filePath = ensureJsonExtension(filePath);
  let data = await safeParseJSON(filePath);
  if (!Array.isArray(data)) {
   throw createXdbError(`Nie można wykonać zapytania: Plik ${filePath} nie zawiera tablicy JSON.`, XDB_ERROR_CODES.OPERATION_FAILED);
  }
  if (options.filter && typeof options.filter === 'function') {
   try {
    data = data.filter(options.filter);
   } catch (filterError) {
    throw createXdbError(`Błąd podczas filtrowania: ${filterError.message}`, XDB_ERROR_CODES.OPERATION_FAILED);
   }
  }
  if (options.sort) {
   const sortCriteria = Array.isArray(options.sort) ? options.sort : [options.sort];
   try {
    data.sort((a, b) => {
     for (const criterion of sortCriteria) {
      const { key, order = 'asc' } = criterion;
      const direction = order.toLowerCase() === 'desc' ? -1 : 1;
      if (!key || typeof key !== 'string') continue;
      const valA = a[key];
      const valB = b[key];
      if (valA === valB) continue;
      if (valA === undefined || valA === null) return 1 * direction;
      if (valB === undefined || valB === null) return -1 * direction;
      if (valA < valB) return -1 * direction;
      if (valA > valB) return 1 * direction;
     }
     return 0;
    });
   } catch (sortError) {
    throw createXdbError(`Błąd podczas sortowania: ${sortError.message}`, XDB_ERROR_CODES.OPERATION_FAILED);
   }
  }
  const skip = options.skip && Number.isInteger(options.skip) && options.skip > 0 ? options.skip : 0;
  const limit = options.limit && Number.isInteger(options.limit) && options.limit > 0 ? options.limit : data.length;
  const paginatedData = data.slice(skip, skip + limit);
  const totalCount = data.length;
  log(LOG_LEVELS.DEBUG, `Pobrano ${paginatedData.length} z ${totalCount} rekordów z ${filePath}`);
  return {
   path: path.resolve(basePath, filePath),
   data: paginatedData,
   meta: {
    total: totalCount,
    skip: skip,
    limit: limit,
    page: Math.floor(skip / limit) + 1,
    totalPages: Math.ceil(totalCount / limit)
   }
  };
 } catch (error) {
  log(LOG_LEVELS.ERROR, `Błąd podczas zapytania do ${filePath}: ${error.message}`);
  if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
  throw createXdbError(`Nie udało się wykonać zapytania do ${filePath}: ${error.message}`, error.code || XDB_ERROR_CODES.OPERATION_FAILED);
 }
}

const xdFiles = {
 config: setConfig,
 dir: {
  add: addDir,
  del: delDir,
  rename: renameDir
 },
 move: {
  file: moveFile
 },
 edit: {
  all: editAll,
  id: editRecordById
 },
 del: {
  all: deleteAll,
  id: deleteRecordById
 },
 add: {
  all: addAll,
  id: addRecordById
 },
 view: {
  all: viewAll,
  id: viewRecordById,
  more: viewMore
 },
 cache: {
  clear: clearAllCache,
  invalidate: invalidateCache
 },
 file: {
  copy: copyFile,
  delete: deleteFile,
  write: writeFile,
  stat,
  descriptor: getFileDescriptor,
  checksum: calculateChecksum,
  chunk,
  watch
 },
 stream: Object.assign(stream, { pipe: streamPipe }),
 query: createQueryBuilder,
 batch: createBatchOperation,
 adapter: {
  register: registerAdapter,
  get: getAdapterForMimeType
 },
 crypto: {
  encrypt,
  decrypt,
  generateKey: () => crypto.randomBytes(32).toString('hex')
 },
 compress: {
  gzip: compress,
  gunzip: decompress
 },
 version: {
  create: createVersion,
  get: getVersion,
  list: (filePath) => versionStore.get(filePath) || []
 },
 index: {
  file: indexFile,
  search: searchIndex,
  clear: () => fileIndex.clear()
 },
 events: {
  on,
  off,
  emit: emitEvent
 },
 utils: {
  generateId,
  detectMimeType,
  ensureDirectoryExists
 }
};

export default xdFiles;


/*
==================================================
Technical Documentation for xdFiles.js
==================================================

### I. Vision & Architecture

xdFiles.js is a comprehensive, zero-dependency file and data management system for Node.js. It is designed to function as a "file-system-as-a-database," providing robust, high-level abstractions for common file operations while offering powerful, database-like features for structured data (primarily JSON).

The architecture is built upon three core principles:
1.  **Atomicity**: Operations that modify files (writes, moves) are atomic, using a temporary-file-and-rename strategy to prevent data corruption from partial writes.
2.  **Concurrency Safety**: An in-memory, promise-based locking mechanism prevents race conditions when multiple asynchronous operations target the same file.
3.  **Extensibility**: An adapter-based pattern allows the library to handle different file formats (JSON, text, binary) in a unified way and enables developers to register custom handlers.

### II. Core Concepts

*   **File Descriptor (`FileDescriptor`)**: The central internal object representing a file. It is an in-memory object that contains not only the file path but also its metadata (stats, MIME type, checksum), the appropriate adapter for its content type, and its existence status. Most internal functions operate on descriptors rather than raw paths.

*   **Adapter Pattern (`Adapters`)**: The mechanism for handling different file types. The library includes default adapters for JSON (`JSONAdapter`), plain text (`TextAdapter`), and binary data (`BinaryAdapter`). Each adapter implements a standard interface for `read()` and `write()` operations. The `JSONAdapter` and `TextAdapter` also support indexing. This pattern makes the system extensible to other formats.

*   **Atomic Operations**: All write operations are performed on a temporary file. Only upon successful completion of the write is the temporary file atomically renamed to the final destination file. This ensures that the target file is never in a partially written or corrupted state.

*   **File Locking**: An internal `fileLocks` map manages access to files. Before an operation begins, it acquires a lock on the file path. Subsequent operations on the same path will wait until the promise-based lock is released, ensuring serial execution for critical sections.

### III. Key Feature Areas

#### 1. Configuration (`xdb.config`)
A single method to configure the library's global behavior, including:
-   `basePath`: The root directory for all relative paths.
-   `logLevel`: Verbosity of console logs (DEBUG, INFO, WARN, ERROR).
-   `cachingEnabled` & `cacheTTL`: In-memory caching for read operations to reduce I/O.
-   `encryptionKey`: An AES-256 key for transparent data encryption/decryption.
-   `compressionEnabled`: Enables automatic Gzip compression for supported data types.
-   `versioningEnabled`: Enables snapshot-based versioning for files.
-   `indexingEnabled`: Enables in-memory indexing for fast full-text search.

#### 2. File System Operations (`xdb.file`, `xdb.dir`, `xdb.move`)
Provides a high-level, promise-based API for filesystem interactions.
-   **File**: `write`, `copy`, `delete`, `stat`, `descriptor`.
-   **Directory**: `add`, `del`, `rename`.
-   **Move**: `move.file` to relocate files.

#### 3. Structured Data (JSON) Operations (`xdb.add`, `xdb.view`, `xdb.edit`, `xdb.del`)
Treats JSON files as data collections, providing a rich, record-oriented API.
-   `add.id` / `add.all`: Adds records, with automatic unique ID generation and duplicate-ID checks.
-   `view.id` / `view.all`: Retrieves a single record or the entire collection.
-   `view.more`: A powerful method for server-side-style filtering, sorting, and pagination of records.
-   `edit.id` / `edit.all`: Updates records by ID or replaces the entire dataset.
-   `del.id` / `del.all`: Deletes specific records or clears the entire collection.

#### 4. Advanced Data Retrieval (`xdb.query`)
-   **Query Builder**: A fluent interface (`.where().select().order().limit()`) for constructing complex queries against JSON data. It supports various operators (`=`, `>`, `like`, `in`) and allows for precise data retrieval, similar to a database query language.

#### 5. Advanced Features
-   **Streaming (`xdb.stream`)**: Efficiently handles large files using Node.js streams. Provides `read()`, `write()`, and a `pipe()` utility that supports `Transform` streams for on-the-fly data manipulation.
-   **Batch Operations (`xdb.batch`)**: Executes a sequence of file operations as a single atomic transaction. If any operation in the batch fails, all preceding operations are automatically rolled back, ensuring data consistency.
-   **Versioning (`xdb.version`)**: When enabled, allows creating and retrieving snapshots (`versions`) of a file's state at different points in time.
-   **Indexing (`xdb.index`)**: Builds an in-memory index of file contents (words from text, values from JSON) to enable fast, full-text `search()` capabilities.
-   **Cryptography & Compression (`xdb.crypto`, `xdb.compress`)**: Utility modules for on-demand data encryption and Gzip compression.

#### 6. Internal Systems & Utilities
-   **Event System (`xdb.events`)**: A simple pub/sub system (`on`, `off`, `emit`) that fires events for key operations like `write`, `delete`, and `copy`, allowing developers to hook into the library's lifecycle.
-   **Error Handling**: Uses a standardized error system with unique codes (e.g., `XDB_FILE_NOT_FOUND`) for predictable and robust error handling.
-   **Utilities (`xdb.utils`)**: A collection of helper functions, including `generateId`, `detectMimeType`, and `ensureDirectoryExists`.


==================================================
EXAMPLES FOR xdFiles.js
==================================================

import xdb from './xdFiles.js';
import { Transform } from 'node:stream';

(async () => {
  try {
    // 1. Configuration
    await xdb.config({
      basePath: './database',
      logLevel: 'INFO',
      cachingEnabled: true,
      encryptionKey: xdb.crypto.generateKey(),
      compressionEnabled: true,
      versioningEnabled: true,
      indexingEnabled: true
    });

    // 2. JSON Data Operations (CRUD)
    const usersFile = 'users.json';
    const { record: user1 } = await xdb.add.id(usersFile, { name: 'Alice', age: 30 });
    const { record: user2 } = await xdb.add.id(usersFile, { name: 'Bob', age: 25 });
    const { record: foundUser } = await xdb.view.id(usersFile, user1.id);
    await xdb.edit.id(usersFile, user1.id, { age: 31, city: 'New York' });
    await xdb.del.id(usersFile, user2.id);
    const { data: allUsers } = await xdb.view.all(usersFile);
    const { data: filteredUsers } = await xdb.view.more(usersFile, {
      filter: r => r.age > 30,
      sort: [{ key: 'name', order: 'asc' }],
      limit: 10
    });

    // 3. Basic File Operations
    await xdb.file.write('report.txt', 'This is a test report.');
    const { data: reportContent } = await xdb.view.all('report.txt');
    const fileStats = await xdb.file.stat('report.txt');
    const descriptor = await xdb.file.descriptor('report.txt');
    await xdb.file.copy('report.txt', 'report_copy.txt');
    await xdb.move.file('report_copy.txt', 'archive/report_final.txt');
    await xdb.file.delete('report.txt');

    // 4. Directory Operations
    await xdb.dir.add('project/assets');
    await xdb.dir.rename('project/assets', 'project/resources');
    await xdb.dir.del('project/resources');

    // 5. Advanced Queries (Query Builder)
    const productsFile = 'products.json';
    await xdb.add.all(productsFile, [
      { id: 'p1', name: 'Laptop', price: 1200, category: 'Electronics' },
      { id: 'p2', name: 'Mouse', price: 25, category: 'Electronics' },
      { id: 'p3', name: 'Keyboard', price: 75, category: 'Electronics' }
    ]);
    const expensiveElectronics = await xdb.query()
      .where('category', '=', 'Electronics')
      .where('price', '>', 50)
      .select(['name', 'price'])
      .order('price', 'desc')
      .execute(productsFile);

    // 6. Streaming Operations
    await xdb.file.write('input.txt', 'hello world');
    const readStream = await xdb.stream('input.txt').read();
    const writeStream = await xdb.stream('output.txt').write();
    const upperCaseTransform = new Transform({
      transform(chunk, encoding, callback) {
        callback(null, chunk.toString().toUpperCase());
      }
    });
    await xdb.stream.pipe('input.txt', 'transformed_output.txt', upperCaseTransform);

    // 7. Batch Operations (Transactional)
    const batchResults = await xdb.batch()
      .copy('users.json', 'users_backup.json')
      .write('log.txt', 'Backup created.')
      .delete('users.json')
      .commit();

    // 8. Event System
    const writeHandler = (file) => console.log(`File written: ${file}`);
    xdb.events.on('write', writeHandler);
    await xdb.file.write('event_log.txt', 'Event test data.');
    xdb.events.off('write', writeHandler); // Clean up event listener

    // 9. Encryption
    await xdb.config({ encryptionKey: xdb.crypto.generateKey() });
    const encryptedData = await xdb.crypto.encrypt(Buffer.from('Sensitive Info'));
    const decryptedData = await xdb.crypto.decrypt(encryptedData);

    // 10. Compression
    const originalBuffer = Buffer.from('Compressible data '.repeat(100));
    const compressedBuffer = await xdb.compress.gzip(originalBuffer);
    const decompressedBuffer = await xdb.compress.gunzip(compressedBuffer);

    // 11. Versioning
    await xdb.config({ versioningEnabled: true });
    await xdb.add.all('versioned_data.json', [{ value: 'initial' }]);
    const v1Id = await xdb.version.create('versioned_data.json');
    await xdb.edit.id('versioned_data.json', '1', { value: 'updated' });
    const v1 = await xdb.version.get('versioned_data.json', v1Id); // Get initial version

    // 12. Indexing and Search
    await xdb.config({ indexingEnabled: true });
    await xdb.file.write('document.txt', 'Lorem ipsum dolor sit amet.');
    await xdb.index.file('document.txt');
    const searchResults = await xdb.index.search('lorem');

  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    // Optional: Cleanup test data
    // await xdb.utils.ensureDirectoryExists('./database'); // Ensure base path exists for cleanup
    // await fs.rm('./database', { recursive: true, force: true });
  }
})();
*/
