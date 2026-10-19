import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import {
    getLeaveStoreVersion,
    getMyLeaveRequestsForRole,
    getReceivedLeaveRequestsForRole,
    hydrateLeaveRequestsFromApi,
    subscribeLeaveRequests,
} from './leaveRequestData'
import { resolveRoleKey } from './leaveRequestConfigs'
import { useAuth } from '../../context/AuthContext'

/**
 * Shared leave list subscription + hydrate. Survives hard reload by seeding from the
 * session cache immediately, then refreshing from the API.
 */
export function useLeaveRequests(mode = 'received', roleKeyProp) {
    const location = useLocation()
    const { role: authRole } = useAuth()
    const roleKey = resolveRoleKey(authRole || roleKeyProp)
    const version = useSyncExternalStore(subscribeLeaveRequests, getLeaveStoreVersion, () => 0)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let ignore = false
        setLoading(true)
        hydrateLeaveRequestsFromApi().finally(() => {
            if (!ignore) setLoading(false)
        })
        const onFocus = () => {
            hydrateLeaveRequestsFromApi()
        }
        const onVisible = () => {
            if (document.visibilityState === 'visible') onFocus()
        }
        window.addEventListener('focus', onFocus)
        document.addEventListener('visibilitychange', onVisible)
        return () => {
            ignore = true
            window.removeEventListener('focus', onFocus)
            document.removeEventListener('visibilitychange', onVisible)
        }
    }, [location.pathname, location.key, roleKey])

    const requests = useMemo(() => {
        void version
        return mode === 'mine'
            ? getMyLeaveRequestsForRole(roleKey)
            : getReceivedLeaveRequestsForRole(roleKey)
    }, [mode, roleKey, version])

    return { roleKey, requests, loading, version }
}
