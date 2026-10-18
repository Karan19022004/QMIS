import {
    canUseAcademicsApi,
    listAcademicsCollectionApi,
    replaceAcademicsCollectionApi,
    stripAcademicsMeta,
} from '../../../services/academicsApi'
import {
    getClasses as getCatalogClasses,
    getSections as getCatalogSections,
    getSubjects as getCatalogSubjects,
} from '../../../Common/RBAC/academicsCatalogData'
import { CLASSES as FALLBACK_CLASSES, SECTIONS as FALLBACK_SECTIONS, SUBJECTS as FALLBACK_SUBJECTS } from '../AssignedClass/assignedClassData'

export const STORAGE_KEY = 'campus-extra-classes'
export const EXTRA_CLASSES_UPDATED_EVENT = 'schoolerp-extra-classes-updated'

export const VENUES = [
    'Room 204 — Science Block',
    'Room 112 — Main Building',
    'Computer Lab — Block B',
    'Seminar Hall — Admin Wing',
    'Library Conference Room',
]

/** Offline seed only — never shown when academics API mode is on. */
const DEMO_EXTRA_CLASSES = [
    {
        id: 'EC-1001',
        extraClassId: 'EC-1001',
        subject: 'Mathematics',
        className: '10',
        section: 'A',
        classSection: '10-A',
        topic: 'Quadratic Equations — Problem Solving',
        date: '12-06-2026',
        startTime: '03:30 PM',
        endTime: '04:30 PM',
        venue: 'Room 204 — Science Block',
        reason: 'Board exam preparation for weak performers',
    },
]

let apiMemory = null

const usesApiMemory = () => canUseAcademicsApi()

const emitUpdated = () => {
    try {
        window.dispatchEvent(new CustomEvent(EXTRA_CLASSES_UPDATED_EVENT))
    } catch {
        /* ignore */
    }
}

const purgeBrowserCopies = () => {
    try {
        localStorage.removeItem(STORAGE_KEY)
        sessionStorage.removeItem(STORAGE_KEY)
    } catch {
        /* ignore */
    }
}

const cleanList = (rows) => (Array.isArray(rows) ? rows.map(stripAcademicsMeta) : [])

const normalizeRecord = (raw) => {
    const id = String(raw?.id || raw?.extraClassId || '').trim()
    const className = String(raw?.className || '').trim()
    const section = String(raw?.section || '').trim()
    const classSection =
        String(raw?.classSection || '').trim() ||
        (className && section ? `${className}-${section}` : className || section || '')
    return {
        id,
        extraClassId: String(raw?.extraClassId || id).trim() || id,
        subject: String(raw?.subject || '').trim(),
        className,
        section,
        classSection,
        topic: String(raw?.topic || '').trim(),
        date: String(raw?.date || '').trim(),
        startTime: String(raw?.startTime || '').trim(),
        endTime: String(raw?.endTime || '').trim(),
        venue: String(raw?.venue || '').trim(),
        reason: String(raw?.reason || '').trim(),
        createdBy: String(raw?.createdBy || '').trim(),
        createdAt: String(raw?.createdAt || '').trim(),
    }
}

export const getClasses = () => {
    const fromCatalog = getCatalogClasses().map((item) => String(item || '').trim()).filter(Boolean)
    return fromCatalog.length ? [...new Set(fromCatalog)] : [...FALLBACK_CLASSES]
}

export const getSections = () => {
    const fromCatalog = getCatalogSections().map((item) => String(item || '').trim().toUpperCase()).filter(Boolean)
    return fromCatalog.length ? [...new Set(fromCatalog)] : [...FALLBACK_SECTIONS]
}

export const getSubjects = () => {
    const fromCatalog = getCatalogSubjects().map((item) => String(item || '').trim()).filter(Boolean)
    return fromCatalog.length ? [...new Set(fromCatalog)] : [...FALLBACK_SUBJECTS]
}

/** @deprecated Prefer getClasses / getSections / getSubjects */
export const CLASSES = FALLBACK_CLASSES
export const SECTIONS = FALLBACK_SECTIONS
export const SUBJECTS = FALLBACK_SUBJECTS

export const clearExtraClassMemory = () => {
    apiMemory = null
    emitUpdated()
}

export const hydrateExtraClassesFromApi = async () => {
    if (!canUseAcademicsApi()) return false
    try {
        const rows = await listAcademicsCollectionApi('extra-classes')
        apiMemory = cleanList(rows).map(normalizeRecord).filter((item) => item.id)
        purgeBrowserCopies()
        emitUpdated()
        return true
    } catch {
        apiMemory = []
        emitUpdated()
        return false
    }
}

export const getExtraClasses = () => {
    if (usesApiMemory()) {
        return Array.isArray(apiMemory) ? apiMemory.map((item) => ({ ...item })) : []
    }
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
            const parsed = JSON.parse(stored)
            if (Array.isArray(parsed)) return parsed.map(normalizeRecord)
        }
    } catch {
        /* ignore */
    }
    return DEMO_EXTRA_CLASSES.map((item) => ({ ...item }))
}

/** Kept for older imports that expected a constant array. */
export const EXTRA_CLASSES = DEMO_EXTRA_CLASSES

export const saveExtraClasses = (records) => {
    const list = (Array.isArray(records) ? records : []).map(normalizeRecord).filter((item) => item.id)
    if (usesApiMemory()) {
        apiMemory = list
        replaceAcademicsCollectionApi('extra-classes', cleanList(list)).catch(() => {})
        emitUpdated()
        return
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    emitUpdated()
}

export const getExtraClassById = (id) => {
    const key = String(id || '')
    return getExtraClasses().find((item) => item.id === key || item.extraClassId === key) ?? null
}

const nextExtraClassId = (existing) => {
    const used = new Set(existing.map((item) => item.id))
    let index = existing.length + 1
    let candidate = `EC-${String(index).padStart(4, '0')}`
    while (used.has(candidate)) {
        index += 1
        candidate = `EC-${String(index).padStart(4, '0')}`
    }
    return candidate
}

export const formatExtraClassDate = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}-${month}-${year}`
}

export const addExtraClass = (payload, meta = {}) => {
    const existing = getExtraClasses()
    const id = nextExtraClassId(existing)
    const className = String(payload.className || '').trim()
    const section = String(payload.section || '').trim()
    const record = normalizeRecord({
        ...payload,
        id,
        extraClassId: id,
        classSection: className && section ? `${className}-${section}` : className || section,
        createdBy: meta.createdBy || '',
        createdAt: new Date().toISOString(),
    })
    saveExtraClasses([record, ...existing])
    return record
}

export const updateExtraClass = (id, payload) => {
    const key = String(id || '')
    const existing = getExtraClasses()
    const index = existing.findIndex((item) => item.id === key || item.extraClassId === key)
    if (index < 0) return null
    const className = String(payload.className ?? existing[index].className).trim()
    const section = String(payload.section ?? existing[index].section).trim()
    const next = normalizeRecord({
        ...existing[index],
        ...payload,
        id: existing[index].id,
        extraClassId: existing[index].extraClassId || existing[index].id,
        className,
        section,
        classSection: className && section ? `${className}-${section}` : className || section,
    })
    const list = [...existing]
    list[index] = next
    saveExtraClasses(list)
    return next
}

export const deleteExtraClass = (id) => {
    const key = String(id || '')
    const next = getExtraClasses().filter((item) => item.id !== key && item.extraClassId !== key)
    saveExtraClasses(next)
}

export const isUsingDemoExtraClasses = () =>
    !usesApiMemory() && !localStorage.getItem(STORAGE_KEY)
