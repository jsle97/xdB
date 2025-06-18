/* xdB.js library - a lightweight, but incredibly powerful, JSON database for Node.js
 * Status: Private prototype
 * License: MIT
 * Dependencies:
 *   - fs/promises: Provides asynchronous file system APIs for reading and writing files.
 *   - path: Handles and transforms file paths.
 *   - url: (Specifically, fileURLToPath) Converts file URLs to file paths.
 *   - events: (EventEmitter) Manages the internal event system.
 *   - fs (synchronous version): Used for operations like creating log streams.
 * ------------------------------------------------------------------------------
 * Copyright (c) 2025 Jakub Śledzikowski <jsledzikowski.web@gmail.com>
 *
 */
import fs from "fs/promises";
import path2 from "path";
import { fileURLToPath } from "url";
import EventEmitter from "events";
import fsSync from "fs";
var LOG_LEVELS = { DEBUG: 10, INFO: 20, WARN: 30, ERROR: 40, NONE: 99 };
var _base36 = "0123456789abcdefghijklmnopqrstuvwxyz";
var _base62 = _base36 + "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
var _yolo = _base62 + "+/=~!@#$%^&*()[]{},.<>?|";
var DEFAULT_XDB_ID_LENGTH = 16;
var DEFAULT_LOCK_TIMEOUT = 5e3;
var CUSTOM_ERROR_FILE = "xdb_error_list.json";
var XDB_ERROR_CODES = { FILE_NOT_FOUND: "XDB_FILE_NOT_FOUND", DIR_NOT_FOUND: "XDB_DIR_NOT_FOUND", IO_ERROR: "XDB_IO_ERROR", INVALID_JSON: "XDB_INVALID_JSON", RECORD_NOT_FOUND: "XDB_RECORD_NOT_FOUND", RECORD_EXISTS: "XDB_RECORD_EXISTS", OPERATION_FAILED: "XDB_OPERATION_FAILED", INVALID_CONFIG: "XDB_INVALID_CONFIG", INVALID_SCHEMA: "XDB_INVALID_SCHEMA" };
var _emitter = new EventEmitter();
var on = (eventName, listener) => {
  if (typeof listener !== "function") {
    console.error(`[xdB.on] Listener for event "${eventName}" must be a function.`);
    return;
  }
  _emitter.on(eventName, listener);
};
var off = (eventName, listener) => {
  if (typeof listener !== "function") {
    return;
  }
  _emitter.off(eventName, listener);
};
var _emit = (eventName, data) => {
  setTimeout(() => {
    try {
      _emitter.emit(eventName, data);
    } catch (error) {
      console.error(`[xdB Hook Emit Error] Error emitting event "${eventName}":`, error);
    }
  }, 0);
};
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
var basePath = __dirname;
var enableBackup = false;
var backupExtension = ".bak";
var backupOnWriteOnly = true;
var backupOnAdd = false;
var backupOnEdit = false;
var backupOnDelete = false;
var indexConfig = {};
var relationDefinitions = {};
var enableRelationCache = false;
var relationCacheTTL = 3e5;
var relationCache = new Map();
var currentLogLevel = LOG_LEVELS.INFO;
var logFilePath = null;
var logFileStream = null;
var logLevelMap = Object.fromEntries(Object.entries(LOG_LEVELS).map(([k, v]) => [v, k]));
var customErrorMessages = {};
var schemaDefinitions = {};
var enableSchemaValidation = false;
var _loadCustomErrors = async () => {
  const errorFilePath = path2.resolve(getBasePath(), CUSTOM_ERROR_FILE);
  try {
    const data = await fs.readFile(errorFilePath, "utf-8");
    customErrorMessages = JSON.parse(data);
    _log(LOG_LEVELS.INFO, `Successfully loaded custom error messages from ${CUSTOM_ERROR_FILE}`);
  } catch (error) {
    if (error.code === "ENOENT") {
      _log(LOG_LEVELS.INFO, `Custom error file not found at ${errorFilePath}. Using default errors only.`);
      customErrorMessages = {};
    } else if (error instanceof SyntaxError) {
      _log(LOG_LEVELS.ERROR, `Failed to parse custom error file ${errorFilePath}: ${error.message}. Using default errors only.`);
      customErrorMessages = {};
    } else {
      _log(LOG_LEVELS.ERROR, `Failed to read custom error file ${errorFilePath}: ${error.message}. Using default errors only.`);
      customErrorMessages = {};
    }
  }
};
_loadCustomErrors();
var _closeLogStream = async () => {
  if (logFileStream) {
    try {
      await new Promise((resolve, reject) => {
        logFileStream.end((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      logFileStream = null;
    } catch (err) {
      console.error(`xdB Error: Failed to close log file stream for ${logFilePath}:`, err);
      logFileStream = null;
    }
  }
};
var _createLogStream = (filePath) => {
  try {
    const dir = path2.dirname(filePath);
    if (!fsSync.existsSync(dir)) {
      fsSync.mkdirSync(dir, { recursive: true });
    }
    logFileStream = fsSync.createWriteStream(filePath, { flags: "a" });
    logFileStream.on("error", (err) => {
      console.error(`xdB Error: Log file stream error for ${filePath}:`, err);
      logFileStream = null;
      logFilePath = null;
    });
  } catch (err) {
    console.error(`xdB Error: Failed to create log file stream for ${filePath}:`, err);
    logFileStream = null;
    logFilePath = null;
  }
};
async function setConfig(optionsOrPath) {
  let options = {};
  let loadedFromFile = false;
  if (typeof optionsOrPath === "string") {
    const configPath = path2.resolve(getBasePath(), optionsOrPath);
    _log(LOG_LEVELS.INFO, `Attempting to load configuration from file: ${configPath}`);
    try {
      const fileContent = await fs.readFile(configPath, "utf-8");
      options = JSON.parse(fileContent);
      loadedFromFile = true;
      _log(LOG_LEVELS.INFO, `Successfully loaded configuration from ${configPath}`);
    } catch (error) {
      if (error.code === "ENOENT") {
        _log(LOG_LEVELS.ERROR, `Configuration file not found at ${configPath}. Using default/existing settings.`);
      } else if (error instanceof SyntaxError) {
        _log(LOG_LEVELS.ERROR, `Failed to parse configuration file ${configPath}: ${error.message}. Using default/existing settings.`);
      } else {
        _log(LOG_LEVELS.ERROR, `Failed to read configuration file ${configPath}: ${error.message}. Using default/existing settings.`);
      }
      options = {};
    }
  } else if (typeof optionsOrPath === "object" && optionsOrPath !== null) {
    options = optionsOrPath;
  } else if (optionsOrPath !== void 0 && optionsOrPath !== null) {
    _log(LOG_LEVELS.WARN, `Invalid input type for setConfig: Expected object or string path, got ${typeof optionsOrPath}. Ignoring.`);
    return;
  }
  if (options.basePath) {
    const newBasePath = path2.resolve(options.basePath);
    if (newBasePath !== basePath) {
      _log(LOG_LEVELS.INFO, `Setting basePath to: ${newBasePath}`);
      basePath = newBasePath;
      if (loadedFromFile) {
        await _loadCustomErrors();
      }
    }
  }
  if (options.enableBackup !== void 0) {
    if (typeof options.enableBackup !== "boolean") {
      console.warn(`xdB Warning: Invalid type for enableBackup option. Expected boolean, got ${typeof options.enableBackup}. Defaulting to false.`);
      enableBackup = false;
    } else {
      enableBackup = options.enableBackup;
    }
  }
  if (options.backupExtension !== void 0) {
    if (typeof options.backupExtension !== "string" || options.backupExtension.length === 0) {
      console.warn(`xdB Warning: Invalid type or empty string for backupExtension option. Expected non-empty string, got '${options.backupExtension}'. Using default "${backupExtension}".`);
    } else {
      backupExtension = options.backupExtension.startsWith(".") ? options.backupExtension : "." + options.backupExtension;
    }
  }
  if (options.backupOnWriteOnly !== void 0) {
    if (typeof options.backupOnWriteOnly !== "boolean") {
      console.warn(`xdB Warning: Invalid type for backupOnWriteOnly option. Expected boolean, got ${typeof options.backupOnWriteOnly}. Using default ${backupOnWriteOnly}.`);
    } else {
      backupOnWriteOnly = options.backupOnWriteOnly;
    }
  }
  if (options.backupOnAdd !== void 0) {
    if (typeof options.backupOnAdd !== "boolean") {
      console.warn(`xdB Warning: Invalid type for backupOnAdd option. Expected boolean, got ${typeof options.backupOnAdd}. Using default ${backupOnAdd}.`);
    } else {
      backupOnAdd = options.backupOnAdd;
    }
  }
  if (options.backupOnEdit !== void 0) {
    if (typeof options.backupOnEdit !== "boolean") {
      console.warn(`xdB Warning: Invalid type for backupOnEdit option. Expected boolean, got ${typeof options.backupOnEdit}. Using default ${backupOnEdit}.`);
    } else {
      backupOnEdit = options.backupOnEdit;
    }
  }
  if (options.backupOnDelete !== void 0) {
    if (typeof options.backupOnDelete !== "boolean") {
      console.warn(`xdB Warning: Invalid type for backupOnDelete option. Expected boolean, got ${typeof options.backupOnDelete}. Using default ${backupOnDelete}.`);
    } else {
      backupOnDelete = options.backupOnDelete;
    }
  }
  if (options.logLevel !== void 0) {
    const requestedLevelName = typeof options.logLevel === "string" ? options.logLevel.toUpperCase() : null;
    const requestedLevelNum = typeof options.logLevel === "number" ? options.logLevel : null;
    if (requestedLevelNum !== null && LOG_LEVELS[logLevelMap[requestedLevelNum]]) {
      currentLogLevel = requestedLevelNum;
    } else if (requestedLevelName && LOG_LEVELS[requestedLevelName]) {
      currentLogLevel = LOG_LEVELS[requestedLevelName];
    } else {
      console.warn(`xdB Warning: Invalid logLevel option: '${options.logLevel}'. Using default level ${logLevelMap[currentLogLevel]}. Valid levels: ${Object.keys(LOG_LEVELS).join(", ")} or their numeric values.`);
    }
  }
  if (options.logFilePath !== void 0) {
    const newLogPath = options.logFilePath === null ? null : path2.resolve(options.logFilePath);
    if (newLogPath !== logFilePath) {
      _closeLogStream().then(() => {
        logFilePath = newLogPath;
        if (logFilePath) {
          _createLogStream(logFilePath);
        }
      }).catch((err) => {
      });
    }
  }
  if (options.indexes !== void 0) {
    if (typeof options.indexes === "object" && options.indexes !== null && !Array.isArray(options.indexes)) {
      const validatedIndexes = {};
      let isValid = true;
      for (const filePath in options.indexes) {
        if (typeof filePath !== "string") {
          console.warn(`xdB Warning: Invalid key in indexes configuration. Expected string file path, got ${typeof filePath}. Skipping.`);
          isValid = false;
          continue;
        }
        const fields = options.indexes[filePath];
        if (!Array.isArray(fields) || !fields.every((f) => typeof f === "string" && f.length > 0)) {
          console.warn(`xdB Warning: Invalid value for file path "${filePath}" in indexes configuration. Expected an array of non-empty strings, got ${JSON.stringify(fields)}. Skipping.`);
          isValid = false;
          continue;
        }
        const normalizedPath = ensureJsonExtension(filePath);
        validatedIndexes[normalizedPath] = [...new Set(fields)];
      }
      if (isValid) {
        indexConfig = validatedIndexes;
      } else {
        console.warn("xdB Warning: Some errors encountered during index configuration validation. Only valid entries were loaded.");
        indexConfig = validatedIndexes;
      }
    } else {
      console.warn(`xdB Warning: Invalid type for indexes option. Expected an object, got ${typeof options.indexes}. Index configuration not loaded.`);
      indexConfig = {};
    }
  }
  if (options.enableRelationCache !== void 0) {
    if (typeof options.enableRelationCache !== "boolean") {
      console.warn(`xdB Warning: Invalid type for enableRelationCache option. Expected boolean, got ${typeof options.enableRelationCache}. Using default ${enableRelationCache}.`);
    } else {
      enableRelationCache = options.enableRelationCache;
      if (!enableRelationCache) {
        clearRelationCache();
      }
    }
  }
  if (options.relationCacheTTL !== void 0) {
    if (typeof options.relationCacheTTL !== "number" || options.relationCacheTTL < 0) {
      console.warn(`xdB Warning: Invalid type or value for relationCacheTTL option. Expected non-negative number, got ${options.relationCacheTTL}. Using default ${relationCacheTTL}.`);
    } else {
      relationCacheTTL = options.relationCacheTTL;
    }
  }
  if (options.enableSchemaValidation !== void 0) {
    if (typeof options.enableSchemaValidation !== "boolean") {
      _log(LOG_LEVELS.WARN, `Invalid type for enableSchemaValidation option. Expected boolean, got ${typeof options.enableSchemaValidation}. Using default ${enableSchemaValidation}.`);
    } else {
      enableSchemaValidation = options.enableSchemaValidation;
    }
  }
  if (options.schemas !== void 0) {
    if (typeof options.schemas === "object" && options.schemas !== null && !Array.isArray(options.schemas)) {
      const validatedSchemas = {};
      let schemasValid = true;
      for (const filePath in options.schemas) {
        if (typeof filePath !== "string") {
          _log(LOG_LEVELS.WARN, `Invalid key in schemas configuration. Expected string file path, got ${typeof filePath}. Skipping.`);
          schemasValid = false;
          continue;
        }
        if (typeof options.schemas[filePath] !== "object" || options.schemas[filePath] === null || Array.isArray(options.schemas[filePath])) {
          _log(LOG_LEVELS.WARN, `Invalid schema definition for file path "${filePath}". Expected an object, got ${typeof options.schemas[filePath]}. Skipping.`);
          schemasValid = false;
          continue;
        }
        const normalizedPath = ensureJsonExtension(filePath);
        validatedSchemas[normalizedPath] = options.schemas[filePath];
      }
      schemaDefinitions = validatedSchemas;
      if (!schemasValid) {
        _log(LOG_LEVELS.WARN, "Some errors encountered during schema configuration validation. Only valid entries were loaded.");
      }
      _log(LOG_LEVELS.INFO, `Loaded ${Object.keys(schemaDefinitions).length} schema definitions.`);
    } else {
      _log(LOG_LEVELS.WARN, `Invalid type for schemas option. Expected an object, got ${typeof options.schemas}. Schema definitions not loaded.`);
      schemaDefinitions = {};
    }
  }
}
function getBasePath() {
  return basePath;
}
function isBackupEnabled() {
  return enableBackup;
}
function getBackupExtension() {
  return backupExtension;
}
function isRelationCacheEnabled() {
  return enableRelationCache;
}
function getRelationCacheTTL() {
  return relationCacheTTL;
}
function getRelationCache() {
  return relationCache;
}
function clearRelationCache() {
  if (relationCache.size > 0) {
    relationCache.clear();
  }
}
function isBackupOnWriteOnly() {
  return backupOnWriteOnly;
}
function isBackupOnAddEnabled() {
  return enableBackup && !backupOnWriteOnly && backupOnAdd;
}
function isBackupOnEditEnabled() {
  return enableBackup && !backupOnWriteOnly && backupOnEdit;
}
function isBackupOnDeleteEnabled() {
  return enableBackup && !backupOnWriteOnly && backupOnDelete;
}
function getIndexConfigForFile(filePath) {
  const normalizedPath = ensureJsonExtension(filePath);
  return indexConfig[normalizedPath] || [];
}
function createXdbError(messageOrCode, fallbackCode = XDB_ERROR_CODES.OPERATION_FAILED, context = {}) {
  let finalMessage = messageOrCode;
  let finalCode = fallbackCode;
  if (typeof messageOrCode === "string" && customErrorMessages[messageOrCode]) {
    finalMessage = customErrorMessages[messageOrCode];
    finalCode = messageOrCode;
    try {
      finalMessage = finalMessage.replace(/\{(\w+)\}/g, (match, key) => {
        return context.hasOwnProperty(key) ? String(context[key]) : match;
      });
    } catch (replaceError) {
      _log(LOG_LEVELS.ERROR, `Error replacing placeholders in custom error message for code ${finalCode}: ${replaceError.message}`);
      finalMessage = customErrorMessages[messageOrCode];
    }
  } else if (typeof messageOrCode !== "string") {
    _log(LOG_LEVELS.WARN, `createXdbError called with non-string messageOrCode: ${typeof messageOrCode}. Using default fallback.`);
    finalMessage = `Operation failed (Input type: ${typeof messageOrCode})`;
    finalCode = fallbackCode;
  }
  const error = new Error(finalMessage);
  error.code = finalCode;
  return error;
}
function _log(level, message, ...args) {
  if (level < currentLogLevel || currentLogLevel === LOG_LEVELS.NONE) {
    return;
  }
  const levelName = logLevelMap[level] || "LOG";
  const timestamp = (new Date()).toISOString();
  const formattedMessage = `[${timestamp}] [${levelName}] ${message}`;
  const consoleArgs = args.length > 0 ? [formattedMessage, ...args] : [formattedMessage];
  switch (level) {
    case LOG_LEVELS.DEBUG:
      console.debug(...consoleArgs);
      break;
    case LOG_LEVELS.WARN:
      console.warn(...consoleArgs);
      break;
    case LOG_LEVELS.ERROR:
      console.error(...consoleArgs);
      break;
    case LOG_LEVELS.INFO:
    default:
      console.log(...consoleArgs);
      break;
  }
  if (logFilePath && logFileStream && logFileStream.writable) {
    const fileArgsString = args.map((arg) => {
      try {
        if (arg instanceof Error) {
          return `Error: ${arg.message}${arg.stack ? `\nStack: ${arg.stack}` : ""}`;
        }
        if (typeof arg === "object" && arg !== null) {
          return JSON.stringify(arg, null, 2);
        }
        return String(arg);
      } catch (e) {
        return "[Unserializable Argument]";
      }
    }).join(" ");
    const logEntry = `${formattedMessage}${fileArgsString ? " " + fileArgsString : ""}\n`;
    logFileStream.write(logEntry, (err) => {
      if (err) {
      }
    });
  }
}
var fileLocks = new Map();
async function acquireLock(filePath, timeout = DEFAULT_LOCK_TIMEOUT) {
  const fullPath = path2.resolve(getBasePath(), filePath);
  const start = Date.now();
  while (fileLocks.has(fullPath)) {
    if (Date.now() - start > timeout) {
      throw createXdbError(`Timeout acquiring lock for ${filePath} after ${timeout}ms`, XDB_ERROR_CODES.OPERATION_FAILED);
    }
    await fileLocks.get(fullPath);
  }
  let release;
  const lockPromise = new Promise((resolve) => {
    release = resolve;
  });
  fileLocks.set(fullPath, lockPromise);
  return () => releaseLock(fullPath, release);
}
function releaseLock(fullPath, release) {
  if (fileLocks.has(fullPath)) {
    if (release) {
      release();
    }
    fileLocks.delete(fullPath);
  }
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
      throw createXdbError(`[ensureDirectoryExists] Error creating directory ${dirPath}: ${error.message}`, XDB_ERROR_CODES.IO_ERROR);
    }
  }
}
async function ensureIndexDirectoryExists() {
  const indexDirPath = path2.join(getBasePath(), "index");
  try {
    await ensureDirectoryExists(indexDirPath);
  } catch (error) {
    if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
    throw createXdbError(`[ensureIndexDirectoryExists] Error ensuring index directory ${indexDirPath}: ${error.message}`, XDB_ERROR_CODES.IO_ERROR);
  }
}
async function safeParseJSON(filePath) {
  const fullPath = path2.resolve(getBasePath(), filePath);
  try {
    const data = await fs.readFile(fullPath, "utf-8");
    try {
      return JSON.parse(data);
    } catch (parseError) {
      throw createXdbError(`[safeParseJSON] Invalid JSON in file ${filePath}: ${parseError.message}`, XDB_ERROR_CODES.INVALID_JSON);
    }
  } catch (readError) {
    if (readError.code === "ENOENT") {
      return [];
    }
    throw createXdbError(`[safeParseJSON] Error reading file ${filePath}: ${readError.message}`, XDB_ERROR_CODES.IO_ERROR);
  }
}
async function cleanupTempFile(tempPath) {
  if (!tempPath) return;
  try {
    await fs.unlink(tempPath);
  } catch (e) {
    if (e.code !== "ENOENT") {
      _log(LOG_LEVELS.WARN, `Cleanup Warning: Failed to delete temporary file ${tempPath}: ${e.message}`);
    }
  }
}
async function atomicWrite(filePath, data) {
  const fullPath = path2.resolve(getBasePath(), filePath);
  let tempPath;
  let fileHandle;
  try {
    if (isBackupEnabled() && isBackupOnWriteOnly()) {
      await createBackupIfNeeded(fullPath);
    }
    tempPath = fullPath + ".tmp" + Date.now() + Math.random();
    await ensureDirectoryExists(path2.dirname(fullPath));
    fileHandle = await fs.open(tempPath, "w");
    await fileHandle.writeFile(data, "utf-8");
    await fileHandle.sync();
    await fileHandle.close();
    await fs.rename(tempPath, fullPath);
  } catch (error) {
    if (fileHandle) {
      try {
        await fileHandle.close();
      } catch (closeError) {
        _log(LOG_LEVELS.WARN, `Warning: Failed to close temporary file handle for ${tempPath}: ${closeError.message}`);
      }
    }
    await cleanupTempFile(tempPath);
    throw createXdbError(`[atomicWrite] Atomic write to ${filePath} failed: ${error.message}`, XDB_ERROR_CODES.IO_ERROR);
  }
}
var _rand = (l, c) => {
  let o = "";
  for (; o.length < l; ) o += Math.random().toString(36).slice(2);
  return [...o].map(() => c[Math.floor(Math.random() * c.length)]).slice(0, l).join("");
};
var _xdToken = (() => {
  let c = 0, t = 0, e = 17e11, n = typeof process != "undefined" && process.pid ? (process.pid % 1296).toString(36).padStart(2, "0") : Math.floor(Math.random() * 1296).toString(36).padStart(2, "0");
  return (l) => {
    if (![8, 12, 16, 24, 32].includes(l)) throw new Error(`_xdToken: Invalid length ${l}. Valid lengths: 8, 12, 16, 24, 32`);
    let d = Math.floor((Date.now() - e) / 1e3);
    d !== t && (c = 0, t = d);
    let s = (d % 46656).toString(36).padStart(3, "0"), k = (c++ % 46656).toString(36).padStart(3, "0"), b = s + n + k, f = Math.max(0, l - b.length);
    return (b + _rand(f, _base36)).slice(0, l);
  };
})();
function validateId(id) {
  if (typeof id !== "string" || id.length === 0) {
    throw createXdbError(`Invalid ID: ID must be a non-empty string. Received: ${id}`, XDB_ERROR_CODES.OPERATION_FAILED);
  }
}
function validateRecord(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw createXdbError("Record must be a non-null object.", XDB_ERROR_CODES.OPERATION_FAILED);
  }
}
async function createBackupIfNeeded(fullPath) {
  if (!isBackupEnabled()) {
    return;
  }
  try {
    await fs.stat(fullPath);
    const backupPath = fullPath + getBackupExtension();
    await fs.copyFile(fullPath, backupPath);
  } catch (backupError) {
    if (backupError.code === "ENOENT") {
    } else {
      _log(LOG_LEVELS.WARN, `Backup Warning: Failed to create backup for ${path2.basename(fullPath)}. Error: ${backupError.message}`);
    }
  }
}
function storeRelationDefinition(name, config) {
  relationDefinitions[name] = config;
}
function removeRelationDefinition(name) {
  if (relationDefinitions[name]) {
    delete relationDefinitions[name];
    return true;
  }
  return false;
}
function getRelationDefinitions() {
  return relationDefinitions;
}
function validateRelationConfig(config, relationName) {
  const prefix = `[validateRelationConfig: ${relationName}]`;
  if (!config || typeof config !== "object") {
    throw createXdbError(`${prefix} Configuration must be an object.`, XDB_ERROR_CODES.INVALID_CONFIG);
  }
  const requiredFields = ["type", "localFile", "localField", "foreignFile", "foreignField"];
  for (const field of requiredFields) {
    if (!config[field] || typeof config[field] !== "string" || config[field].trim() === "") {
      throw createXdbError(`${prefix} Missing or invalid required field: '${field}'. Must be a non-empty string.`, XDB_ERROR_CODES.INVALID_CONFIG);
    }
  }
  const validTypes = ["1:1", "1:N", "N:M"];
  if (!validTypes.includes(config.type)) {
    throw createXdbError(`${prefix} Invalid relation type: '${config.type}'. Must be one of ${validTypes.join(", ")}.`, XDB_ERROR_CODES.INVALID_CONFIG);
  }
  config.localFile = ensureJsonExtension(config.localFile);
  config.foreignFile = ensureJsonExtension(config.foreignFile);
  if (config.type === "N:M") {
    const requiredJunctionFields = ["junctionFile", "junctionLocalField", "junctionForeignField"];
    for (const field of requiredJunctionFields) {
      if (!config[field] || typeof config[field] !== "string" || config[field].trim() === "") {
        throw createXdbError(`${prefix} Missing or invalid required junction field for N:M relation: '${field}'. Must be a non-empty string.`, XDB_ERROR_CODES.INVALID_CONFIG);
      }
    }
    config.junctionFile = ensureJsonExtension(config.junctionFile);
  } else {
    const forbiddenJunctionFields = ["junctionFile", "junctionLocalField", "junctionForeignField"];
    for (const field of forbiddenJunctionFields) {
      if (config[field] !== void 0) {
        _log(LOG_LEVELS.WARN, `${prefix} Field '${field}' is only applicable for N:M relations and will be ignored for type '${config.type}'.`);
      }
    }
  }
  const validOnDelete = ["CASCADE", "SET_NULL", "RESTRICT"];
  if (config.onDelete === void 0) {
    config.onDelete = "RESTRICT";
  } else if (typeof config.onDelete !== "string" || !validOnDelete.includes(config.onDelete.toUpperCase())) {
    throw createXdbError(`${prefix} Invalid onDelete strategy: '${config.onDelete}'. Must be one of ${validOnDelete.join(", ")}.`, XDB_ERROR_CODES.INVALID_CONFIG);
  } else {
    config.onDelete = config.onDelete.toUpperCase();
  }
}
async function findExistingIds(filePath, idsToCheck, idFieldName = "id") {
  const foundIds = new Set();
  if (idsToCheck.size === 0) {
    return foundIds;
  }
  try {
    const data = await safeParseJSON(filePath);
    if (!Array.isArray(data)) {
      _log(LOG_LEVELS.WARN, `[findExistingIds] File ${filePath} is not an array, cannot check IDs.`);
      return foundIds;
    }
    const fileIdSet = new Set(data.map((record) => String(record[idFieldName])));
    for (const id of idsToCheck) {
      if (fileIdSet.has(id)) {
        foundIds.add(id);
      }
    }
  } catch (error) {
    if (error.code === XDB_ERROR_CODES.FILE_NOT_FOUND) {
    } else {
      _log(LOG_LEVELS.WARN, `[findExistingIds] Error reading file ${filePath}: ${error.message}`);
    }
  }
  return foundIds;
}
async function restoreFromBackup(filePath) {
  let release = null;
  filePath = ensureJsonExtension(filePath);
  const fullPath = path2.resolve(getBasePath(), filePath);
  const backupPath = fullPath + getBackupExtension();
  try {
    release = await acquireLock(filePath);
    try {
      await fs.stat(backupPath);
    } catch (statError) {
      if (statError.code === "ENOENT") {
        throw createXdbError(`[restoreFromBackup] Backup file not found: ${backupPath}`, XDB_ERROR_CODES.FILE_NOT_FOUND);
      }
      throw createXdbError(`[restoreFromBackup] Error accessing backup file ${backupPath}: ${statError.message}`, XDB_ERROR_CODES.IO_ERROR);
    }
    await ensureDirectoryExists(path2.dirname(fullPath));
    await fs.copyFile(backupPath, fullPath);
    return { path: fullPath, restoredFrom: backupPath };
  } catch (error) {
    if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
    throw createXdbError(`[restoreFromBackup] Failed to restore ${filePath} from backup: ${error.message}`, XDB_ERROR_CODES.OPERATION_FAILED);
  } finally {
    if (release) release();
  }
}
import fs3 from "fs/promises";
import path4 from "path";
import fs2 from "fs/promises";
import path3 from "path";
var INDEX_DIR_NAME = "index";
function getIndexDirForFile(dataFilePath) {
  const baseFileName = path3.basename(dataFilePath);
  const indexDirName = `${baseFileName}.index`;
  return path3.join(getBasePath(), INDEX_DIR_NAME, indexDirName);
}
function getIndexFilePath(dataFilePath, fieldName) {
  const indexDir = getIndexDirForFile(dataFilePath);
  const indexFileName = ensureJsonExtension(fieldName);
  return path3.join(indexDir, indexFileName);
}
async function updateIndex(dataFilePath, fieldName, fieldValue, recordId) {
  let releaseIndexLock = null;
  const indexFilePath = getIndexFilePath(dataFilePath, fieldName);
  const indexDir = path3.dirname(indexFilePath);
  const valueKey = String(fieldValue);
  try {
    await ensureIndexDirectoryExists();
    await ensureDirectoryExists(indexDir);
    releaseIndexLock = await acquireLock(indexFilePath);
    let indexData = {};
    try {
      const parsedData = await safeParseJSON(indexFilePath);
      if (typeof parsedData === "object" && parsedData !== null && !Array.isArray(parsedData)) {
        indexData = parsedData;
      } else if (Array.isArray(parsedData) && parsedData.length === 0) {
      } else {
        console.warn(`xdB Index Warning: Invalid content in index file ${indexFilePath}. Reinitializing.`);
        _log(LOG_LEVELS.WARN, `Index Warning: Invalid content in index file ${indexFilePath}. Reinitializing.`);
      }
    } catch (readError) {
      if (readError.code !== XDB_ERROR_CODES.FILE_NOT_FOUND && readError.code !== XDB_ERROR_CODES.INVALID_JSON) {
        _log(LOG_LEVELS.WARN, `Index Warning: Error reading index file ${indexFilePath}: ${readError.message}. Reinitializing.`);
      }
    }
    if (!indexData[valueKey]) {
      indexData[valueKey] = [];
    }
    if (!indexData[valueKey].includes(recordId)) {
      indexData[valueKey].push(recordId);
    }
    await atomicWrite(indexFilePath, JSON.stringify(indexData));
  } catch (error) {
    throw createXdbError(`[updateIndex] Failed for ${dataFilePath}, field ${fieldName}: ${error.message}`, error.code || XDB_ERROR_CODES.OPERATION_FAILED);
  } finally {
    if (releaseIndexLock) {
      releaseIndexLock();
    }
  }
}
async function removeFromIndex(dataFilePath, fieldName, fieldValue, recordId) {
  let releaseIndexLock = null;
  const indexFilePath = getIndexFilePath(dataFilePath, fieldName);
  const valueKey = String(fieldValue);
  let indexModified = false;
  try {
    releaseIndexLock = await acquireLock(indexFilePath);
    let indexData = {};
    try {
      const parsedData = await safeParseJSON(indexFilePath);
      if (typeof parsedData === "object" && parsedData !== null && !Array.isArray(parsedData)) {
        indexData = parsedData;
      }
    } catch (readError) {
      if (readError.code !== XDB_ERROR_CODES.FILE_NOT_FOUND && readError.code !== XDB_ERROR_CODES.INVALID_JSON) {
        _log(LOG_LEVELS.WARN, `Index Warning: Error reading index file ${indexFilePath} during removal: ${readError.message}.`);
      }
      return;
    }
    if (indexData[valueKey] && indexData[valueKey].includes(recordId)) {
      indexData[valueKey] = indexData[valueKey].filter((id) => id !== recordId);
      indexModified = true;
      if (indexData[valueKey].length === 0) {
        delete indexData[valueKey];
      }
    }
    if (indexModified) {
      await atomicWrite(indexFilePath, JSON.stringify(indexData));
    }
  } catch (error) {
    throw createXdbError(`[removeFromIndex] Failed for ${dataFilePath}, field ${fieldName}: ${error.message}`, error.code || XDB_ERROR_CODES.OPERATION_FAILED);
  } finally {
    if (releaseIndexLock) {
      releaseIndexLock();
    }
  }
}
async function findIndexedRecords(dataFilePath, fieldName, fieldValue) {
  const indexFilePath = getIndexFilePath(dataFilePath, fieldName);
  const valueKey = String(fieldValue);
  try {
    let indexData = {};
    try {
      const parsedData = await safeParseJSON(indexFilePath);
      if (typeof parsedData === "object" && parsedData !== null && !Array.isArray(parsedData)) {
        indexData = parsedData;
      }
    } catch (readError) {
      if (readError.code !== XDB_ERROR_CODES.FILE_NOT_FOUND && readError.code !== XDB_ERROR_CODES.INVALID_JSON) {
        _log(LOG_LEVELS.WARN, `Index Warning: Error reading index file ${indexFilePath} during find: ${readError.message}.`);
      }
      return [];
    }
    const recordIds = indexData[valueKey];
    return Array.isArray(recordIds) ? recordIds : [];
  } catch (error) {
    throw createXdbError(`[findIndexedRecords] Failed for ${dataFilePath}, field ${fieldName}: ${error.message}`, error.code || XDB_ERROR_CODES.OPERATION_FAILED);
  }
}
async function deleteIndexesForFile(dataFilePath) {
  const indexDir = getIndexDirForFile(dataFilePath);
  try {
    await fs2.rm(indexDir, { recursive: true, force: true });
  } catch (error) {
    if (error.code !== "ENOENT") {
      _log(LOG_LEVELS.ERROR, `Index Error: Failed to delete index directory ${indexDir}: ${error.message}`);
    }
  }
}
async function rebuildIndexesForFile(dataFilePath, allData, fieldsToIndex) {
  if (!Array.isArray(allData)) {
    _log(LOG_LEVELS.WARN, `[rebuildIndexesForFile] Cannot rebuild indexes for ${dataFilePath}: Provided data is not an array.`);
    return;
  }
  if (!fieldsToIndex || fieldsToIndex.length === 0) {
    return;
  }
  await ensureIndexDirectoryExists();
  const fileIndexDir = getIndexDirForFile(dataFilePath);
  await ensureDirectoryExists(fileIndexDir);
  for (const fieldName of fieldsToIndex) {
    const indexFilePath = getIndexFilePath(dataFilePath, fieldName);
    let releaseIndexLock = null;
    const newIndexData = {};
    try {
      for (const record of allData) {
        if (record && record.hasOwnProperty(fieldName) && record.id !== void 0 && record.id !== null) {
          const fieldValue = record[fieldName];
          const recordId = String(record.id);
          const valueKey = String(fieldValue);
          if (!newIndexData[valueKey]) {
            newIndexData[valueKey] = [];
          }
          if (!newIndexData[valueKey].includes(recordId)) {
            newIndexData[valueKey].push(recordId);
          }
        }
      }
      releaseIndexLock = await acquireLock(indexFilePath);
      await atomicWrite(indexFilePath, JSON.stringify(newIndexData));
    } catch (error) {
      _log(LOG_LEVELS.ERROR, `[rebuildIndexesForFile] Error rebuilding index for field '${fieldName}' in ${dataFilePath}: ${error.message}`);
    } finally {
      if (releaseIndexLock) {
        releaseIndexLock();
      }
    }
  }
}
async function addDir(dirPath) {
  try {
    const fullPath = path4.resolve(getBasePath(), dirPath);
    await ensureDirectoryExists(fullPath);
    return { path: fullPath };
  } catch (error) {
    if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
    throw createXdbError(`[dir.add] Failed to create directory ${dirPath}: ${error.message}`, XDB_ERROR_CODES.IO_ERROR);
  }
}
async function delDir(dirPath) {
  let release = null;
  const fullPath = path4.resolve(getBasePath(), dirPath);
  try {
    release = await acquireLock(dirPath);
    try {
      await fs3.stat(fullPath);
    } catch (statError) {
      if (statError.code === "ENOENT") {
        throw createXdbError(`[dir.del] Directory ${dirPath} not found for deletion.`, XDB_ERROR_CODES.DIR_NOT_FOUND);
      }
      throw statError;
    }
    await fs3.rm(fullPath, { recursive: true, force: true });
    return { path: fullPath };
  } catch (error) {
    if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
    throw createXdbError(`[dir.del] Failed to delete directory ${dirPath}: ${error.message}`, XDB_ERROR_CODES.IO_ERROR);
  } finally {
    if (release) release();
  }
}
async function renameDir(oldPath, newPath) {
  let release = null;
  const oldFullPath = path4.resolve(getBasePath(), oldPath);
  const newFullPath = path4.resolve(getBasePath(), newPath);
  try {
    release = await acquireLock(oldPath);
    try {
      await fs3.stat(oldFullPath);
    } catch (error) {
      if (error.code === "ENOENT") {
        throw createXdbError(`[dir.rename] Source directory ${oldPath} does not exist.`, XDB_ERROR_CODES.DIR_NOT_FOUND);
      }
      throw createXdbError(`[dir.rename] Failed to access source directory ${oldPath}: ${error.message}`, error.code || XDB_ERROR_CODES.IO_ERROR);
    }
    await ensureDirectoryExists(path4.dirname(newFullPath));
    await fs3.rename(oldFullPath, newFullPath);
    return { oldPath: oldFullPath, newPath: newFullPath };
  } catch (error) {
    if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
    throw createXdbError(`[dir.rename] Failed to rename directory from ${oldPath} to ${newPath}: ${error.message}`, error.code || XDB_ERROR_CODES.IO_ERROR);
  } finally {
    if (release) release();
  }
}
async function moveFile(sourcePath, targetPath) {
  let release = null;
  sourcePath = ensureJsonExtension(sourcePath);
  targetPath = ensureJsonExtension(targetPath);
  const sourceFullPath = path4.resolve(getBasePath(), sourcePath);
  const targetFullPath = path4.resolve(getBasePath(), targetPath);
  try {
    release = await acquireLock(sourcePath);
    try {
      await fs3.stat(sourceFullPath);
    } catch (error) {
      if (error.code === "ENOENT") {
        throw createXdbError(`[move.file] Source file ${sourcePath} does not exist.`, XDB_ERROR_CODES.FILE_NOT_FOUND);
      }
      throw createXdbError(`[move.file] Failed to access source file ${sourcePath}: ${error.message}`, error.code || XDB_ERROR_CODES.IO_ERROR);
    }
    await ensureDirectoryExists(path4.dirname(targetFullPath));
    await fs3.rename(sourceFullPath, targetFullPath);
    return { source: sourceFullPath, target: targetFullPath };
  } catch (error) {
    if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
    throw createXdbError(`[move.file] Failed to move file from ${sourcePath} to ${targetPath}: ${error.message}`, error.code || XDB_ERROR_CODES.IO_ERROR);
  } finally {
    if (release) release();
  }
}
async function editAll(filePath, newData) {
  let release = null;
  filePath = ensureJsonExtension(filePath);
  const fullPath = path4.resolve(getBasePath(), filePath);
  const eventData = { filePath, newData };
  try {
    _emit("beforeEditAll", eventData);
    if (!newData || typeof newData !== "object") {
      throw createXdbError("[edit.all] Invalid newData: Data must be an array or an object.", XDB_ERROR_CODES.OPERATION_FAILED);
    }
    if (Array.isArray(newData)) {
      for (const record of newData) {
        try {
          validateRecord(record);
          if (record.id !== void 0 && record.id !== null) {
            record.id = String(record.id);
            validateId(record.id);
          }
        } catch (validationError) {
          throw createXdbError(`[edit.all] Invalid record in initialData array: ${validationError.message}`, XDB_ERROR_CODES.OPERATION_FAILED);
        }
      }
    }
    release = await acquireLock(filePath);
    if (isBackupOnEditEnabled()) {
      await createBackupIfNeeded(fullPath);
    }
    const dataWritten = Array.isArray(newData) ? newData : [newData];
    await atomicWrite(filePath, JSON.stringify(dataWritten));
    try {
      const fieldsToIndex = getIndexConfigForFile(filePath);
      if (fieldsToIndex.length > 0) {
        await rebuildIndexesForFile(filePath, dataWritten, fieldsToIndex);
      }
    } catch (indexError) {
      _log(LOG_LEVELS.WARN, `Index Warning: Failed to rebuild indexes for ${filePath} after edit.all: ${indexError.message}`);
    }
    clearRelationCache();
    _emit("afterEditAll", { ...eventData, path: fullPath, writtenData: dataWritten });
    return { path: fullPath };
  } catch (error) {
    _emit("errorEditAll", { ...eventData, error });
    if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
    throw createXdbError(`[edit.all] Failed to edit all data in ${filePath}: ${error.message}`, error.code || XDB_ERROR_CODES.IO_ERROR);
  } finally {
    if (release) release();
  }
}
async function editRecordById(filePath, id, newRecord) {
  let release = null;
  filePath = ensureJsonExtension(filePath);
  const fullPath = path4.resolve(getBasePath(), filePath);
  const eventData = { filePath, id, newRecord };
  let originalRecord = null;
  try {
    _emit("beforeEditId", eventData);
    const recordId = String(id);
    validateId(recordId);
    validateRecord(newRecord);
    release = await acquireLock(filePath);
    let data = await safeParseJSON(filePath);
    if (!Array.isArray(data)) {
      throw createXdbError(`[edit.id] Cannot edit record by ID: File ${filePath} does not contain a JSON array.`, XDB_ERROR_CODES.OPERATION_FAILED);
    }
    const recordIndex = data.findIndex((record) => String(record.id) === recordId);
    if (recordIndex === -1) {
      throw createXdbError(`[edit.id] Record with ID ${recordId} not found in ${filePath}.`, XDB_ERROR_CODES.RECORD_NOT_FOUND);
    }
    originalRecord = { ...data[recordIndex] };
    const updatedRecord = { ...originalRecord, ...newRecord, id: originalRecord.id };
    data[recordIndex] = updatedRecord;
    if (isBackupOnEditEnabled()) {
      await createBackupIfNeeded(fullPath);
    }
    await atomicWrite(filePath, JSON.stringify(data));
    try {
      const fieldsToIndex = getIndexConfigForFile(filePath);
      if (fieldsToIndex.length > 0) {
        for (const fieldName of fieldsToIndex) {
          if (originalRecord && originalRecord.hasOwnProperty(fieldName)) {
            await removeFromIndex(filePath, fieldName, originalRecord[fieldName], recordId);
          }
        }
        for (const fieldName of fieldsToIndex) {
          if (updatedRecord.hasOwnProperty(fieldName)) {
            await updateIndex(filePath, fieldName, updatedRecord[fieldName], recordId);
          }
        }
      }
    } catch (indexError) {
      _log(LOG_LEVELS.WARN, `Index Warning: Failed to update index for record ${recordId} in ${filePath} after edit: ${indexError.message}`);
    }
    clearRelationCache();
    _emit("afterEditId", { ...eventData, path: fullPath, record: updatedRecord, originalRecord });
    return { path: fullPath, record: updatedRecord };
  } catch (error) {
    _emit("errorEditId", { ...eventData, error, originalRecord });
    if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
    throw createXdbError(`[edit.id] Failed to edit record with ID ${id} in ${filePath}: ${error.message}`, error.code || XDB_ERROR_CODES.IO_ERROR);
  } finally {
    if (release) release();
  }
}
async function deleteAll(filePath) {
  let release = null;
  filePath = ensureJsonExtension(filePath);
  const fullPath = path4.resolve(getBasePath(), filePath);
  const eventData = { filePath };
  try {
    _emit("beforeDeleteAll", eventData);
    release = await acquireLock(filePath);
    try {
      await fs3.stat(fullPath);
      if (isBackupOnDeleteEnabled()) {
        await createBackupIfNeeded(fullPath);
      }
      await atomicWrite(filePath, JSON.stringify([]));
      try {
        await deleteIndexesForFile(filePath);
      } catch (indexError) {
        _log(LOG_LEVELS.WARN, `Index Warning: Failed to delete indexes for ${filePath} after del.all: ${indexError.message}`);
      }
    } catch (statError) {
      if (statError.code === "ENOENT") {
        return { path: fullPath };
      }
      throw statError;
    }
    clearRelationCache();
    _emit("afterDeleteAll", { ...eventData, path: fullPath });
    return { path: fullPath };
  } catch (error) {
    _emit("errorDeleteAll", { ...eventData, error });
    if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
    throw createXdbError(`[del.all] Failed to delete all content (empty) in file ${filePath}: ${error.message}`, error.code || XDB_ERROR_CODES.IO_ERROR);
  } finally {
    if (release) release();
  }
}
async function deleteRecordById(filePath, id, { viewMoreFn, deleteRecordByIdFn, editRecordByIdFn }) {
  if (typeof viewMoreFn !== "function" || typeof deleteRecordByIdFn !== "function" || typeof editRecordByIdFn !== "function") {
    throw createXdbError("[del.id internal] Required functions (viewMoreFn, deleteRecordByIdFn, editRecordByIdFn) were not provided.", XDB_ERROR_CODES.INTERNAL_ERROR);
  }
  let release = null;
  filePath = ensureJsonExtension(filePath);
  const fullPath = path4.resolve(getBasePath(), filePath);
  const eventData = { filePath, id };
  let recordToDelete = null;
  try {
    _emit("beforeDeleteId", eventData);
    const recordId = String(id);
    validateId(recordId);
    release = await acquireLock(filePath);
    let data = await safeParseJSON(filePath);
    if (!Array.isArray(data)) {
      throw createXdbError(`[del.id] Cannot delete record by ID: File ${filePath} does not contain a JSON array.`, XDB_ERROR_CODES.OPERATION_FAILED);
    }
    const initialLength = data.length;
    const filteredData = data.filter((record) => String(record.id) !== recordId);
    if (initialLength === filteredData.length) {
      throw createXdbError(`[del.id] Record with ID ${recordId} not found for deletion in ${filePath}.`, XDB_ERROR_CODES.RECORD_NOT_FOUND);
    }
    recordToDelete = data.find((record) => String(record.id) === recordId);
    const relations = getRelationDefinitions();
    const relatedChecks = [];
    for (const relationName in relations) {
      const relation = relations[relationName];
      if (relation.localFile === filePath) {
        switch (relation.onDelete) {
          case "RESTRICT":
            relatedChecks.push((async () => {
              let checkFile, checkField, checkValue;
              if (relation.type === "N:M") {
                checkFile = relation.junctionFile;
                checkField = relation.junctionLocalField;
                checkValue = recordId;
              } else {
                checkFile = relation.foreignFile;
                checkField = relation.foreignField;
                checkValue = recordId;
              }
              try {
                const related = await viewMoreFn(checkFile, { filter: (r) => r[checkField] == checkValue, limit: 1 });
                if (related.data.length > 0) {
                  throw createXdbError(`[del.id] Cannot delete record ID ${recordId} from ${filePath}: Related records/entries exist in ${checkFile} (field: ${checkField}) via relation '${relationName}' (RESTRICT).`, XDB_ERROR_CODES.OPERATION_FAILED);
                }
              } catch (checkError) {
                if (checkError.code === XDB_ERROR_CODES.FILE_NOT_FOUND) {
                } else {
                  _log(LOG_LEVELS.ERROR, `[del.id RESTRICT] Error checking relation '${relationName}' in ${checkFile}: ${checkError.message}`);
                  throw createXdbError(`[del.id] Error checking RESTRICT constraint for relation '${relationName}': ${checkError.message}`, XDB_ERROR_CODES.OPERATION_FAILED);
                }
              }
            })());
            break;
          case "CASCADE":
            relatedChecks.push((async () => {
              let relatedFile, relatedField, relatedValue;
              let isJunctionDelete = false;
              if (relation.type === "N:M") {
                relatedFile = relation.junctionFile;
                relatedField = relation.junctionLocalField;
                relatedValue = recordId;
                isJunctionDelete = true;
              } else {
                relatedFile = relation.foreignFile;
                relatedField = relation.foreignField;
                relatedValue = recordId;
              }
              try {
                const relatedRecordsResult = await viewMoreFn(relatedFile, { filter: (r) => r[relatedField] == relatedValue });
                if (relatedRecordsResult.data.length > 0) {
                  _log(LOG_LEVELS.INFO, `[del.id CASCADE] Found ${relatedRecordsResult.data.length} related record(s)/entries in ${relatedFile} for relation '${relationName}'. Deleting...`);
                  const deletePromises = relatedRecordsResult.data.map(async (relatedItem) => {
                    try {
                      await deleteRecordByIdFn(relatedFile, relatedItem.id);
                    } catch (cascadeDeleteError) {
                      _log(LOG_LEVELS.WARN, `[del.id CASCADE] Error deleting related item ID ${relatedItem.id} from ${relatedFile} for relation '${relationName}': ${cascadeDeleteError.message}`);
                      if (cascadeDeleteError.code === XDB_ERROR_CODES.RECORD_NOT_FOUND) {
                      } else {
                      }
                    }
                  });
                  await Promise.all(deletePromises);
                }
              } catch (findRelatedError) {
                if (findRelatedError.code !== XDB_ERROR_CODES.FILE_NOT_FOUND) {
                  _log(LOG_LEVELS.WARN, `[del.id CASCADE] Error finding related items in ${relatedFile} for relation '${relationName}': ${findRelatedError.message}`);
                }
              }
            })());
            break;
          case "SET_NULL":
            relatedChecks.push((async () => {
              let relatedFile, relatedFieldToNull, relatedValueToMatch;
              if (relation.type === "N:M") {
                relatedFile = relation.junctionFile;
                relatedFieldToNull = relation.junctionLocalField;
                relatedValueToMatch = recordId;
                _log(LOG_LEVELS.INFO, `[del.id SET_NULL/N:M] Deleting junction entries from ${relatedFile} where ${relatedFieldToNull} == ${relatedValueToMatch} for relation '${relationName}'.`);
                try {
                  const junctionEntries = await viewMoreFn(relatedFile, { filter: (r) => r[relatedFieldToNull] == relatedValueToMatch });
                  if (junctionEntries.data.length > 0) {
                    const deleteJunctionPromises = junctionEntries.data.map((entry) => deleteRecordByIdFn(relatedFile, entry.id).catch((err) => {
                      _log(LOG_LEVELS.WARN, `[del.id SET_NULL/N:M] Error deleting junction entry ID ${entry.id} from ${relatedFile}: ${err.message}`);
                    }));
                    await Promise.all(deleteJunctionPromises);
                  }
                } catch (findJunctionError) {
                  if (findJunctionError.code !== XDB_ERROR_CODES.FILE_NOT_FOUND) {
                    _log(LOG_LEVELS.WARN, `[del.id SET_NULL/N:M] Error finding junction entries in ${relatedFile}: ${findJunctionError.message}`);
                  }
                }
              } else {
                relatedFile = relation.foreignFile;
                relatedFieldToNull = relation.foreignField;
                relatedValueToMatch = recordId;
                try {
                  const relatedRecordsResult = await viewMoreFn(relatedFile, { filter: (r) => r[relatedFieldToNull] == relatedValueToMatch });
                  if (relatedRecordsResult.data.length > 0) {
                    _log(LOG_LEVELS.INFO, `[del.id SET_NULL] Found ${relatedRecordsResult.data.length} related record(s) in ${relatedFile} for relation '${relationName}'. Setting field '${relatedFieldToNull}' to null...`);
                    const updatePromises = relatedRecordsResult.data.map(async (relatedRecord) => {
                      if (relatedRecord[relatedFieldToNull] === null) {
                        return;
                      }
                      try {
                        const updatePayload = { [relatedFieldToNull]: null };
                        await editRecordByIdFn(relatedFile, relatedRecord.id, updatePayload);
                      } catch (setNullError) {
                        _log(LOG_LEVELS.WARN, `[del.id SET_NULL] Error updating related record ID ${relatedRecord.id} in ${relatedFile} for relation '${relationName}': ${setNullError.message}`);
                      }
                    });
                    await Promise.all(updatePromises);
                  }
                } catch (findRelatedError) {
                  if (findRelatedError.code !== XDB_ERROR_CODES.FILE_NOT_FOUND) {
                    _log(LOG_LEVELS.WARN, `[del.id SET_NULL] Error finding related records in ${relatedFile} for relation '${relationName}': ${findRelatedError.message}`);
                  }
                }
              }
            })());
            break;
        }
      }
    }
    await Promise.all(relatedChecks);
    if (isBackupOnDeleteEnabled()) {
      await createBackupIfNeeded(fullPath);
    }
    if (!recordToDelete) {
      throw createXdbError(`[del.id] Record with ID ${recordId} not found for deletion in ${filePath}.`, XDB_ERROR_CODES.RECORD_NOT_FOUND);
    }
    const finalFilteredData = data.filter((record) => String(record.id) !== recordId);
    await atomicWrite(filePath, JSON.stringify(finalFilteredData));
    try {
      const fieldsToIndex = getIndexConfigForFile(filePath);
      if (fieldsToIndex.length > 0) {
        for (const fieldName of fieldsToIndex) {
          if (recordToDelete.hasOwnProperty(fieldName)) {
            await removeFromIndex(filePath, fieldName, recordToDelete[fieldName], recordId);
          }
        }
      }
    } catch (indexError) {
      _log(LOG_LEVELS.WARN, `Index Warning: Failed to remove index entries for deleted record ${recordId} in ${filePath}: ${indexError.message}`);
    }
    clearRelationCache();
    _emit("afterDeleteId", { ...eventData, path: fullPath, deletedId: recordId, deletedRecord: recordToDelete });
    return { path: fullPath, deletedId: recordId };
  } catch (error) {
    _emit("errorDeleteId", { ...eventData, error, recordAttemptedToDelete: recordToDelete });
    if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
    throw createXdbError(`[del.id] Failed to delete record with ID ${id} from ${filePath}: ${error.message}`, error.code || XDB_ERROR_CODES.IO_ERROR);
  } finally {
    if (release) release();
  }
}
async function addAll(filePath, initialData = [], options = { overwrite: true }) {
  let release = null;
  filePath = ensureJsonExtension(filePath);
  const fullPath = path4.resolve(getBasePath(), filePath);
  const eventData = { filePath, initialData, options };
  let processedData = null;
  try {
    _emit("beforeAddAll", eventData);
    if (!initialData || typeof initialData !== "object") {
      throw createXdbError("[add.all] Invalid initialData: Data must be an array or an object.", XDB_ERROR_CODES.OPERATION_FAILED);
    }
    let processedData2 = initialData;
    if (Array.isArray(initialData)) {
      processedData2 = initialData.map((record) => {
        try {
          validateRecord(record);
          let currentId = record.id;
          if (currentId === void 0 || currentId === null) {
            currentId = _xdToken(DEFAULT_XDB_ID_LENGTH);
          } else {
            currentId = String(currentId);
            validateId(currentId);
          }
          return { ...record, id: currentId };
        } catch (validationError) {
          throw createXdbError(`[add.all] Invalid record in initialData array: ${validationError.message}`, XDB_ERROR_CODES.OPERATION_FAILED);
        }
      });
      const ids = processedData2.map((r) => r.id);
      if (new Set(ids).size !== ids.length) {
        throw createXdbError(`[add.all] Duplicate IDs found within the provided initialData array.`, XDB_ERROR_CODES.RECORD_EXISTS);
      }
    } else {
      validateRecord(initialData);
      let currentId = initialData.id;
      if (currentId === void 0 || currentId === null) {
        currentId = _xdToken(DEFAULT_XDB_ID_LENGTH);
      } else {
        currentId = String(currentId);
        validateId(currentId);
      }
      processedData2 = { ...initialData, id: currentId };
    }
    release = await acquireLock(filePath);
    await ensureDirectoryExists(path4.dirname(fullPath));
    let fileExists = false;
    try {
      await fs3.stat(fullPath);
      fileExists = true;
    } catch (statError) {
      if (statError.code !== "ENOENT") throw statError;
    }
    if (fileExists && !options.overwrite) {
      throw createXdbError(`[add.all] File ${filePath} already exists. Set options.overwrite to true to overwrite.`, XDB_ERROR_CODES.OPERATION_FAILED);
    }
    if (fileExists && isBackupOnAddEnabled()) {
      await createBackupIfNeeded(fullPath);
    }
    await atomicWrite(filePath, JSON.stringify(processedData2));
    try {
      const fieldsToIndex = getIndexConfigForFile(filePath);
      if (fieldsToIndex.length > 0) {
        const dataForIndex = Array.isArray(processedData2) ? processedData2 : [processedData2];
        await rebuildIndexesForFile(filePath, dataForIndex, fieldsToIndex);
      }
    } catch (indexError) {
      _log(LOG_LEVELS.WARN, `Index Warning: Failed to rebuild indexes for ${filePath} after add.all: ${indexError.message}`);
    }
    clearRelationCache();
    _emit("afterAddAll", { ...eventData, path: fullPath, writtenData: processedData2 });
    return { path: fullPath };
  } catch (error) {
    _emit("errorAddAll", { ...eventData, error });
    if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
    throw createXdbError(`[add.all] Failed to add all data (create/overwrite file) ${filePath}: ${error.message}`, error.code || XDB_ERROR_CODES.IO_ERROR);
  } finally {
    if (release) release();
  }
}
async function addRecordById(filePath, newRecord) {
  let release = null;
  filePath = ensureJsonExtension(filePath);
  const fullPath = path4.resolve(getBasePath(), filePath);
  const eventData = { filePath, newRecord };
  let recordToAdd = null;
  try {
    _emit("beforeAddId", eventData);
    validateRecord(newRecord);
    release = await acquireLock(filePath);
    let data = await safeParseJSON(filePath);
    if (!Array.isArray(data)) {
      throw createXdbError(`[add.id] Cannot add record: File ${filePath} exists but does not contain a JSON array.`, XDB_ERROR_CODES.OPERATION_FAILED);
    }
    let recordToAdd2 = { ...newRecord };
    if (recordToAdd2.id === void 0 || recordToAdd2.id === null) {
      recordToAdd2.id = _xdToken(DEFAULT_XDB_ID_LENGTH);
      let attempts = 0;
      const maxAttempts = 10;
      while (data.some((record) => String(record.id) === String(recordToAdd2.id)) && attempts < maxAttempts) {
        _log(LOG_LEVELS.WARN, `_xdToken collision detected for ${recordToAdd2.id} in ${filePath}. Regenerating (attempt ${attempts + 1}).`);
        recordToAdd2.id = _xdToken(DEFAULT_XDB_ID_LENGTH);
        attempts++;
      }
      if (attempts >= maxAttempts) {
        throw createXdbError(`[add.id] Failed to generate a unique ID for ${filePath} after ${maxAttempts} attempts.`, XDB_ERROR_CODES.OPERATION_FAILED);
      }
    } else {
      recordToAdd2.id = String(recordToAdd2.id);
      validateId(recordToAdd2.id);
      if (data.some((record) => String(record.id) === String(recordToAdd2.id))) {
        throw createXdbError(`[add.id] Record with ID ${recordToAdd2.id} already exists in ${filePath}.`, XDB_ERROR_CODES.RECORD_EXISTS);
      }
    }
    data.push(recordToAdd2);
    if (data.length > 1) {
      let fileExistedBefore = false;
      try {
        await fs3.stat(fullPath);
        fileExistedBefore = true;
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
      if (fileExistedBefore && isBackupOnAddEnabled()) {
        await createBackupIfNeeded(fullPath);
      }
    }
    await atomicWrite(filePath, JSON.stringify(data));
    try {
      const fieldsToIndex = getIndexConfigForFile(filePath);
      if (fieldsToIndex.length > 0) {
        for (const fieldName of fieldsToIndex) {
          if (recordToAdd2.hasOwnProperty(fieldName)) {
            await updateIndex(filePath, fieldName, recordToAdd2[fieldName], recordToAdd2.id);
          }
        }
      }
    } catch (indexError) {
      _log(LOG_LEVELS.WARN, `Index Warning: Failed to add index entries for new record ${recordToAdd2.id} in ${filePath}: ${indexError.message}`);
    }
    clearRelationCache();
    _emit("afterAddId", { ...eventData, path: fullPath, record: recordToAdd2 });
    return { path: fullPath, record: recordToAdd2 };
  } catch (error) {
    _emit("errorAddId", { ...eventData, error, recordAttemptedToAdd: recordToAdd });
    if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
    throw createXdbError(`[add.id] Failed to add record to ${filePath}: ${error.message}`, error.code || XDB_ERROR_CODES.IO_ERROR);
  } finally {
    if (release) release();
  }
}
async function viewAll(filePath) {
  try {
    filePath = ensureJsonExtension(filePath);
    const parsedData = await safeParseJSON(filePath);
    return { path: path4.resolve(getBasePath(), filePath), data: parsedData };
  } catch (error) {
    if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
    throw createXdbError(`[view.all] Failed to view all data from ${filePath}: ${error.message}`, XDB_ERROR_CODES.OPERATION_FAILED);
  }
}
async function viewRecordById(filePath, id) {
  try {
    const recordId = String(id);
    validateId(recordId);
    filePath = ensureJsonExtension(filePath);
    const fullPath = path4.resolve(getBasePath(), filePath);
    const data = await safeParseJSON(filePath);
    if (!Array.isArray(data)) {
      throw createXdbError(`[view.id] Cannot view record by ID: File ${filePath} exists but does not contain a JSON array.`, XDB_ERROR_CODES.OPERATION_FAILED);
    }
    const record = data.find((record2) => String(record2.id) === recordId);
    if (!record) {
      throw createXdbError(`[view.id] Record with ID ${recordId} not found in ${filePath}.`, XDB_ERROR_CODES.RECORD_NOT_FOUND);
    }
    return { path: fullPath, record };
  } catch (error) {
    if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
    throw createXdbError(`[view.id] Failed to view record with ID ${id} from ${filePath}: ${error.message}`, XDB_ERROR_CODES.OPERATION_FAILED);
  }
}
var xdB2 = {
  config: setConfig,
  getBasePath,
  on,
  off,
  dir: {
    add: addDir,
    del: delDir,
    rename: renameDir
  },
  move: { file: moveFile },
  edit: {
    all: editAll,
    id: editRecordById
  },
  del: {
    all: deleteAll,
    id: (filePath, id) => deleteRecordById(filePath, id, { viewMoreFn: (...args) => xdB2.view.more(...args), deleteRecordByIdFn: (...args) => xdB2.del.id(...args), editRecordByIdFn: (...args) => xdB2.edit.id(...args) })
  },
  add: {
    all: addAll,
    id: addRecordById
  },
  view: {
    all: viewAll,
    id: viewRecordById,
    more: async (filePath, options = {}) => {
      try {
        filePath = ensureJsonExtension(filePath);
        const fullPath = path4.resolve(getBasePath(), filePath);
        let data = await safeParseJSON(filePath);
        if (!Array.isArray(data)) {
          throw createXdbError(`[view.more] Cannot query records: File ${filePath} exists but does not contain a JSON array.`, XDB_ERROR_CODES.OPERATION_FAILED);
        }
        if (options.filter !== void 0 && typeof options.filter !== "function") {
          throw createXdbError(`[view.more] Invalid option: 'filter' must be a function. Received: ${typeof options.filter}`, XDB_ERROR_CODES.OPERATION_FAILED);
        }
        if (options.skip !== void 0 && (typeof options.skip !== "number" || isNaN(options.skip) || options.skip < 0)) {
          throw createXdbError(`[view.more] Invalid option: 'skip' must be a non-negative number. Received: ${options.skip}`, XDB_ERROR_CODES.OPERATION_FAILED);
        }
        if (options.limit !== void 0 && (typeof options.limit !== "number" || isNaN(options.limit) || options.limit < 0)) {
          throw createXdbError(`[view.more] Invalid option: 'limit' must be a non-negative number. Received: ${options.limit}`, XDB_ERROR_CODES.OPERATION_FAILED);
        }
        if (options.sort !== void 0) {
          const sortCriteria = Array.isArray(options.sort) ? options.sort : [options.sort];
          for (const criterion of sortCriteria) {
            if (typeof criterion !== "object" || criterion === null) {
              throw createXdbError(`[view.more] Invalid sort criterion: Each criterion must be an object. Received: ${criterion}`, XDB_ERROR_CODES.OPERATION_FAILED);
            }
            if (!criterion.comparator && (typeof criterion.key !== "string" || !criterion.key)) {
              throw createXdbError(`[view.more] Invalid sort criterion: 'key' must be a non-empty string if 'comparator' is not provided. Received key: ${criterion.key}`, XDB_ERROR_CODES.OPERATION_FAILED);
            }
            if (criterion.order !== void 0 && !["asc", "desc"].includes(criterion.order.toLowerCase())) {
              throw createXdbError(`[view.more] Invalid sort criterion: 'order' must be 'asc' or 'desc'. Received: ${criterion.order}`, XDB_ERROR_CODES.OPERATION_FAILED);
            }
            if (criterion.comparator !== void 0 && typeof criterion.comparator !== "function") {
              throw createXdbError(`[view.more] Invalid sort criterion: 'comparator' must be a function. Received: ${typeof criterion.comparator}`, XDB_ERROR_CODES.OPERATION_FAILED);
            }
          }
        }
        if (options.includeStrategy !== void 0 && !["eager", "lazy"].includes(options.includeStrategy)) {
          throw createXdbError(`[view.more] Invalid option: 'includeStrategy' must be 'eager' or 'lazy'. Received: ${options.includeStrategy}`, XDB_ERROR_CODES.OPERATION_FAILED);
        }
        if (options.filter) {
          try {
            data = data.filter(options.filter);
          } catch (filterError) {
            throw createXdbError(`[view.more] Error applying filter function: ${filterError.message}`, XDB_ERROR_CODES.OPERATION_FAILED);
          }
        } else if (options.find) {
          _log(LOG_LEVELS.WARN, "options.find is deprecated, use options.filter function instead.");
          data = data.filter((record) => {
            return Object.entries(options.find).every(([key, value]) => record[key] === value);
          });
        }
        if (options.sort) {
          const sortCriteria = Array.isArray(options.sort) ? options.sort : [options.sort];
          try {
            data.sort((a, b) => {
              for (const criterion of sortCriteria) {
                const { key, order = "asc", comparator } = criterion;
                const direction = order.toLowerCase() === "desc" ? -1 : 1;
                let comparison = 0;
                if (typeof comparator === "function") {
                  comparison = comparator(a, b);
                } else if (key) {
                  const valA = a[key];
                  const valB = b[key];
                  if (valA < valB) comparison = -1;
                  else if (valA > valB) comparison = 1;
                }
                if (comparison !== 0) {
                  return comparison * direction;
                }
              }
              return 0;
            });
          } catch (sortError) {
            throw createXdbError(`[view.more] Error during sorting: ${sortError.message}`, XDB_ERROR_CODES.OPERATION_FAILED);
          }
        }
        const skip = options.skip && typeof options.skip === "number" && options.skip > 0 ? Math.floor(options.skip) : 0;
        const limit = options.limit !== void 0 && typeof options.limit === "number" && options.limit >= 0 ? Math.floor(options.limit) : Infinity;
        const paginatedData = data.slice(skip, limit === Infinity ? void 0 : skip + limit);
        let finalData = paginatedData;
        if (options.include && Array.isArray(options.include) && options.include.length > 0) {
          const relationsToInclude = options.include.filter((rel) => typeof rel === "string");
          if (relationsToInclude.length > 0) {
            const definitions = getRelationDefinitions();
            const includeStrategy = options.includeStrategy || "eager";
            const dataWithIncludes = [];
            const eagerLoadPromises = [];
            for (const record of finalData) {
              const recordWithIncludes = { ...record };
              for (const relationName of relationsToInclude) {
                if (definitions[relationName]) {
                  const relation = definitions[relationName];
                  if (relation.localFile === filePath) {
                    const localId = record[relation.localField];
                    if (localId !== void 0 && localId !== null) {
                      if (includeStrategy === "lazy") {
                        recordWithIncludes[relationName] = () => xdB2.relations.getRelated(relationName, localId);
                      } else {
                        eagerLoadPromises.push(xdB2.relations.getRelated(relationName, localId).then((relatedData) => {
                          recordWithIncludes[relationName] = relatedData;
                        }).catch((includeError) => {
                          _log(LOG_LEVELS.WARN, `[view.more include] Error fetching related data for relation '${relationName}', record ID ${record.id}: ${includeError.message}`);
                          recordWithIncludes[relationName] = { _error: includeError.message };
                        }));
                      }
                    } else {
                      recordWithIncludes[relationName] = includeStrategy === "lazy" ? () => Promise.resolve(null) : null;
                    }
                  } else {
                    _log(LOG_LEVELS.WARN, `[view.more include] Relation '${relationName}' does not originate from the queried file '${filePath}'. Skipping include.`);
                    recordWithIncludes[relationName] = includeStrategy === "lazy" ? () => Promise.reject(createXdbError(`Relation '${relationName}' does not originate from ${filePath}`, XDB_ERROR_CODES.OPERATION_FAILED)) : { _error: `Relation '${relationName}' does not originate from ${filePath}` };
                  }
                } else {
                  _log(LOG_LEVELS.WARN, `[view.more include] Relation '${relationName}' is not defined. Skipping include.`);
                  recordWithIncludes[relationName] = includeStrategy === "lazy" ? () => Promise.reject(createXdbError(`Relation '${relationName}' not defined`, XDB_ERROR_CODES.OPERATION_FAILED)) : { _error: `Relation '${relationName}' not defined` };
                }
              }
              dataWithIncludes.push(recordWithIncludes);
            }
            if (includeStrategy === "eager") {
              await Promise.all(eagerLoadPromises);
            }
            finalData = dataWithIncludes;
          }
        }
        return { path: fullPath, data: finalData };
      } catch (error) {
        if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
        throw createXdbError(`[view.more] Failed to query records from ${filePath}: ${error.message}`, XDB_ERROR_CODES.OPERATION_FAILED);
      }
    }
  },
  utils: {
    restoreFromBackup,
    verifyRelations: async () => {
      const inconsistencies = [];
      const definitions = getRelationDefinitions();
      const checkedLinks = new Map();
      _log(LOG_LEVELS.INFO, `[verifyRelations] Starting verification for ${Object.keys(definitions).length} relations.`);
      for (const relationName in definitions) {
        const relation = definitions[relationName];
        const checks = [];
        if (relation.type === "1:1" || relation.type === "1:N") {
          checks.push({ sourceFile: relation.foreignFile, sourceField: relation.foreignField, targetFile: relation.localFile, targetField: relation.localField });
        } else if (relation.type === "N:M") {
          checks.push({ sourceFile: relation.junctionFile, sourceField: relation.junctionLocalField, targetFile: relation.localFile, targetField: relation.localField });
          checks.push({ sourceFile: relation.junctionFile, sourceField: relation.junctionForeignField, targetFile: relation.foreignFile, targetField: relation.foreignField });
        }
        for (const check of checks) {
          const { sourceFile, sourceField, targetFile, targetField } = check;
          _log(LOG_LEVELS.DEBUG, `[verifyRelations] Checking: ${relationName} (${sourceFile}.${sourceField} -> ${targetFile}.${targetField})`);
          try {
            const sourceData = await safeParseJSON(sourceFile);
            if (!Array.isArray(sourceData)) {
              _log(LOG_LEVELS.WARN, `[verifyRelations:${relationName}] Source file ${sourceFile} is not an array. Skipping check.`);
              continue;
            }
            const foreignKeysToCheck = new Set();
            const sourceRecordsWithFK = new Map();
            for (const record of sourceData) {
              const fkValue = record[sourceField];
              if (fkValue !== void 0 && fkValue !== null) {
                const fkString = String(fkValue);
                foreignKeysToCheck.add(fkString);
                if (!sourceRecordsWithFK.has(fkString)) {
                  sourceRecordsWithFK.set(fkString, record.id);
                }
              }
            }
            if (foreignKeysToCheck.size === 0) {
              _log(LOG_LEVELS.DEBUG, `[verifyRelations:${relationName}] No foreign keys found in ${sourceFile}.${sourceField}. Skipping target check.`);
              continue;
            }
            let foundTargetIds = checkedLinks.get(targetFile);
            if (!foundTargetIds) {
              _log(LOG_LEVELS.DEBUG, `[verifyRelations:${relationName}] Cache miss for ${targetFile}. Checking target file...`);
              foundTargetIds = await findExistingIds(targetFile, foreignKeysToCheck, targetField);
              checkedLinks.set(targetFile, foundTargetIds);
              _log(LOG_LEVELS.DEBUG, `[verifyRelations:${relationName}] Found ${foundTargetIds.size} existing target IDs in ${targetFile}.`);
            } else {
              _log(LOG_LEVELS.DEBUG, `[verifyRelations:${relationName}] Cache hit for ${targetFile}. Using cached ${foundTargetIds.size} IDs.`);
              const currentFound = new Set();
              for (const fk of foreignKeysToCheck) {
                if (foundTargetIds.has(fk)) {
                  currentFound.add(fk);
                }
              }
              foundTargetIds = currentFound;
            }
            for (const fk of foreignKeysToCheck) {
              if (!foundTargetIds.has(fk)) {
                inconsistencies.push({ relationName, type: relation.type, sourceFile, sourceRecordId: sourceRecordsWithFK.get(fk) || "unknown", sourceField, brokenValue: fk, targetFile, targetField });
                _log(LOG_LEVELS.WARN, `[verifyRelations:${relationName}] Broken link found: ${sourceFile} (ID: ${sourceRecordsWithFK.get(fk)}) field '${sourceField}' has value '${fk}' which does not exist in ${targetFile}.${targetField}`);
              }
            }
          } catch (error) {
            _log(LOG_LEVELS.ERROR, `[verifyRelations:${relationName}] Error processing check (${sourceFile} -> ${targetFile}): ${error.message}`);
          }
        }
      }
      _log(LOG_LEVELS.INFO, `[verifyRelations] Verification complete. Found ${inconsistencies.length} inconsistencies.`);
      return inconsistencies;
    }
  },
  query: async (filePath, fieldName, fieldValue) => {
    const indexedFields = getIndexConfigForFile(filePath);
    if (!indexedFields.includes(fieldName)) {
      throw createXdbError(`[query] Field "${fieldName}" is not configured for indexing on file "${filePath}". Use view.more for non-indexed queries.`, XDB_ERROR_CODES.OPERATION_FAILED);
    }
    try {
      const recordIds = await findIndexedRecords(filePath, fieldName, fieldValue);
      if (!recordIds || recordIds.length === 0) {
        return [];
      }
      const records = [];
      for (const recordId of recordIds) {
        try {
          const result = await xdB2.view.id(filePath, recordId);
          records.push(result.record);
        } catch (viewError) {
          if (viewError.code === XDB_ERROR_CODES.RECORD_NOT_FOUND) {
            _log(LOG_LEVELS.WARN, `Query Warning: Record ID "${recordId}" found in index for "${filePath}" field "${fieldName}" but not found in the data file. Index might be stale.`);
          } else {
            throw viewError;
          }
        }
      }
      return records;
    } catch (error) {
      if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
      throw createXdbError(`[query] Failed for file "${filePath}", field "${fieldName}": ${error.message}`, XDB_ERROR_CODES.OPERATION_FAILED);
    }
  },
  relations: {
    define: (name, config) => {
      try {
        validateRelationConfig(config, name);
        const existingDefinitions = getRelationDefinitions();
        if (existingDefinitions[name]) {
          _log(LOG_LEVELS.WARN, `[Relations] Relation '${name}' already exists. Overwriting definition.`);
        }
        const validatedConfig = { ...config };
        _emit("beforeRelationDefine", { name, config: validatedConfig });
        storeRelationDefinition(name, validatedConfig);
        _log(LOG_LEVELS.INFO, `[Relations] Relation '${name}' defined (${validatedConfig.type}).`);
        _emit("afterRelationDefine", { name, config: validatedConfig });
      } catch (error) {
        _emit("errorRelationDefine", { name, config, error });
        if (error.code === XDB_ERROR_CODES.INVALID_CONFIG) {
          throw error;
        } else {
          throw createXdbError(`[define relation: ${name}] Unexpected error: ${error.message}`, XDB_ERROR_CODES.OPERATION_FAILED);
        }
      }
    },
    remove: (name) => {
      const definitions = getRelationDefinitions();
      const definition = definitions[name];
      if (definition) {
        _emit("beforeRelationRemove", { name, definition });
        if (removeRelationDefinition(name)) {
          _log(LOG_LEVELS.INFO, `[Relations] Relation '${name}' removed.`);
          _emit("afterRelationRemove", { name, definition });
        } else {
          _log(LOG_LEVELS.ERROR, `[Relations] Failed to remove relation '${name}' after finding it.`);
          _emit("errorRelationRemove", { name, definition, error: new Error("Removal failed unexpectedly after definition check.") });
        }
      } else {
        _log(LOG_LEVELS.WARN, `[Relations] Relation '${name}' not found for removal.`);
      }
    },
    getRelated: async (relationName, localId) => {
      let cacheKey = null;
      if (isRelationCacheEnabled()) {
        cacheKey = `${relationName}::${localId}`;
        const cache = getRelationCache();
        const cachedEntry = cache.get(cacheKey);
        if (cachedEntry) {
          const now = Date.now();
          const ttl = getRelationCacheTTL();
          if (now - cachedEntry.timestamp <= ttl) {
            return cachedEntry.data;
          } else {
            cache.delete(cacheKey);
          }
        } else {
        }
      }
      const definitions = getRelationDefinitions();
      const relation = definitions[relationName];
      if (!relation) {
        throw createXdbError(`[getRelated] Relation '${relationName}' not defined.`, XDB_ERROR_CODES.OPERATION_FAILED);
      }
      let resultData = null;
      try {
        switch (relation.type) {
          case "1:1":
            try {
              const result = await xdB2.view.more(relation.foreignFile, { filter: (record) => record[relation.foreignField] == localId, limit: 1 });
              resultData = result.data.length > 0 ? result.data[0] : null;
              break;
            } catch (error) {
              if (error.code === XDB_ERROR_CODES.FILE_NOT_FOUND) {
                _log(LOG_LEVELS.WARN, `[getRelated: ${relationName}] Foreign file not found: ${relation.foreignFile}`);
                resultData = null;
                break;
              }
              throw createXdbError(`[getRelated: ${relationName}] Error fetching 1:1 related data from ${relation.foreignFile}: ${error.message}`, XDB_ERROR_CODES.OPERATION_FAILED);
            }
          case "1:N":
            try {
              const result = await xdB2.view.more(relation.foreignFile, { filter: (record) => record[relation.foreignField] == localId });
              resultData = result.data;
              break;
            } catch (error) {
              if (error.code === XDB_ERROR_CODES.FILE_NOT_FOUND) {
                _log(LOG_LEVELS.WARN, `[getRelated: ${relationName}] Foreign file not found: ${relation.foreignFile}`);
                resultData = [];
                break;
              }
              throw createXdbError(`[getRelated: ${relationName}] Error fetching 1:N related data from ${relation.foreignFile}: ${error.message}`, XDB_ERROR_CODES.OPERATION_FAILED);
            }
          case "N:M":
            try {
              const junctionResult = await xdB2.view.more(relation.junctionFile, { filter: (record) => record[relation.junctionLocalField] == localId });
              if (!junctionResult.data || junctionResult.data.length === 0) {
                resultData = [];
                break;
              }
              const foreignIds = junctionResult.data.map((record) => record[relation.junctionForeignField]).filter((id) => id !== void 0 && id !== null);
              if (foreignIds.length === 0) {
                resultData = [];
                break;
              }
              const foreignIdSet = new Set(foreignIds.map(String));
              const foreignResult = await xdB2.view.more(relation.foreignFile, { filter: (record) => foreignIdSet.has(String(record[relation.foreignField])) });
              resultData = foreignResult.data;
              break;
            } catch (error) {
              if (error.code === XDB_ERROR_CODES.FILE_NOT_FOUND) {
                _log(LOG_LEVELS.WARN, `[getRelated: ${relationName}] Junction file (${relation.junctionFile}) or Foreign file (${relation.foreignFile}) not found.`);
                resultData = [];
                break;
              }
              throw createXdbError(`[getRelated: ${relationName}] Error fetching N:M related data: ${error.message}`, XDB_ERROR_CODES.OPERATION_FAILED);
            }
          default:
            throw createXdbError(`[getRelated] Unknown relation type '${relation.type}' for relation '${relationName}'.`, XDB_ERROR_CODES.INVALID_CONFIG);
        }
      } catch (error) {
        throw error;
      }
      if (isRelationCacheEnabled() && cacheKey !== null) {
        getRelationCache().set(cacheKey, { data: resultData, timestamp: Date.now() });
      }
      return resultData;
    }
  }
};
var xdb_default = xdB2;
export { XDB_ERROR_CODES, xdb_default as default };
