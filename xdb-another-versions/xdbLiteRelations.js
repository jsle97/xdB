/* xdb-relations library
 * Status: Private prototype
 * License: MIT
 * ------------------------------------------------------------------------------
 * Copyright (c) 2025 Jakub Śledzikowski <jsledzikowski.web@gmail.com>
 *
 */
import xdB from './xdbLite.js';

const relationsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

async function createOneToMany(options) {
    const { fromCollection, fromId, toCollection, toField, toIds } = options;

    if (!fromCollection || !fromId || !toCollection || !toField) {
        throw new Error('Missing parameters for one-to-many relation');
    }

    const relationKey = `${fromCollection}:${fromId}:${toCollection}:${toField}`;

    for (const toId of toIds || []) {
        const record = await xdB.view.id(toCollection, toId);
        if (record.record) {
            await xdB.edit.id(toCollection, toId, {
                [toField]: fromId
            });
        }
    }

    invalidateRelationCache(relationKey);

    return { success: true, relationKey };
}

async function createManyToMany(options) {
    const { collection1, id1, collection2, id2, junctionTable = null } = options;

    const tableName = junctionTable || `${collection1}_${collection2}_relations.json`;

    const existingRelations = await xdB.view.all(tableName);
    const exists = existingRelations.data.some(rel =>
        (rel.collection1_id === id1 && rel.collection2_id === id2) ||
        (rel.collection1_id === id2 && rel.collection2_id === id1)
    );

    if (exists) {
        return { success: false, error: 'Relation already exists' };
    }

    const relation = {
        collection1: collection1,
        collection1_id: id1,
        collection2: collection2,
        collection2_id: id2,
        createdAt: new Date().toISOString()
    };

    const result = await xdB.add.id(tableName, relation);

    invalidateRelationCache(`${collection1}:${id1}`);
    invalidateRelationCache(`${collection2}:${id2}`);

    return { success: true, relation: result.record };
}

async function getRelated(options) {
    const { fromCollection, fromId, toCollection, toField } = options;

    const cacheKey = `${fromCollection}:${fromId}:${toCollection}:${toField}`;
    const cached = getCachedRelation(cacheKey);
    if (cached) return cached;

    const result = await xdB.view.more(toCollection, {
        filter: (record) => record[toField] === fromId
    });

    setCachedRelation(cacheKey, result.data);

    return result.data;
}

async function getManyToManyRelated(options) {
    const { collection, id, targetCollection, junctionTable = null } = options;

    const tableName = junctionTable || `${collection}_${targetCollection}_relations.json`;
    const cacheKey = `m2m:${collection}:${id}:${targetCollection}`;

    const cached = getCachedRelation(cacheKey);
    if (cached) return cached;

    const relations = await xdB.view.all(tableName);
    const relatedIds = [];

    for (const rel of relations.data) {
        if (rel.collection1 === collection && rel.collection1_id === id) {
            relatedIds.push(rel.collection2_id);
        } else if (rel.collection2 === collection && rel.collection2_id === id) {
            relatedIds.push(rel.collection1_id);
        }
    }

    const relatedRecords = [];
    for (const relatedId of relatedIds) {
        try {
            const record = await xdB.view.id(targetCollection, relatedId);
            if (record.record) {
                relatedRecords.push(record.record);
            }
        } catch (err) {
            console.warn(`Record ${relatedId} not found in ${targetCollection}`);
        }
    }

    setCachedRelation(cacheKey, relatedRecords);

    return relatedRecords;
}

async function removeRelation(options) {
    const { fromCollection, fromId, toCollection, toId, toField } = options;

    if (toField) {
        const record = await xdB.view.id(toCollection, toId);
        if (record.record && record.record[toField] === fromId) {
            await xdB.edit.id(toCollection, toId, {
                [toField]: null
            });
        }

        invalidateRelationCache(`${fromCollection}:${fromId}:${toCollection}:${toField}`);
    } else {
        const junctionTable = options.junctionTable || `${fromCollection}_${toCollection}_relations.json`;
        const relations = await xdB.view.all(junctionTable);

        for (const rel of relations.data) {
            if ((rel.collection1_id === fromId && rel.collection2_id === toId) ||
                (rel.collection1_id === toId && rel.collection2_id === fromId)) {
                await xdB.del.id(junctionTable, rel.id);
                break;
            }
        }

        invalidateRelationCache(`${fromCollection}:${fromId}`);
        invalidateRelationCache(`${toCollection}:${toId}`);
    }

    return { success: true };
}

async function checkIntegrity(collection, id) {
    const issues = [];

    try {
        await xdB.view.id(collection, id);
    } catch (err) {
        issues.push({
            type: 'missing_record',
            collection,
            id,
            message: `Record ${id} does not exist in ${collection}`
        });
    }

    return { valid: issues.length === 0, issues };
}

async function cascadeDelete(options) {
    const { collection, id, relations = [] } = options;
    const deleted = [];

    for (const relation of relations) {
        if (relation.type === 'oneToMany') {
            const related = await getRelated({
                fromCollection: collection,
                fromId: id,
                toCollection: relation.toCollection,
                toField: relation.toField
            });

            for (const record of related) {
                if (relation.onDelete === 'cascade') {
                    await xdB.del.id(relation.toCollection, record.id);
                    deleted.push({ collection: relation.toCollection, id: record.id });
                } else if (relation.onDelete === 'setNull') {
                    await xdB.edit.id(relation.toCollection, record.id, {
                        [relation.toField]: null
                    });
                }
            }
        }
    }

    await xdB.del.id(collection, id);
    deleted.push({ collection, id });

    return { deleted };
}

function getCachedRelation(key) {
    const cached = relationsCache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > CACHE_TTL) {
        relationsCache.delete(key);
        return null;
    }

    return cached.data;
}

function setCachedRelation(key, data) {
    relationsCache.set(key, {
        data,
        timestamp: Date.now()
    });
}

function invalidateRelationCache(keyPattern) {
    if (!keyPattern) {
        relationsCache.clear();
        return;
    }

    for (const key of relationsCache.keys()) {
        if (key.includes(keyPattern)) {
            relationsCache.delete(key);
        }
    }
}

export default {
    createOneToMany,
    createManyToMany,
    getRelated,
    getManyToManyRelated,
    removeRelation,
    checkIntegrity,
    cascadeDelete,
    clearCache: () => relationsCache.clear()
};




/*

Technical documentation for xdbRelations.js

Description:
- xdbRelations.js extends the xdbl.js module with the ability to manage relationships between records.
- Supports one-to-many and many-to-many relationships between records in different collections.
- Provides detailed functions for creating, retrieving, and removing relationships, as well as maintaining data integrity.

Key functions:
1. createOneToMany
   - Creates a one-to-many relationship.
   - Updates target collection records by assigning appropriate identifiers.
   - Invalidates relation cache after operation.

2. createManyToMany
   - Creates a many-to-many relationship using a junction table.
   - Checks if the relationship already exists.
   - Adds new relationship and invalidates cache.

3. getRelated
   - Retrieves related records for one-to-many relationships.
   - Uses caching to speed up data access.

4. getManyToManyRelated
   - Retrieves related records for many-to-many relationships.
   - Scans junction table to identify related IDs, then fetches corresponding records.
   - Uses cache for performance optimization.

5. removeRelation
   - Removes a relationship.
   - For one-to-many, removes link from target record.
   - For many-to-many, removes relation from junction table.
   - Invalidates relevant cache entries.

6. checkIntegrity
   - Checks relationship integrity by verifying record existence in collection.
   - Returns information about issues or missing records.

7. cascadeDelete
   - Enables cascading deletion of related records.
   - For one-to-many, deletes related records or sets relation key to null based on configuration.
   - Finally deletes the main record.

Technical notes:
- Integrates with xdbl.js module, using its CRUD functions.
- Relation caching stores query results to improve performance on frequent access.
- Cache invalidation ensures data freshness after modifications.
- Entire implementation uses asynchronous operations for non-blocking data access.
- No external dependencies; uses only Node.js built-in modules.
*/