const TOKEN_KEY = 'schoolerp_api_token'

export const getApiBaseUrl = () =>
    (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1').replace(/\/$/, '')

export const isApiAuthEnabled = () => String(import.meta.env.VITE_USE_API_AUTH || 'true') === 'true'
export const isApiAdmissionsEnabled = () =>
    String(import.meta.env.VITE_USE_API_ADMISSIONS || 'false') === 'true'
export const isApiFinanceEnabled = () =>
    String(import.meta.env.VITE_USE_API_FINANCE || 'true') === 'true'
/**
 * Student UIS list/detail. Defaults on whenever API sign-in is on (matches .env.example).
 * Admissions write flows stay behind VITE_USE_API_ADMISSIONS separately.
 */
export const isApiStudentsEnabled = () => {
    const explicit = import.meta.env.VITE_USE_API_STUDENTS
    if (explicit !== undefined && explicit !== '') {
        return String(explicit) === 'true'
    }
    return isApiAuthEnabled()
}
/** Class attendance SoT — defaults on with students/auth API. */
export const isApiAttendanceEnabled = () => {
    const explicit = import.meta.env.VITE_USE_API_ATTENDANCE
    if (explicit !== undefined && explicit !== '') {
        return String(explicit) === 'true'
    }
    return isApiStudentsEnabled()
}

/** Leave requests SoT — defaults on with students/auth API. */
export const isApiLeaveEnabled = () => {
    const explicit = import.meta.env.VITE_USE_API_LEAVE
    if (explicit !== undefined && explicit !== '') {
        return String(explicit) === 'true'
    }
    return isApiStudentsEnabled()
}
/** Escalations (24h clock) SoT — defaults on with students/auth API. */
export const isApiEscalationsEnabled = () => {
    const explicit = import.meta.env.VITE_USE_API_ESCALATIONS
    if (explicit !== undefined && explicit !== '') {
        return String(explicit) === 'true'
    }
    return isApiStudentsEnabled()
}
/** Task Management SoT — defaults on with students/auth API. */
export const isApiTasksEnabled = () => {
    const explicit = import.meta.env.VITE_USE_API_TASKS
    if (explicit !== undefined && explicit !== '') {
        return String(explicit) === 'true'
    }
    return isApiStudentsEnabled()
}
/** Notifications + approvals inbox — defaults on with students/auth API. */
export const isApiNotificationsEnabled = () => {
    const explicit = import.meta.env.VITE_USE_API_NOTIFICATIONS
    if (explicit !== undefined && explicit !== '') {
        return String(explicit) === 'true'
    }
    return isApiStudentsEnabled()
}

/**
 * Admin user creation + roles SoT. Defaults on whenever API sign-in is on: a login created only
 * in the browser could never sign in, so creation must go through the server.
 */
export const isApiAdminUsersEnabled = () => {
    const explicit = import.meta.env.VITE_USE_API_ADMIN_USERS
    if (explicit !== undefined && explicit !== '') {
        return String(explicit) === 'true'
    }
    return isApiAuthEnabled()
}

/**
 * Administrator Employee Database reads the HR employee API (and the admin user list). Defaults
 * on whenever API sign-in is on; set VITE_USE_API_EMPLOYEES=false for the browser-only list.
 */
export const isApiEmployeeDirectoryEnabled = () => {
    const explicit = import.meta.env.VITE_USE_API_EMPLOYEES
    if (explicit !== undefined && explicit !== '') {
        return String(explicit) === 'true'
    }
    return isApiAuthEnabled()
}

/**
 * Administrator Class Details reads and writes classes, sections and academic years through the
 * masters API. Defaults on whenever API sign-in is on; set VITE_USE_API_CLASSES=false for the
 * browser-only class catalog.
 */
export const isApiClassDetailsEnabled = () => {
    const explicit = import.meta.env.VITE_USE_API_CLASSES
    if (explicit !== undefined && explicit !== '') {
        return String(explicit) === 'true'
    }
    return isApiAuthEnabled()
}

/**
 * Administrator Attendance (students and employees) reads the attendance and HR APIs. Defaults on
 * whenever API sign-in is on; set VITE_USE_API_ADMIN_ATTENDANCE=false for the browser-only demo rows.
 */
export const isApiAdminAttendanceEnabled = () => {
    const explicit = import.meta.env.VITE_USE_API_ADMIN_ATTENDANCE
    if (explicit !== undefined && explicit !== '') {
        return String(explicit) === 'true'
    }
    return isApiAuthEnabled()
}

/**
 * Administrator Documents (student and employee uploads) go through the documents API, which stores
 * the files and enforces who may read them. Defaults on whenever API sign-in is on; set
 * VITE_USE_API_DOCUMENTS=false for the browser-only file-name list.
 */
export const isApiDocumentsEnabled = () => {
    const explicit = import.meta.env.VITE_USE_API_DOCUMENTS
    if (explicit !== undefined && explicit !== '') {
        return String(explicit) === 'true'
    }
    return isApiAuthEnabled()
}

/**
 * Announcements (every role's list, the Administrator's add/view) come from the server whenever the user
 * signs in with a backend account. Set VITE_USE_API_ANNOUNCEMENTS=false for the browser-only list.
 */
export const isApiAnnouncementsEnabled = () => {
    const explicit = import.meta.env.VITE_USE_API_ANNOUNCEMENTS
    if (explicit !== undefined && explicit !== '') {
        return String(explicit) === 'true'
    }
    return isApiAuthEnabled()
}

const flagOrAuth = (envName) => {
    const explicit = import.meta.env[envName]
    if (explicit !== undefined && explicit !== '') return String(explicit) === 'true'
    return isApiAuthEnabled()
}

export const isApiCalendarEnabled = () => flagOrAuth('VITE_USE_API_CALENDAR')
export const isApiTcEnabled = () => flagOrAuth('VITE_USE_API_TC')
export const isApiActivitiesEnabled = () => flagOrAuth('VITE_USE_API_ACTIVITIES')
export const isApiCommunicationEnabled = () => flagOrAuth('VITE_USE_API_COMMUNICATION')
export const isApiDashboardEnabled = () => flagOrAuth('VITE_USE_API_DASHBOARD')

export const getAccessToken = () => sessionStorage.getItem(TOKEN_KEY)
export const setAccessToken = (token) => {
    if (token) sessionStorage.setItem(TOKEN_KEY, token)
    else sessionStorage.removeItem(TOKEN_KEY)
}
export const clearAccessToken = () => sessionStorage.removeItem(TOKEN_KEY)

/**
 * Offline demo sign-in (local-storage accounts, no API) is a development-only convenience.
 * It requires a dev build AND an explicit VITE_ENABLE_DEMO_LOGINS=true, and is compiled out of
 * production builds. The demo password is never stored in source; see VITE_DEMO_PASSWORD.
 */
export const isDemoLoginEnabled = () =>
    Boolean(import.meta.env.DEV) && String(import.meta.env.VITE_ENABLE_DEMO_LOGINS || 'false') === 'true'

export const SESSION_EXPIRED_EVENT = 'schoolerp:session-expired'
export const SESSION_NOTICE_KEY = 'schoolerp_session_notice'

// 401s on these paths mean "wrong credentials", not "your token expired".
const AUTH_ATTEMPT_PATHS = ['/auth/login', '/auth/otp', '/auth/change-password']

export class ApiError extends Error {
    constructor(message, status, details = null) {
        super(message)
        this.name = 'ApiError'
        this.status = status
        this.details = details
    }
}

const parseError = async (response) => {
    try {
        const data = await response.json()
        if (typeof data?.detail === 'string') return data.detail
        if (data?.detail && typeof data.detail === 'object' && data.detail.message) {
            return data.detail.message
        }
        if (Array.isArray(data?.detail)) {
            return data.detail.map((item) => item.msg || JSON.stringify(item)).join(', ')
        }
        return data?.message || `Request failed (${response.status})`
    } catch {
        return `Request failed (${response.status})`
    }
}

export async function apiRequest(path, options = {}) {
    const {
        method = 'GET',
        body,
        token = getAccessToken(),
        headers = {},
        formData = false,
    } = options

    const finalHeaders = { ...headers }
    if (token) finalHeaders.Authorization = `Bearer ${token}`
    if (body != null && !formData) {
        finalHeaders['Content-Type'] = 'application/json'
    }

    const response = await fetch(`${getApiBaseUrl()}${path}`, {
        method,
        headers: finalHeaders,
        body: body == null ? undefined : formData ? body : JSON.stringify(body),
    })

    if (!response.ok) {
        if (response.status === 401 && token && !AUTH_ATTEMPT_PATHS.some((prefix) => path.startsWith(prefix))) {
            // The signed-in token was rejected (expired or revoked): end the session.
            clearAccessToken()
            sessionStorage.setItem(SESSION_NOTICE_KEY, 'Your session has expired. Please sign in again.')
            window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
        }
        throw new ApiError(await parseError(response), response.status)
    }

    if (response.status === 204) return null
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) return response.json()
    return response
}
