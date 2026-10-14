import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { canUseDocumentsApi } from '../../../services/documentsApi'
import { getEmployeeDocumentRecords, hydrateEmployeeDocumentsFromApi } from './EmployeeDocuments/employeeDocumentsData'
import { getStudentDocumentRecords, hydrateStudentDocumentsFromApi } from './StudentDocuments/studentDocumentsData'

const SOURCES = {
    students: { read: getStudentDocumentRecords, load: hydrateStudentDocumentsFromApi },
    employees: { read: getEmployeeDocumentRecords, load: hydrateEmployeeDocumentsFromApi },
}

const messageFor = (error) =>
    error?.status === 403 ? 'You do not have permission to view these documents.' : error?.message || 'Documents could not be loaded.'

/**
 * Document folders for the Administrator screens.
 *
 * With a backend session the folders are fetched from the server every time the screen is opened (state is
 * only set once the request answers), and `status` is 'loading' | 'error' | 'ready'. Without one the
 * browser-only list is read straight away, exactly as before.
 */
export default function useDocumentRecords(kind) {
    const location = useLocation()
    const source = SOURCES[kind]
    const api = canUseDocumentsApi()
    const requestKey = api ? `${kind}:${location.key}` : ''
    const [answer, setAnswer] = useState({ key: '', error: '' })

    useEffect(() => {
        if (!api) return undefined
        let active = true
        source
            .load()
            .then(() => {
                if (active) setAnswer({ key: requestKey, error: '' })
            })
            .catch((error) => {
                if (active) setAnswer({ key: requestKey, error: messageFor(error) })
            })
        return () => {
            active = false
        }
    }, [api, source, requestKey])

    const status = !api ? 'ready' : answer.key !== requestKey ? 'loading' : answer.error ? 'error' : 'ready'
    // read on every render: cheap, and a save is visible as soon as the list opens
    const records = status === 'ready' ? source.read() : []
    return { records, status, error: answer.error }
}
