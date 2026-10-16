import { apiRequest, getAccessToken, isApiAuthEnabled } from './apiClient'

export const canUseApprovalsApi = () => isApiAuthEnabled() && Boolean(getAccessToken())

/** Approvals waiting on the signed-in role. */
export const listApprovalsInboxApi = () => apiRequest('/approvals/inbox')

/** Approvals submitted by the signed-in user. */
export const listApprovalsMineApi = () => apiRequest('/approvals/mine')

export const getApprovalApi = (approvalId) => apiRequest(`/approvals/${approvalId}`)

/**
 * @param {string} approvalId
 * @param {{ decision: 'approve' | 'deny', comment?: string }} body
 */
export const decideApprovalApi = (approvalId, body) =>
    apiRequest(`/approvals/${approvalId}/decide`, {
        method: 'POST',
        body: {
            decision: body.decision,
            comment: body.comment || null,
        },
    })
