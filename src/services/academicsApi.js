import { apiRequest, getAccessToken, isApiAuthEnabled } from './apiClient'

export const isApiAcademicsEnabled = () => {
    const explicit = import.meta.env.VITE_USE_API_ACADEMICS
    if (explicit !== undefined && explicit !== '') return String(explicit) === 'true'
    return isApiAuthEnabled()
}

export const canUseAcademicsApi = () => isApiAcademicsEnabled() && Boolean(getAccessToken())

const enc = encodeURIComponent

export const listAcademicsCollectionApi = (collection) =>
    apiRequest(`/academics/${enc(collection)}`)

export const replaceAcademicsCollectionApi = (collection, items) =>
    apiRequest(`/academics/${enc(collection)}`, { method: 'PUT', body: items })

/** Drop server bookkeeping keys before persisting in memory / re-PUT. */
export const stripAcademicsMeta = (row) => {
    if (!row || typeof row !== 'object') return row
    const next = { ...row }
    delete next._collection
    delete next._updatedAt
    delete next._createdAt
    return next
}
