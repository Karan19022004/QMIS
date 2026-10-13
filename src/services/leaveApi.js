import { apiRequest, getAccessToken, isApiLeaveEnabled } from './apiClient'

/** True when the leave API should be used (flag on and a real backend session exists). */
export const canUseLeaveApi = () => isApiLeaveEnabled() && Boolean(getAccessToken())

export const listLeaveApi = (box = 'mine') => apiRequest(`/leave-requests?box=${encodeURIComponent(box)}`)

export const getLeaveApi = (id) => apiRequest(`/leave-requests/${id}`)

export const createLeaveApi = ({ leaveType, fromDate, toDate, hours, reason }) =>
    apiRequest('/leave-requests', {
        method: 'POST',
        body: { leaveType, fromDate, toDate, hours: hours ?? null, reason },
    })

export const decideLeaveApi = (id, decision, comment) =>
    apiRequest(`/leave-requests/${id}/decide`, { method: 'POST', body: { decision, comment: comment || null } })
