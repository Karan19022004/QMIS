import { useEffect, useState } from 'react'
import { canUseEmployeeDirectoryApi, loadEmployeeDirectory } from '../../../../services/employeeDirectoryApi'

const EMPTY = { status: 'idle', records: [], warnings: [], error: '' }

/**
 * Admin Employee Database data source.
 *
 * API mode (flag on + signed in): HR employees + User Creation logins from the server, with
 * `status` of 'loading' | 'ready' | 'error'. Local mode: `apiMode` is false and the screen keeps
 * using its browser-only list exactly as before.
 */
export const useEmployeeDirectory = () => {
    const apiMode = canUseEmployeeDirectoryApi()
    const [state, setState] = useState(() => (apiMode ? { ...EMPTY, status: 'loading' } : EMPTY))
    const [reloadKey, setReloadKey] = useState(0)

    useEffect(() => {
        if (!apiMode) return undefined
        let cancelled = false
        loadEmployeeDirectory()
            .then(({ records, warnings }) => {
                if (!cancelled) setState({ status: 'ready', records, warnings, error: '' })
            })
            .catch((error) => {
                if (!cancelled) {
                    setState({
                        status: 'error',
                        records: [],
                        warnings: [],
                        error: error?.status === 403
                            ? 'You do not have access to the employee records.'
                            : error?.message || 'Could not load employees.',
                    })
                }
            })
        return () => { cancelled = true }
    }, [apiMode, reloadKey])

    const reload = () => {
        setState((previous) => ({ ...previous, status: 'loading', error: '' }))
        setReloadKey((key) => key + 1)
    }

    return { apiMode, ...state, reload }
}
