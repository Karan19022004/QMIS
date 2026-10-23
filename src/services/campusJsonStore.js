import { canUseOpsApi, listOpsCollectionApi, replaceOpsCollectionApi, stripOpsMeta } from './opsApi'
import {
    canUseCampusAuditApi,
    listCampusAuditCollectionApi,
    replaceCampusAuditCollectionApi,
    stripCampusAuditMeta,
} from './campusAuditApi'
import { resolveCampusCollection } from './campusCollectionRegistry'

/** In-memory campus SoT keyed by storageKey when API mode is on. */
const memoryByKey = new Map()
const hydratePromises = new Map()

const clean = (kind, rows) => {
    const strip = kind === 'audit' ? stripCampusAuditMeta : stripOpsMeta
    return Array.isArray(rows) ? rows.map(strip) : []
}

const canUse = (kind) => (kind === 'audit' ? canUseCampusAuditApi() : canUseOpsApi())

const listApi = (kind, collection) =>
    kind === 'audit' ? listCampusAuditCollectionApi(collection) : listOpsCollectionApi(collection)

const replaceApi = (kind, collection, items) =>
    kind === 'audit'
        ? replaceCampusAuditCollectionApi(collection, items)
        : replaceOpsCollectionApi(collection, items)

export const usesCampusApiForKey = (storageKey) => {
    const meta = resolveCampusCollection(storageKey)
    return Boolean(meta && canUse(meta.kind))
}

export const getCampusMemory = (storageKey) => {
    if (!memoryByKey.has(storageKey)) return null
    return structuredClone(memoryByKey.get(storageKey))
}

export const setCampusMemory = (storageKey, rows, { push = true } = {}) => {
    const list = Array.isArray(rows) ? rows : []
    memoryByKey.set(storageKey, list)
    if (!push) return Promise.resolve(true)
    const meta = resolveCampusCollection(storageKey)
    if (!meta || !canUse(meta.kind)) return Promise.resolve(true)
    return replaceApi(meta.kind, meta.collection, clean(meta.kind, list)).then(() => true).catch(() => false)
}

export const clearCampusJsonMemory = () => {
    memoryByKey.clear()
    hydratePromises.clear()
}

export const hydrateCampusKey = async (storageKey, seed = []) => {
    void seed
    const meta = resolveCampusCollection(storageKey)
    if (!meta || !canUse(meta.kind)) return false
    if (hydratePromises.has(storageKey)) return hydratePromises.get(storageKey)

    const work = (async () => {
        try {
            const rows = await listApi(meta.kind, meta.collection)
            memoryByKey.set(storageKey, clean(meta.kind, rows))
            try {
                localStorage.removeItem(storageKey)
            } catch {
                /* ignore */
            }
            return true
        } catch {
            if (!memoryByKey.has(storageKey)) memoryByKey.set(storageKey, [])
            return false
        } finally {
            hydratePromises.delete(storageKey)
        }
    })()

    hydratePromises.set(storageKey, work)
    return work
}

/**
 * Drop-in helpers for modules that used localStorage.getItem/setItem(STORAGE_KEY).
 */
export const loadCampusJson = (storageKey, fallback) => {
    if (usesCampusApiForKey(storageKey)) {
        const mem = getCampusMemory(storageKey)
        if (mem != null) return mem
        return Array.isArray(fallback) ? [] : fallback
    }
    try {
        const raw = localStorage.getItem(storageKey)
        if (!raw) return fallback
        return JSON.parse(raw) ?? fallback
    } catch {
        return fallback
    }
}

export const saveCampusJson = (storageKey, value) => {
    if (usesCampusApiForKey(storageKey)) {
        const pending = setCampusMemory(storageKey, value, { push: true })
        try {
            localStorage.removeItem(storageKey)
        } catch {
            /* ignore */
        }
        return pending
    }
    try {
        localStorage.setItem(storageKey, JSON.stringify(value))
        return true
    } catch {
        return false
    }
}

export const ensureCampusSeed = (storageKey, seed) => {
    if (usesCampusApiForKey(storageKey)) {
        const mem = getCampusMemory(storageKey)
        if (mem != null) return mem
        memoryByKey.set(storageKey, [])
        hydrateCampusKey(storageKey)
        return []
    }
    try {
        const raw = localStorage.getItem(storageKey)
        if (raw == null) {
            localStorage.setItem(storageKey, JSON.stringify(seed))
            return structuredClone(seed)
        }
        return JSON.parse(raw)
    } catch {
        return structuredClone(seed)
    }
}
