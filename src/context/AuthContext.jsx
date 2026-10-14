import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
    clearActiveAdminSession,
    findActiveAdminByEmail,
    getAdminUserByEmail,
    setActiveAdminSession,
} from '../Pages/SuperAdmin/UserCreation/adminUsersData'
import {
    clearActiveCreatedUserSession,
    findActiveCreatedUserByEmail,
    getCreatedUserByEmail,
    setActiveCreatedUserSession,
    CREATABLE_ROLES,
} from '../Common/RBAC/createdUsersData'
import { findActiveParentByEmail } from '../Common/ParentAccounts/parentAccountsData'
import { ROLES } from '../constants/roles'
import { deviceLabel, logActivity } from '../Common/demoDomain/activityLog'
import {
    SESSION_EXPIRED_EVENT,
    clearAccessToken,
    getAccessToken,
    isApiAuthEnabled,
    isDemoLoginEnabled,
} from '../services/apiClient'
import { apiChangePassword, apiLogin, apiLogout, apiMe } from '../services/authApi'
import { clearLeaveRequestMemory } from '../Common/LeaveRequest/leaveRequestData'
import { clearEscalationMemory } from '../Common/EscalationManagement/escalationData'

export { ROLES }

const SUPER_ADMIN_EMAILS = ['superadmin@school.com', 'superadmin2@school.com']

/**
 * Offline demo password. Supplied only through the (git-ignored) VITE_DEMO_PASSWORD of a
 * development build with VITE_ENABLE_DEMO_LOGINS=true; never stored in source.
 */
const demoPassword = () => String(import.meta.env.VITE_DEMO_PASSWORD || '')

/** Profile emails used to pre-fill the sign-in form and label menus. These are not credentials. */
export const FAKE_CREDENTIALS = {
    [ROLES.SUPER_ADMIN]: { email: 'superadmin@school.com' },
    [ROLES.ADMIN]: { email: 'admin@school.com' },
    [ROLES.STUDENT]: { email: 'student@school.com' },
    [ROLES.PARENT]: { email: 'parent@school.com' },
    [ROLES.LIBRARIAN]: { email: 'librarian@school.com' },
    [ROLES.PRM]: { email: 'prm@school.com' },
    [ROLES.GATEKEEPER]: { email: 'gatekeeper@school.com' },
    [ROLES.GATEKEEPER_MANAGER]: { email: 'gatekeepermanager@school.com' },
    [ROLES.DIRECTOR]: { email: 'director@school.com' },
    [ROLES.PRINCIPAL]: { email: 'principal@school.com' },
    [ROLES.CANTEEN_MANAGER]: { email: 'canteenmanager@school.com' },
    [ROLES.IT_SUPPORT_MANAGER]: { email: 'itsupportmanager@school.com' },
    [ROLES.STATIONERY_STORE_MANAGER]: { email: 'stationerystoremanager@school.com' },
    [ROLES.HOUSEKEEPING_MANAGER]: { email: 'housekeepingmanager@school.com' },
    [ROLES.TRANSPORT_MANAGER]: { email: 'transportmanager@school.com' },
    [ROLES.TEACHER]: { email: 'teacher@school.com' },
    [ROLES.COORDINATOR]: { email: 'coordinator@school.com' },
    [ROLES.JOINT_DIRECTOR]: { email: 'jointdirector@school.com' },
    [ROLES.JOINT_DIRECTOR_ASSISTANT]: { email: 'jointdirectorassistant@school.com' },
    [ROLES.JOINT_DIRECTOR_AUDIT]: { email: 'jointdirectoraudit@school.com' },
    [ROLES.PROCESS_AUDITOR]: { email: 'processauditor@school.com' },
    [ROLES.QUALITY_AUDITOR]: { email: 'qualityauditor@school.com' },
    [ROLES.HR]: { email: 'hr@school.com' },
    [ROLES.ACCOUNT_HEAD]: { email: 'accounthead@school.com' },
    [ROLES.DRIVER]: { email: 'driver@school.com' },
}

export const ROLE_HOME_PATHS = {
    [ROLES.SUPER_ADMIN]: '/super-admin/dashboard',
    [ROLES.ADMIN]: '/admin/front-office/admission-list',
    [ROLES.STUDENT]: '/student/class/online-class',
    [ROLES.PARENT]: '/parent/select-child',
    [ROLES.LIBRARIAN]: '/librarian/book-management/book-list',
    [ROLES.PRM]: '/front-office/admission-enquiry',
    [ROLES.GATEKEEPER]: '/gate-keeper/dashboard',
    [ROLES.GATEKEEPER_MANAGER]: '/gatekeeper-manager/assign-duty-list',
    [ROLES.DIRECTOR]: '/director/broadcast',
    [ROLES.PRINCIPAL]: '/principal/task-management',
    [ROLES.CANTEEN_MANAGER]: '/canteen-manager/dashboard',
    [ROLES.IT_SUPPORT_MANAGER]: '/it-support-manager/dashboard',
    [ROLES.STATIONERY_STORE_MANAGER]: '/stationery-store-manager/dashboard',
    [ROLES.HOUSEKEEPING_MANAGER]: '/housekeeping-manager/dashboard',
    [ROLES.TRANSPORT_MANAGER]: '/transport-manager/dashboard',
    [ROLES.TEACHER]: '/teacher/dashboard',
    [ROLES.COORDINATOR]: '/coordinator/dashboard',
    [ROLES.JOINT_DIRECTOR]: '/joint-director/dashboard',
    [ROLES.JOINT_DIRECTOR_ASSISTANT]: '/joint-director-assistant/dashboard',
    [ROLES.JOINT_DIRECTOR_AUDIT]: '/joint-director-audit/dashboard',
    [ROLES.PROCESS_AUDITOR]: '/process-auditor/dashboard',
    [ROLES.QUALITY_AUDITOR]: '/quality-auditor/dashboard',
    [ROLES.HR]: '/hr/dashboard',
    [ROLES.ACCOUNT_HEAD]: '/account-head/dashboard',
    [ROLES.DRIVER]: '/driver/vehicle-management/vehicle-details',
}

const STORAGE_KEY = 'schoolerp_auth'

const CREATABLE_LOGIN_ROLES = new Set(CREATABLE_ROLES)

const readStoredAuth = () => {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY)
        if (!raw) return { isAuthenticated: false, role: null, email: null, name: null, mustChangePassword: false }
        const parsed = JSON.parse(raw)
        // With API auth the signed-in state is only valid together with a real access token.
        if (isApiAuthEnabled() && !getAccessToken()) {
            sessionStorage.removeItem(STORAGE_KEY)
            return { isAuthenticated: false, role: null, email: null, name: null, mustChangePassword: false }
        }
        if (parsed?.isAuthenticated && parsed?.role) {
            const role = parsed.role === 'vandriver' ? ROLES.DRIVER : parsed.role
            return {
                isAuthenticated: true,
                role,
                email: parsed.email || null,
                name: parsed.name || null,
                mustChangePassword: Boolean(parsed.mustChangePassword),
            }
        }
    } catch {
        // ignore invalid storage
    }
    return { isAuthenticated: false, role: null, email: null, name: null, mustChangePassword: false }
}

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
    const stored = readStoredAuth()
    const [isAuthenticated, setIsAuthenticated] = useState(stored.isAuthenticated)
    const [role, setRole] = useState(stored.role)
    const [email, setEmail] = useState(stored.email)
    const [name, setName] = useState(stored.name)
    const [mustChangePassword, setMustChangePassword] = useState(Boolean(stored.mustChangePassword))
    const [pendingRole, setPendingRole] = useState(null)

    useEffect(() => {
        if (stored.isAuthenticated && stored.email && CREATABLE_LOGIN_ROLES.has(stored.role)) {
            const existing = getCreatedUserByEmail(stored.email)
            if (existing && existing.status === 'Active') {
                setActiveCreatedUserSession(existing)
            }
        }
    }, [])

    // End the session locally (no API call) when the server rejects the token or the stored
    // session claims a role the token does not back.
    const endLocalSession = useCallback(() => {
        clearAccessToken()
        sessionStorage.removeItem(STORAGE_KEY)
        clearActiveAdminSession()
        clearActiveCreatedUserSession()
        setIsAuthenticated(false)
        setRole(null)
        setEmail(null)
        setName(null)
        setMustChangePassword(false)
        setPendingRole(null)
    }, [])

    useEffect(() => {
        if (!isApiAuthEnabled()) return undefined
        window.addEventListener(SESSION_EXPIRED_EVENT, endLocalSession)
        return () => window.removeEventListener(SESSION_EXPIRED_EVENT, endLocalSession)
    }, [endLocalSession])

    // On load, never trust the role kept in sessionStorage by itself: confirm it with the server
    // using the real token, so editing storage cannot grant a role in the UI.
    useEffect(() => {
        if (!isApiAuthEnabled() || !stored.isAuthenticated) return undefined
        if (!getAccessToken()) return undefined // readStoredAuth already treated this as signed out
        let cancelled = false
        apiMe()
            .then((me) => {
                if (cancelled) return
                const sameRole = me?.role === stored.role
                const sameEmail = String(me?.email || '').toLowerCase() === String(stored.email || '').toLowerCase()
                if (!sameRole || !sameEmail) {
                    endLocalSession()
                    return
                }
                setMustChangePassword(Boolean(me.must_change_password))
            })
            .catch((error) => {
                // 401 already ends the session via SESSION_EXPIRED_EVENT; keep the session on network errors.
                if (!cancelled && error?.status === 401) endLocalSession()
            })
        return () => {
            cancelled = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const persistAuth = useCallback((nextRole, nextEmail = null, nextName = null, nextMustChange = false) => {
        sessionStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                isAuthenticated: true,
                role: nextRole,
                email: nextEmail,
                name: nextName,
                mustChangePassword: Boolean(nextMustChange),
            })
        )
    }, [])

    const establishSession = useCallback((expectedRole, normalizedEmail, sessionName, createdUser, createdAdmin, nextMustChange = false) => {
        setIsAuthenticated(true)
        setRole(expectedRole)
        setEmail(normalizedEmail)
        setName(sessionName)
        setMustChangePassword(Boolean(nextMustChange))
        setPendingRole(null)
        persistAuth(expectedRole, normalizedEmail, sessionName, nextMustChange)
        logActivity({
            actor: sessionName || normalizedEmail,
            role: expectedRole,
            action: 'LOGIN',
            module: 'Authentication',
            details: `${deviceLabel()} · ${navigator.userAgent.split(' ').slice(-2).join(' ')}`,
            recordId: crypto.randomUUID?.() || `SES-${Date.now()}`,
        })

        clearActiveCreatedUserSession()

        if (expectedRole === ROLES.ADMIN) {
            const createdAdminUser = createdAdmin || getAdminUserByEmail(normalizedEmail)
            if (createdAdminUser && !createdAdminUser.isSystem) {
                setActiveAdminSession(createdAdminUser)
            } else {
                clearActiveAdminSession()
            }
        } else {
            clearActiveAdminSession()
            if (createdUser) {
                setActiveCreatedUserSession(createdUser)
            }
        }

        return { success: true, role: expectedRole, mustChangePassword: Boolean(nextMustChange) }
    }, [persistAuth])

    // Only reachable in offline demo mode (see isDemoLoginEnabled); never when the API is the source of truth.
    const passwordMatches = (storedPassword, enteredPassword) => {
        const stored = String(storedPassword || '').trim()
        if (stored) return stored === enteredPassword
        const shared = demoPassword()
        return Boolean(shared) && enteredPassword === shared
    }

    const resolveAccount = (normalizedEmail) => {
        if (SUPER_ADMIN_EMAILS.includes(normalizedEmail)) {
            return { role: ROLES.SUPER_ADMIN, sessionName: null }
        }

        const seededRole = Object.entries(FAKE_CREDENTIALS).find(
            ([, creds]) => creds.email.toLowerCase() === normalizedEmail
        )?.[0]
        if (seededRole) {
            return { role: seededRole, sessionName: null }
        }

        const createdAdmin = findActiveAdminByEmail(normalizedEmail)
        if (createdAdmin) {
            return {
                role: ROLES.ADMIN,
                sessionName: createdAdmin.name || null,
                createdAdmin,
                storedPassword: createdAdmin.password,
            }
        }

        const createdUser = findActiveCreatedUserByEmail(normalizedEmail)
        if (createdUser) {
            return {
                role: createdUser.role,
                sessionName: createdUser.name || null,
                createdUser,
                storedPassword: createdUser.password,
            }
        }

        const registeredParent = findActiveParentByEmail(normalizedEmail)
        if (registeredParent) {
            return {
                role: ROLES.PARENT,
                sessionName: registeredParent.name || null,
                storedPassword: registeredParent.password,
            }
        }

        return null
    }

    const loginWithCredentials = useCallback(async (emailInput, password) => {
        const normalizedEmail = String(emailInput || '').trim().toLowerCase()
        const enteredPassword = String(password || '')

        if (!normalizedEmail || !enteredPassword) {
            return { success: false, message: 'Enter your email and password.' }
        }

        if (isApiAuthEnabled()) {
            try {
                const data = await apiLogin(normalizedEmail, enteredPassword)
                const apiRole = data?.user?.role
                const apiName = data?.user?.full_name || null
                if (!apiRole) {
                    clearAccessToken()
                    return { success: false, message: 'Login succeeded but role was missing.' }
                }
                return establishSession(
                    apiRole,
                    normalizedEmail,
                    apiName,
                    null,
                    null,
                    Boolean(data?.must_change_password),
                )
            } catch (error) {
                // The API is authoritative. No local fallback: a wrong password, a lockout or an
                // unreachable server must never produce a signed-in session.
                clearAccessToken()
                return {
                    success: false,
                    message: error?.message || 'Invalid email or password.',
                }
            }
        }

        if (!isDemoLoginEnabled()) {
            return { success: false, message: 'Sign-in is unavailable: the API sign-in service is turned off.' }
        }

        const account = resolveAccount(normalizedEmail)
        if (!account || !passwordMatches(account.storedPassword, enteredPassword)) {
            return { success: false, message: 'Invalid email or password.' }
        }

        return establishSession(
            account.role,
            normalizedEmail,
            account.sessionName,
            account.createdUser,
            account.createdAdmin
        )
    }, [establishSession])

    const logout = useCallback(async () => {
        logActivity({ actor: email || 'Demo User', role, action: 'LOGOUT', module: 'Authentication' })
        if (isApiAuthEnabled()) {
            await apiLogout()
        } else {
            clearAccessToken()
        }
        sessionStorage.removeItem(STORAGE_KEY)
        clearLeaveRequestMemory() // server-sourced leave requests and escalations are held in memory; drop them with the session
        clearEscalationMemory()
        clearActiveAdminSession()
        clearActiveCreatedUserSession()
        setIsAuthenticated(false)
        setRole(null)
        setEmail(null)
        setName(null)
        setMustChangePassword(false)
        setPendingRole(null)
    }, [email, role])

    const completePasswordChange = useCallback(async (currentPassword, newPassword) => {
        await apiChangePassword(currentPassword, newPassword)
        setMustChangePassword(false)
        persistAuth(role, email, name, false)
        return { success: true }
    }, [email, name, persistAuth, role])

    const value = useMemo(
        () => ({
            isAuthenticated,
            role,
            email,
            name,
            mustChangePassword,
            pendingRole,
            setPendingRole,
            loginWithCredentials,
            completePasswordChange,
            logout,
        }),
        [isAuthenticated, role, email, name, mustChangePassword, pendingRole, loginWithCredentials, completePasswordChange, logout]
    )

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider')
    }
    return context
}
