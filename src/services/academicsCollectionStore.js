import {
    canUseAcademicsApi,
    listAcademicsCollectionApi,
    replaceAcademicsCollectionApi,
    stripAcademicsMeta,
} from './academicsApi'

/**
 * Shared in-memory + DB store for campus academics collections.
 * When API auth is on, browser localStorage is purged and never used as SoT.
 */
export function createAcademicsCollectionStore({
    collection,
    storageKey,
    eventName,
    normalize = (row) => row,
    offlineFallback = () => [],
}) {
    let apiMemory = null
    let hydratePromise = null
    let persistPromise = null

    const emitUpdated = () => {
        try {
            window.dispatchEvent(new CustomEvent(eventName))
        } catch {
            /* ignore */
        }
    }

    const purgeBrowserCopies = () => {
        try {
            localStorage.removeItem(storageKey)
            sessionStorage.removeItem(storageKey)
        } catch {
            /* ignore */
        }
    }

    const cleanList = (rows) => (Array.isArray(rows) ? rows.map(stripAcademicsMeta) : [])

    const normalizeList = (rows) =>
        cleanList(rows)
            .map((row) => normalize(row))
            .filter((item) => item && item.id)

    const hydrate = async ({ force = false } = {}) => {
        if (!canUseAcademicsApi()) return false
        if (persistPromise) {
            try {
                await persistPromise
            } catch {
                /* continue */
            }
        }
        if (hydratePromise && !force) return hydratePromise
        hydratePromise = listAcademicsCollectionApi(collection)
            .then((rows) => {
                apiMemory = normalizeList(rows)
                purgeBrowserCopies()
                emitUpdated()
                return true
            })
            .catch(() => {
                if (apiMemory == null) apiMemory = []
                emitUpdated()
                return false
            })
            .finally(() => {
                hydratePromise = null
            })
        return hydratePromise
    }

    const getAll = () => {
        if (canUseAcademicsApi()) {
            return Array.isArray(apiMemory) ? apiMemory.map((item) => ({ ...item })) : []
        }
        try {
            const stored = localStorage.getItem(storageKey)
            if (stored) {
                const parsed = JSON.parse(stored)
                if (Array.isArray(parsed)) return normalizeList(parsed)
            }
        } catch {
            /* ignore */
        }
        return normalizeList(offlineFallback())
    }

    const saveAll = async (records) => {
        const list = normalizeList(records)
        if (canUseAcademicsApi()) {
            apiMemory = list
            emitUpdated()
            persistPromise = replaceAcademicsCollectionApi(collection, cleanList(list))
                .then((rows) => {
                    if (Array.isArray(rows)) {
                        apiMemory = normalizeList(rows)
                    }
                    emitUpdated()
                    return apiMemory
                })
                .finally(() => {
                    persistPromise = null
                })
            await persistPromise
            return list
        }
        localStorage.setItem(storageKey, JSON.stringify(list))
        emitUpdated()
        return list
    }

    const clearMemory = () => {
        apiMemory = null
        emitUpdated()
    }

    return {
        collection,
        eventName,
        hydrate,
        getAll,
        saveAll,
        clearMemory,
        canUseApi: canUseAcademicsApi,
        ensureHydrated: async () => {
            if (canUseAcademicsApi()) await hydrate()
        },
    }
}

export const nextPrefixedId = (existing, prefix, start = 1001) => {
    const used = new Set((existing || []).map((item) => String(item.id || '')))
    let n = Math.max(start, (existing?.length || 0) + start)
    let candidate = `${prefix}-${n}`
    while (used.has(candidate)) {
        n += 1
        candidate = `${prefix}-${n}`
    }
    return candidate
}
