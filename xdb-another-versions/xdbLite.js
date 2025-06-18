/* xdb-lite library
 * Status: Private prototype
 * License: MIT
 * ------------------------------------------------------------------------------
 * Copyright (c) 2025 Jakub Śledzikowski <jsledzikowski.web@gmail.com>
 *
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fsSync from "node:fs";
import crypto from "node:crypto";

const XDB_ERROR_CODES = {
    FILE_NOT_FOUND: "XDB_FILE_NOT_FOUND",
    DIR_NOT_FOUND: "XDB_DIR_NOT_FOUND",
    IO_ERROR: "XDB_IO_ERROR",
    INVALID_JSON: "XDB_INVALID_JSON",
    RECORD_NOT_FOUND: "XDB_RECORD_NOT_FOUND",
    RECORD_EXISTS: "XDB_RECORD_EXISTS",
    OPERATION_FAILED: "XDB_OPERATION_FAILED"
};

const LOG_LEVELS = {
    DEBUG: 10,
    INFO: 20,
    WARN: 30,
    ERROR: 40,
    NONE: 100
};

const __filename = '';
const __dirname = process.cwd();
let basePath = __dirname;
const DEFAULT_XDB_ID_LENGTH = 16;
const DEFAULT_LOCK_TIMEOUT = 5000;

const fileLocks = new Map();
const dataCache = new Map();
let currentLogLevel = LOG_LEVELS.INFO;
let cachingEnabled = false;
let cacheTTL = 60000; // 1 minuta

function log(level, message, ...args) {
    if (level < currentLogLevel) return;

    const timestamp = new Date().toISOString();
    const levelName = Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === level) || "UNKNOWN";
    const formattedMessage = `[${timestamp}] [${levelName}] ${message}`;

    switch (level) {
        case LOG_LEVELS.DEBUG:
            console.debug(formattedMessage, ...args);
            break;
        case LOG_LEVELS.INFO:
            console.log(formattedMessage, ...args);
            break;
        case LOG_LEVELS.WARN:
            console.warn(formattedMessage, ...args);
            break;
        case LOG_LEVELS.ERROR:
            console.error(formattedMessage, ...args);
            break;
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

function generateId(length = DEFAULT_XDB_ID_LENGTH) {
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
        log(LOG_LEVELS.WARN, `Nie udało się użyć crypto, używam zapasowego generatora ID: ${err.message}`);

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

function getCacheKey(filePath, id = null) {
    filePath = ensureJsonExtension(filePath);
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

async function safeParseJSON(filePath) {
    const fullPath = path.resolve(basePath, filePath);

    const cachedData = getCachedData(filePath);
    if (cachedData !== null) {
        return cachedData;
    }

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
        if (readError.code === "ENOENT") {
            return [];
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

async function cleanupTempFile(tempPath) {
    if (!tempPath) return;
    try {
        await fs.unlink(tempPath);
    } catch (e) {
        if (e.code !== "ENOENT") {
            log(LOG_LEVELS.WARN, `Nie udało się usunąć pliku tymczasowego ${tempPath}: ${e.message}`);
        }
    }
}

function getBasePath() {
    return basePath;
}

async function acquireLock(filePath, timeout = DEFAULT_LOCK_TIMEOUT) {
    const fullPath = path.resolve(getBasePath(), filePath);
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
        if (release) {
            release();
        }
        fileLocks.delete(fullPath);
        log(LOG_LEVELS.DEBUG, `Zwolniono blokadę dla: ${fullPath}`);
    }
}

async function atomicWrite(filePath, data) {
    const fullPath = path.resolve(getBasePath(), filePath);
    let tempPath;
    let fileHandle;

    try {
        tempPath = fullPath + ".tmp" + Date.now() + Math.random();
        await ensureDirectoryExists(path.dirname(fullPath));

        fileHandle = await fs.open(tempPath, "w");
        await fileHandle.writeFile(data, "utf-8");
        await fileHandle.sync();
        await fileHandle.close();
        fileHandle = null;

        await fs.rename(tempPath, fullPath);
        log(LOG_LEVELS.DEBUG, `Pomyślnie zapisano plik: ${filePath}`);

        invalidateCache(filePath);
    } catch (error) {
        if (fileHandle) {
            try {
                await fileHandle.close();
            } catch (closeError) {
                log(LOG_LEVELS.WARN, `Nie udało się zamknąć uchwytu pliku tymczasowego: ${closeError.message}`);
            }
        }

        await cleanupTempFile(tempPath);
        throw createXdbError(`Atomowy zapis do ${filePath} nie powiódł się: ${error.message}`, XDB_ERROR_CODES.IO_ERROR);
    }
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
            const levelName = Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === requestedLevel);
            log(LOG_LEVELS.INFO, `Ustawiono poziom logowania: ${levelName || requestedLevel}`);
        }
    }

    if (options.cachingEnabled !== undefined) {
        cachingEnabled = !!options.cachingEnabled;
        log(LOG_LEVELS.INFO, `Cache ${cachingEnabled ? 'włączony' : 'wyłączony'}`);

        if (!cachingEnabled) {
            clearAllCache();
        }
    }

    if (options.cacheTTL !== undefined && typeof options.cacheTTL === 'number' && options.cacheTTL > 0) {
        cacheTTL = options.cacheTTL;
        log(LOG_LEVELS.INFO, `Ustawiono TTL cache: ${cacheTTL}ms`);
    }

    return {
        basePath: getBasePath(),
        logLevel: currentLogLevel,
        cachingEnabled,
        cacheTTL
    };
}

async function addDir(dirPath) {
    try {
        const fullPath = path.resolve(getBasePath(), dirPath);
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
    const fullPath = path.resolve(getBasePath(), dirPath);

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
    const oldFullPath = path.resolve(getBasePath(), oldPath);
    const newFullPath = path.resolve(getBasePath(), newPath);

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
    sourcePath = ensureJsonExtension(sourcePath);
    targetPath = ensureJsonExtension(targetPath);

    const sourceFullPath = path.resolve(getBasePath(), sourcePath);
    const targetFullPath = path.resolve(getBasePath(), targetPath);

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

        let data = await safeParseJSON(filePath);
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
            if (statError.code === "ENOENT") {
                return { path: fullPath };
            }
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
        filePath = ensureJsonExtension(filePath);
        const parsedData = await safeParseJSON(filePath);
        return { path: path.resolve(basePath, filePath), data: parsedData };
    } catch (error) {
        log(LOG_LEVELS.ERROR, `Błąd podczas pobierania danych z ${filePath}: ${error.message}`);
        if (error.code && Object.values(XDB_ERROR_CODES).includes(error.code)) throw error;
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

        // Filtrowanie
        if (options.filter && typeof options.filter === 'function') {
            try {
                data = data.filter(options.filter);
            } catch (filterError) {
                throw createXdbError(`Błąd podczas filtrowania: ${filterError.message}`, XDB_ERROR_CODES.OPERATION_FAILED);
            }
        }

        // Sortowanie
        if (options.sort) {
            const sortCriteria = Array.isArray(options.sort) ? options.sort : [options.sort];

            try {
                data.sort((a, b) => {
                    for (const criterion of sortCriteria) {
                        const { key, order = 'asc' } = criterion;
                        const direction = order.toLowerCase() === 'desc' ? -1 : 1;

                        if (!key || typeof key !== 'string') {
                            continue;
                        }

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

        // Paginacja
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

const xdBLite = {
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
    }
};

export default xdBLite;

/*

Technical documentation for xdbl.js

Description:
- xdbl.js is an extended JSON file-based database library for Node.js.
- Supports full data operations: create, read, update, delete.
- Additionally provides folder management and file operations such as moving files.
- Uses Node.js built-in modules fs/promises, path, node:fs, crypto, and others.

Key functions and modules:
1. Configuration:
   - setConfig: Allows setting base path, log level, and cache parameters.
2. File operations:
   - ensureJsonExtension: Adds .json extension if missing.
   - ensureDirectoryExists: Recursively creates directories.
   - atomicWrite: Atomically writes data to file using temporary file and rename.
3. CRUD operations:
   - addRecordById (and add.all): Adds record with unique ID generation and duplicate check.
   - editRecordById (and edit.all): Modifies record by ID.
   - deleteRecordById (and deleteAll): Deletes record or all records.
   - viewRecordById, view.all: Reads data with optional caching.
4. Cache handling:
   - getCacheKey, getCachedData, setCachedData, invalidateCache manage optional cache.
5. Folder and file management:
   - Directory operations: add, del, rename.
   - move.file: Moves a file to a new location.
6. Error handling:
   - createXdbError: Standardizes errors with codes and messages.
7. Notes:
   - File locking ensures data consistency in concurrent operations.
   - Asynchronous operations provide non-blocking access.
   - No external dependencies; fully based on Node.js built-in modules.
*/