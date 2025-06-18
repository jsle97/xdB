/* xdb-nano library
 * Status: Private prototype
 * License: MIT
 * ------------------------------------------------------------------------------
 * Copyright (c) 2025 Jakub Śledzikowski <jsledzikowski.web@gmail.com>
 *
 */
import fs from "fs/promises";
import path from "path";

let basePath = process.cwd();
const fileLocks = new Map();
const LOCK_TIMEOUT = 5000;

const xdTok = (function () { const n = (() => { let n = -1, t = 0; const r = 36, u = 9, f = 4, e = 3, o = u + f + e, s = r ** e - 1, i = n => { if (n <= 0) return ""; const t = typeof window != "undefined" && window.crypto && window.crypto.getRandomValues; if (t) { const t = new Uint8Array(n); window.crypto.getRandomValues(t); return Array.from(t, n => "0123456789abcdefghijklmnopqrstuvwxyz"[n % r]).join("") } let u = ""; for (let t = 0; t < n; t++)u += Math.floor(Math.random() * r).toString(r); return u }, a = (n, t) => n.toString(r).padStart(t, "0"), h = (() => { const n = i(f); if (typeof process != "undefined" && process.pid) { const t = process.pid.toString(r); return (t + n).slice(-f) } return n })(); return r => { r = typeof r == "number" ? Math.floor(r) : o; if (r < 6 || r > 96) throw new Error("Token length must be between 6 and 96 characters."); const u = Date.now(); u < n ? console.warn(`Clock went back: ${u} < ${n}. Instance: ${h}. Strict monotonicity broken.`) : u > n && (n = u, t = 0), t > s && (console.warn(`Counter overflow detected at timestamp ${n}. Instance: ${h}. Resetting counter. Collision risk increases slightly if overflow happens frequently.`), t = 0); const f = t++, c = a(u, e), l = a(f, e), p = c + h + l, d = r - o; return d >= 0 ? p + i(d) : p.slice(0, r) } })(); return n })();

function generateId() {
  try {
    return xdTok(64);
  } catch (err) {
    const timestamp = Date.now().toString(36);
    let random = '';
    while (random.length < 64) {
      random += Math.random().toString(36).substring(2);
    }
    return (timestamp + random).slice(0, 64);
  }
}

async function acquireLock(filePath, timeout = LOCK_TIMEOUT) {
  const fullPath = path.resolve(basePath, filePath);
  const start = Date.now();

  while (fileLocks.has(fullPath)) {
    if (Date.now() - start > timeout) {
      throw new Error(`Lock timeout for ${filePath}`);
    }
    await fileLocks.get(fullPath);
  }

  let release;
  const lockPromise = new Promise(resolve => {
    release = resolve;
  });

  fileLocks.set(fullPath, lockPromise);
  return () => {
    if (release) release();
    fileLocks.delete(fullPath);
  };
}

function ensureJsonExtension(filePath) {
  return filePath.toLowerCase().endsWith('.json') ? filePath : filePath + '.json';
}

async function ensureDirectory(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
}

async function safeParseJSON(filePath) {
  const fullPath = path.resolve(basePath, filePath);
  try {
    const data = await fs.readFile(fullPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    if (error instanceof SyntaxError) throw new Error(`Invalid JSON in ${filePath}`);
    throw error;
  }
}

async function atomicWrite(filePath, data) {
  const fullPath = path.resolve(basePath, filePath);
  const tempPath = fullPath + '.tmp' + Date.now();

  try {
    await ensureDirectory(path.dirname(fullPath));
    await fs.writeFile(tempPath, JSON.stringify(data), 'utf-8');
    await fs.rename(tempPath, fullPath);
  } catch (error) {
    try {
      await fs.unlink(tempPath);
    } catch { }
    throw error;
  }
}

async function addRecordById(filePath, record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error('Record must be an object');
  }

  filePath = ensureJsonExtension(filePath);
  const release = await acquireLock(filePath);

  try {
    const data = await safeParseJSON(filePath);
    if (!Array.isArray(data)) {
      throw new Error(`File ${filePath} is not an array`);
    }

    const newRecord = { ...record };
    if (!newRecord.id) {
      newRecord.id = generateId();
      let attempts = 0;
      while (data.some(r => r.id === newRecord.id) && attempts++ < 10) {
        newRecord.id = generateId();
      }
    } else {
      newRecord.id = String(newRecord.id);
      let attempts = 0;
      while (data.some(r => String(r.id) === newRecord.id) && attempts++ < 10) {
        newRecord.id = generateId();
      }
    }

    data.push(newRecord);
    await atomicWrite(filePath, data);
    return newRecord;
  } finally {
    release();
  }
}

async function editRecordById(filePath, id, updates) {
  if (!id) throw new Error('ID is required');
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    throw new Error('Updates must be an object');
  }

  filePath = ensureJsonExtension(filePath);
  const recordId = String(id);
  const release = await acquireLock(filePath);

  try {
    const data = await safeParseJSON(filePath);
    if (!Array.isArray(data)) {
      throw new Error(`File ${filePath} is not an array`);
    }

    const index = data.findIndex(r => String(r.id) === recordId);
    if (index === -1) {
      throw new Error(`Record with ID ${recordId} not found`);
    }

    data[index] = { ...data[index], ...updates, id: data[index].id };
    await atomicWrite(filePath, data);
    return data[index];
  } finally {
    release();
  }
}

async function deleteRecordById(filePath, id) {
  if (!id) throw new Error('ID is required');

  filePath = ensureJsonExtension(filePath);
  const recordId = String(id);
  const release = await acquireLock(filePath);

  try {
    const data = await safeParseJSON(filePath);
    if (!Array.isArray(data)) {
      throw new Error(`File ${filePath} is not an array`);
    }

    const filteredData = data.filter(r => String(r.id) !== recordId);
    if (data.length === filteredData.length) {
      throw new Error(`Record with ID ${recordId} not found`);
    }

    await atomicWrite(filePath, filteredData);
    return recordId;
  } finally {
    release();
  }
}

async function viewAll(filePath) {
  filePath = ensureJsonExtension(filePath);
  return await safeParseJSON(filePath);
}

async function viewRecordById(filePath, id) {
  if (!id) throw new Error('ID is required');

  filePath = ensureJsonExtension(filePath);
  const recordId = String(id);
  const data = await safeParseJSON(filePath);

  if (!Array.isArray(data)) {
    throw new Error(`File ${filePath} is not an array`);
  }

  const record = data.find(r => String(r.id) === recordId);
  if (!record) {
    throw new Error(`Record with ID ${recordId} not found`);
  }

  return record;
}

const xdbNano = {
  setBasePath: (newPath) => {
    basePath = path.resolve(newPath);
  },
  add: {
    id: addRecordById
  },
  edit: {
    id: editRecordById
  },
  del: {
    id: deleteRecordById
  },
  view: {
    all: viewAll,
    id: viewRecordById
  }
};

export default xdbNano;

/*

Technical documentation for xdbNano.js

Description:
- xdbNano.js is a simplified version of a JSON file-based database library.
- It supports CRUD operations: create, read, update, delete records.
- Uses Node.js built-in modules fs/promises and path.

Key functions:
1. generateId - generates a unique identifier for a record. Handles fallback if generation fails.
2. acquireLock - implements file locking mechanism to ensure safe write operations. Uses a lock map and timeout.
3. ensureJsonExtension - appends .json extension to file paths if missing.
4. safeParseJSON - safely reads and parses JSON files; handles errors like missing file or invalid JSON.
5. atomicWrite - writes data atomically by writing to a temporary file and then renaming it.
6. addRecordById, editRecordById, deleteRecordById, viewAll, viewRecordById - CRUD functions operating on JSON files.

Technical notes:
- Error handling via throwing exceptions with detailed messages.
- Unique ID generation based on timestamp and randomness.
- Locking mechanism prevents concurrent file access, minimizing data corruption risk.
- No external dependencies; uses only Node.js built-in modules.
*/