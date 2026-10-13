import { useEffect, useState } from 'react'
import { getUsersByRole } from './taskManagementConfig'
import { isTasksApiMode, loadAssignableUsers } from './taskManagementData'

/**
 * Users that can be picked for a role: real staff from the API in API mode, the demo list otherwise.
 * Returns { users, loading, error }. Results are tagged with the role they were loaded for, so switching
 * roles never shows the previous role's people while the new list is loading.
 */
export const useAssignableUsers = (roleKey) => {
    const apiMode = isTasksApiMode()
    const [loaded, setLoaded] = useState({ roleKey: null, users: [], error: '' })

    useEffect(() => {
        if (!apiMode || !roleKey) return undefined
        let cancelled = false
        loadAssignableUsers(roleKey)
            .then((users) => {
                if (!cancelled) setLoaded({ roleKey, users, error: '' })
            })
            .catch((error) => {
                if (!cancelled) setLoaded({ roleKey, users: [], error: error?.message || 'Could not load users.' })
            })
        return () => {
            cancelled = true
        }
    }, [apiMode, roleKey])

    if (!apiMode) return { users: getUsersByRole(roleKey), loading: false, error: '' }
    if (!roleKey) return { users: [], loading: false, error: '' }
    if (loaded.roleKey !== roleKey) return { users: [], loading: true, error: '' }
    return { users: loaded.users, loading: false, error: loaded.error }
}
