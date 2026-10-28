import { apiRequest, getAccessToken, isApiAuthEnabled } from './apiClient'

export const isApiOpsEnabled = () => {
    const explicit = import.meta.env.VITE_USE_API_OPS
    if (explicit !== undefined && explicit !== '') return String(explicit) === 'true'
    return isApiAuthEnabled()
}

export const canUseOpsApi = () => isApiOpsEnabled() && Boolean(getAccessToken())

const enc = encodeURIComponent

export const listOpsCollectionApi = (collection) => apiRequest(`/ops/${enc(collection)}`)

/** Save one record of an item-saved collection (e.g. som-matrix) without replacing the rest. */
export const upsertOpsItemApi = (collection, itemId, body) =>
    apiRequest(`/ops/${enc(collection)}/items/${enc(itemId)}`, { method: 'PUT', body })

/** Any signed-in user raises one IT ticket; the server numbers it and records the requester. */
export const raiseItTicketApi = (body) =>
    apiRequest('/ops/it-support-tickets/raise', { method: 'POST', body })

/** IT tickets raised by the signed-in user. */
export const listMyItTicketsApi = () => apiRequest('/ops/it-support-tickets/mine')

export const replaceOpsCollectionApi = (collection, items) =>
    apiRequest(`/ops/${enc(collection)}`, { method: 'PUT', body: items })

export const stripOpsMeta = (row) => {
    if (!row || typeof row !== 'object') return row
    const next = { ...row }
    delete next._collection
    delete next._updatedAt
    delete next._createdAt
    return next
}
