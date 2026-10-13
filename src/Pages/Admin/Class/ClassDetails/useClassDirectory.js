import { useEffect, useState } from 'react'
import { canUseClassDetailsApi, loadClassDirectory } from '../../../../services/classDetailsApi'

/**
 * Admin Class Details data source.
 *
 * API mode (flag on + signed in): classes, sections and academic years from the masters API.
 * `status` is 'loading' | 'ready' | 'error'. It is derived from the request key (reload counter +
 * year filter), so changing the filter or pressing Retry shows 'loading' until that request ends,
 * without setting state synchronously inside the effect. Local mode: `apiMode` is false and the
 * screens keep using the browser-only catalog exactly as before.
 */
export const useClassDirectory = (academicYearId = '') => {
    const apiMode = canUseClassDetailsApi()
    const [reloadKey, setReloadKey] = useState(0)
    const [result, setResult] = useState({ key: '', status: 'idle', years: [], records: [], error: '' })
    const requestKey = `${reloadKey}:${academicYearId}`

    useEffect(() => {
        if (!apiMode) return undefined
        let cancelled = false
        loadClassDirectory({ academicYearId })
            .then(({ years, records }) => {
                if (!cancelled) setResult({ key: requestKey, status: 'ready', years, records, error: '' })
            })
            .catch((error) => {
                if (cancelled) return
                setResult((previous) => ({
                    key: requestKey,
                    status: 'error',
                    years: previous.years, // keep the year list so the filter does not vanish on a failed reload
                    records: [],
                    error:
                        error?.status === 403
                            ? 'You do not have access to class records.'
                            : error?.status
                                ? error.message || 'Could not load classes.'
                                : 'Could not reach the server. Check your connection and try again.',
                }))
            })
        return () => {
            cancelled = true
        }
    }, [apiMode, academicYearId, requestKey])

    const current = result.key === requestKey
    return {
        apiMode,
        status: !apiMode ? 'idle' : current ? result.status : 'loading',
        years: result.years,
        records: current ? result.records : [],
        error: current ? result.error : '',
        reload: () => setReloadKey((key) => key + 1),
    }
}
