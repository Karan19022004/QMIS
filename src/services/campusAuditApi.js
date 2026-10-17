import { apiRequest, getAccessToken, isApiAuthEnabled } from './apiClient'

export const isApiCampusAuditEnabled = () => {
    const explicit = import.meta.env.VITE_USE_API_CAMPUS_AUDIT
    if (explicit !== undefined && explicit !== '') return String(explicit) === 'true'
    return isApiAuthEnabled()
}

export const canUseCampusAuditApi = () => isApiCampusAuditEnabled() && Boolean(getAccessToken())

const enc = encodeURIComponent

export const listCampusAuditCollectionApi = (collection) =>
    apiRequest(`/campus-audit/${enc(collection)}`)

export const replaceCampusAuditCollectionApi = (collection, items) =>
    apiRequest(`/campus-audit/${enc(collection)}`, { method: 'PUT', body: items })

export const stripCampusAuditMeta = (row) => {
    if (!row || typeof row !== 'object') return row
    const next = { ...row }
    delete next._collection
    delete next._updatedAt
    delete next._createdAt
    return next
}
