import { useEffect, useState } from 'react'

const describe = (error) => {
    if (error?.status === 403) return 'You do not have access to attendance records.'
    if (error?.status) return error.message || 'Could not load attendance.'
    return 'Could not reach the server. Check your connection and try again.'
}

/**
 * Loads one Administrator attendance list from the API.
 *
 * `status` is 'loading' | 'ready' | 'error'. It is derived from the request key (reload counter +
 * serialised params), so changing a filter or pressing Retry shows 'loading' until that request
 * ends, without setting state synchronously in the effect (the project lints against that).
 * `options` keeps the last successful result's filter choices so a failed reload does not empty
 * the filter dropdowns. When `enabled` is false (local mode) nothing is requested.
 */
export const useAttendanceQuery = (enabled, loader, params = {}) => {
    const [reloadKey, setReloadKey] = useState(0)
    const [result, setResult] = useState({ key: '', status: 'idle', data: null, options: null, error: '' })
    const paramsKey = JSON.stringify(params)
    const requestKey = `${reloadKey}:${paramsKey}`

    useEffect(() => {
        if (!enabled) return undefined
        let cancelled = false
        loader(JSON.parse(paramsKey))
            .then((data) => {
                if (!cancelled) setResult({ key: requestKey, status: 'ready', data, options: data, error: '' })
            })
            .catch((error) => {
                if (cancelled) return
                setResult((previous) => ({
                    key: requestKey,
                    status: 'error',
                    data: null,
                    options: previous.options,
                    error: describe(error),
                }))
            })
        return () => {
            cancelled = true
        }
    }, [enabled, loader, paramsKey, requestKey])

    const current = result.key === requestKey
    return {
        status: !enabled ? 'idle' : current ? result.status : 'loading',
        data: current ? result.data : null,
        options: result.options,
        error: current ? result.error : '',
        reload: () => setReloadKey((key) => key + 1),
    }
}
