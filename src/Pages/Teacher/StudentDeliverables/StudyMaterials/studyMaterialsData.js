import { CLASSES, SECTIONS, SUBJECTS } from '../../AssignedClass/assignedClassData'
import {
    createAcademicsCollectionStore,
    nextPrefixedId,
} from '../../../../services/academicsCollectionStore'

export { CLASSES, SECTIONS, SUBJECTS }

export const DEFAULT_ROUTE_BASE = '/teacher/student-deliverables/study-materials'
export const ACADEMICS_ROUTE_BASE = '/teacher/academics/study-materials'
export const STUDY_MATERIALS_UPDATED_EVENT = 'schoolerp-study-materials-updated'

const normalizeRecord = (raw) => {
    const id = String(raw?.id || raw?.materialId || '').trim()
    return {
        id,
        materialId: String(raw?.materialId || id).trim() || id,
        title: String(raw?.title || '').trim(),
        description: String(raw?.description || '').trim(),
        subject: String(raw?.subject || '').trim(),
        className: String(raw?.className || '').trim(),
        section: String(raw?.section || '').trim(),
        fileName: String(raw?.fileName || '—').trim() || '—',
        fileType: String(raw?.fileType || 'pdf').trim() || 'pdf',
        createdBy: String(raw?.createdBy || '').trim(),
        createdAt: String(raw?.createdAt || '').trim(),
    }
}

const store = createAcademicsCollectionStore({
    collection: 'study-materials',
    storageKey: 'teacher-student-deliverables-study-materials',
    eventName: STUDY_MATERIALS_UPDATED_EVENT,
    normalize: normalizeRecord,
    offlineFallback: () => [],
})

export const hydrateStudyMaterialsFromApi = store.hydrate
export const clearStudyMaterialsMemory = store.clearMemory

export const getStudyMaterials = () => store.getAll()

export const saveStudyMaterials = (records) => store.saveAll(records)

export const getStudyMaterialById = (id) => {
    const key = String(id || '')
    return getStudyMaterials().find((item) => item.id === key || item.materialId === key) ?? null
}

export const generateMaterialId = () => nextPrefixedId(getStudyMaterials(), 'SM', 1001)

export const addStudyMaterial = async (values, meta = {}) => {
    await store.ensureHydrated()
    const existing = getStudyMaterials()
    const materialId = nextPrefixedId(existing, 'SM', 1001)
    const record = normalizeRecord({
        ...values,
        id: materialId,
        materialId,
        createdBy: meta.createdBy || '',
        createdAt: new Date().toISOString(),
    })
    await saveStudyMaterials([record, ...existing])
    return record
}

export const filterStudyMaterials = (items, filters) =>
    items.filter((item) => {
        const search = filters.search.trim().toLowerCase()
        const matchesSearch =
            !search ||
            item.materialId.toLowerCase().includes(search) ||
            item.title.toLowerCase().includes(search) ||
            item.description.toLowerCase().includes(search)

        const matchesSubject = !filters.subject || item.subject === filters.subject
        const matchesClass = !filters.className || item.className === filters.className
        const matchesSection = !filters.section || item.section === filters.section

        return matchesSearch && matchesSubject && matchesClass && matchesSection
    })
