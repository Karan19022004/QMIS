import { useEffect, useState } from 'react'
import {
    canUseClassDetailsApi,
    loadClassDirectory,
    loadClassTeacherOptions,
} from '../../../../services/classDetailsApi'

const describeLoadError = (error, fallbackForbidden) => (
    error?.status === 403
        ? fallbackForbidden
        : error?.status
            ? error.message || 'Could not load classes.'
            : 'Could not reach the server. Check your connection and try again.'
)

/**
 * Admin Class Details data source.
 *
 * API mode (flag on + signed in): classes, sections and academic years from the masters API.
 * `status` is 'loading' | 'ready' | 'error'. It is derived from the request key (reload counter +
 * year filter + inactive toggle), so changing a filter or pressing Retry shows 'loading' until that
 * request ends, without setting state synchronously inside the effect. Local mode: `apiMode` is false
 * and the screens keep using the browser-only catalog exactly as before.
 */
export const useClassDirectory = (academicYearId = '', includeInactive = false) => {
    const apiMode = canUseClassDetailsApi()
    const [reloadKey, setReloadKey] = useState(0)
    const [result, setResult] = useState({ key: '', status: 'idle', years: [], records: [], error: '' })
    const requestKey = `${reloadKey}:${academicYearId}:${includeInactive ? 'all' : 'active'}`

    useEffect(() => {
        if (!apiMode) return undefined
        let cancelled = false
        loadClassDirectory({ academicYearId, includeInactive })
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
                    error: describeLoadError(error, 'You do not have access to class records.'),
                }))
            })
        return () => {
            cancelled = true
        }
    }, [apiMode, academicYearId, includeInactive, requestKey])

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

/**
 * Logins that can be picked as a class teacher (API mode only). `status` is 'idle' | 'loading' |
 * 'ready' | 'error'; an error leaves `options` empty and the screens say so instead of offering a
 * free-text name.
 */
export const useClassTeacherOptions = (enabled) => {
    const [reloadKey, setReloadKey] = useState(0)
    const [result, setResult] = useState({ key: '', status: 'idle', options: [], error: '' })
    const requestKey = String(reloadKey)

    useEffect(() => {
        if (!enabled) return undefined
        let cancelled = false
        loadClassTeacherOptions()
            .then((options) => {
                if (!cancelled) setResult({ key: requestKey, status: 'ready', options, error: '' })
            })
            .catch((error) => {
                if (cancelled) return
                setResult({
                    key: requestKey,
                    status: 'error',
                    options: [],
                    error: describeLoadError(error, 'You do not have permission to choose class teachers.'),
                })
            })
        return () => {
            cancelled = true
        }
    }, [enabled, requestKey])

    const current = result.key === requestKey
    return {
        status: !enabled ? 'idle' : current ? result.status : 'loading',
        options: current ? result.options : [],
        error: current ? result.error : '',
        reload: () => setReloadKey((key) => key + 1),
    }
}
