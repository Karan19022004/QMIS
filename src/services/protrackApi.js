import { apiRequest, getAccessToken, isApiAuthEnabled } from './apiClient'

export const isApiProtrackEnabled = () => {
    const explicit = import.meta.env.VITE_USE_API_PROTRACK
    if (explicit !== undefined && explicit !== '') return String(explicit) === 'true'
    return isApiAuthEnabled()
}

export const canUseProtrackApi = () => isApiProtrackEnabled() && Boolean(getAccessToken())

export const getProtrackStatusApi = () => apiRequest('/protrack/status')

export const listProtrackDevicesApi = (panel) => {
    const qs = panel ? `?panel=${encodeURIComponent(panel)}` : ''
    return apiRequest(`/protrack/devices${qs}`)
}

export const trackProtrackImeisApi = (imeis, panel) => {
    const list = Array.isArray(imeis) ? imeis.join(',') : String(imeis || '')
    const params = new URLSearchParams({ imeis: list })
    if (panel) params.set('panel', panel)
    return apiRequest(`/protrack/track?${params.toString()}`)
}

export const datastatusLabel = (code) =>
    ({
        1: 'Never online',
        2: 'Online',
        3: 'Expired',
        4: 'Offline',
        5: 'Blocked',
    })[Number(code)] || 'Unknown'
