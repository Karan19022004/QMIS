import { apiRequest, getAccessToken, isApiDocumentsEnabled } from './apiClient'

/** True when the signed-in user's documents come from the server (never the browser). */
export const canUseDocumentsApi = () => isApiDocumentsEnabled() && Boolean(getAccessToken())

const enc = encodeURIComponent

export const listDocumentRecordsApi = (kind) => apiRequest(`/documents/${kind}`)

/** Add or replace one document. `file` is optional when only the status changes. */
export const putDocumentItemApi = (kind, ref, { label, file, status, submittedDate }) => {
    const body = new FormData()
    body.append('label', label)
    if (file) body.append('file', file)
    if (status) body.append('status', status)
    if (submittedDate) body.append('submitted_date', submittedDate)
    return apiRequest(`/documents/${kind}/${enc(ref)}/items`, { method: 'PUT', body, formData: true })
}

export const patchDocumentRecordApi = (kind, ref, { submittedDate, status }) =>
    apiRequest(`/documents/${kind}/${enc(ref)}`, {
        method: 'PATCH',
        body: { submitted_date: submittedDate || null, status: status || null },
    })

export const deleteDocumentItemApi = (kind, ref, itemId) =>
    apiRequest(`/documents/${kind}/${enc(ref)}/items/${enc(itemId)}`, { method: 'DELETE' })

/**
 * Open a stored file in a new tab. The file is fetched with the sign-in header (the token is never put
 * in the address) and shown from a temporary in-memory URL. The blank tab is opened first, inside the
 * click, so the browser's pop-up blocker allows it.
 */
export async function openStoredDocument(downloadUrl) {
    const viewer = window.open('', '_blank')
    try {
        const response = await apiRequest(String(downloadUrl).replace(/^\/api\/v1/, ''))
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        if (viewer) {
            viewer.location.href = url
        } else {
            // The browser refused the new tab: save the file instead of navigating away from the app.
            const named = /filename="?([^";]+)"?/i.exec(response.headers.get('content-disposition') || '')
            const link = document.createElement('a')
            link.href = url
            link.download = named ? named[1] : 'document'
            document.body.appendChild(link)
            link.click()
            link.remove()
        }
        setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000)
    } catch (error) {
        if (viewer) viewer.close()
        throw error
    }
}

export const isoToDmy = (iso) => {
    if (!iso) return ''
    const [year, month, day] = String(iso).slice(0, 10).split('-')
    return `${day}-${month}-${year}`
}

/** 'dd-mm-yyyy' (what the screens store) to 'yyyy-mm-dd' (what the API takes). */
export const dmyToIso = (value) => {
    const parts = String(value || '').split('-')
    if (parts.length !== 3) return ''
    const [day, month, year] = parts
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}
