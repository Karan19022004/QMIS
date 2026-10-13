import { apiRequest, getAccessToken, isApiTasksEnabled } from './apiClient'

/** True when the task API should be used (flag on and a real backend session exists). */
export const canUseTasksApi = () => isApiTasksEnabled() && Boolean(getAccessToken())

/** box: 'mine' (assigned to me) | 'assigned' (assigned by me) | 'all' (admin roles only). */
export const listTasksApi = (box = 'mine') => apiRequest(`/tasks?box=${encodeURIComponent(box)}`)

export const getTaskApi = (id) => apiRequest(`/tasks/${id}`)

/** Active staff users the caller can pick as assignees, optionally limited to one role code. */
export const listTaskAssigneesApi = (role) =>
    apiRequest(role ? `/tasks/assignees?role=${encodeURIComponent(role)}` : '/tasks/assignees')

/** clientRef makes a retried POST idempotent: the server returns the task it already created. */
export const createTaskApi = ({ assigneeId, title, description, priority, dueDate, clientRef }) =>
    apiRequest('/tasks', {
        method: 'POST',
        body: {
            assigneeId,
            title,
            description: description || null,
            priority,
            dueDate,
            clientRef: clientRef || null,
        },
    })

/** status must be a backend value: 'In Progress' or 'Completed'. */
export const setTaskStatusApi = (id, status, remark) =>
    apiRequest(`/tasks/${id}/status`, { method: 'POST', body: { status, remark: remark || null } })
