import { ApiError, apiRequest, getAccessToken, isApiClassDetailsEnabled } from './apiClient'
import { mirrorApiClassDetails } from '../Common/RBAC/academicsCatalogData'

/** True when Class Details should use the masters API (flag on and a real backend session). */
export const canUseClassDetailsApi = () => isApiClassDetailsEnabled() && Boolean(getAccessToken())

const sortByNumberedName = (a, b) => a.localeCompare(b, undefined, { numeric: true })

const normalizeYear = (year) => ({
    id: year.id,
    name: year.name,
    isCurrent: Boolean(year.is_current),
    isActive: year.is_active !== false,
})

/**
 * Loads academic years, classes and sections in parallel and joins them. Any failure rejects, so the
 * screen shows one clear error with a retry instead of a half-filled table.
 *
 * With `academicYearId` the server does the filtering (GET /masters/classes?academic_year_id=).
 * An unfiltered result is the complete class list and is the only one mirrored into the local
 * catalog that other screens read.
 */
export const loadClassDirectory = async ({ academicYearId = '' } = {}) => {
    const query = academicYearId ? `?academic_year_id=${encodeURIComponent(academicYearId)}` : ''
    const [years, classes, sections] = await Promise.all([
        apiRequest('/masters/academic-years'),
        apiRequest(`/masters/classes${query}`),
        apiRequest('/masters/sections'),
    ])

    const yearList = (Array.isArray(years) ? years : []).map(normalizeYear)
    const yearNameById = new Map(yearList.map((year) => [year.id, year.name]))
    const sectionsByClass = new Map()
    ;(Array.isArray(sections) ? sections : []).forEach((section) => {
        const list = sectionsByClass.get(section.class_id) || []
        list.push({ id: section.id, name: section.name })
        sectionsByClass.set(section.class_id, list)
    })

    const records = (Array.isArray(classes) ? classes : [])
        .map((item) => ({
            id: item.id,
            className: item.name,
            displayName: item.name,
            academicYearId: item.academic_year_id || '',
            academicYear: item.academic_year_id ? yearNameById.get(item.academic_year_id) || 'Unknown year' : '—',
            sections: (sectionsByClass.get(item.id) || []).sort((a, b) => sortByNumberedName(a.name, b.name)),
        }))
        .sort((a, b) => sortByNumberedName(a.className, b.className))

    const filtered = Boolean(academicYearId)
    if (!filtered) mirrorApiClassDetails(records)
    return { years: yearList, records, filtered }
}

/** Best-effort: keep the dropdowns on other screens in step after a save. Never throws. */
export const refreshClassCatalog = () => loadClassDirectory().catch(() => null)

const cleanSectionNames = (sections) => {
    const seen = new Set()
    const names = []
    ;(sections || []).forEach((section) => {
        const name = String(typeof section === 'string' ? section : section?.name || '')
            .trim()
            .toUpperCase()
        if (name && !seen.has(name)) {
            seen.add(name)
            names.push(name)
        }
    })
    return names
}

const errorMessage = (error) => (error instanceof ApiError || error?.message ? error.message : 'Request failed.')

/**
 * Creates a class and its sections, safe to repeat. The class is looked up by name first, so a retry
 * after a partial failure adds only the sections that are still missing instead of failing with
 * "already exists". Sections the server already has (409) count as present.
 *
 * Resolves with { classId, className, classCreated, sectionsCreated, sectionsExisting, failures }.
 * `failures` is [{ name, message }]; the class itself failing throws.
 */
export const saveClassWithSections = async ({ className, sections, academicYearId = '' }) => {
    const name = String(className || '').trim()
    const sectionNames = cleanSectionNames(sections)
    if (!name) throw new Error('Class is required.')
    if (sectionNames.length === 0) throw new Error('Add at least one section.')

    const existingClasses = await apiRequest('/masters/classes')
    let target = (Array.isArray(existingClasses) ? existingClasses : []).find(
        (item) => String(item.name).toLowerCase() === name.toLowerCase(),
    )

    const result = {
        classId: '',
        className: name,
        classCreated: false,
        sectionsCreated: [],
        sectionsExisting: [],
        failures: [],
    }
    let remaining = sectionNames

    if (!target) {
        const body = { name, section: sectionNames[0] }
        if (academicYearId) body.academic_year_id = academicYearId
        target = await apiRequest('/masters/classes', { method: 'POST', body })
        result.classCreated = true
        result.sectionsCreated.push(sectionNames[0]) // the server creates the first section with the class
        remaining = sectionNames.slice(1)
    }
    result.classId = target.id
    result.className = target.name

    for (const sectionName of remaining) {
        try {
            await apiRequest('/masters/sections', {
                method: 'POST',
                body: { class_id: target.id, name: sectionName },
            })
            result.sectionsCreated.push(sectionName)
        } catch (error) {
            if (error?.status === 409) result.sectionsExisting.push(sectionName)
            else result.failures.push({ name: sectionName, message: errorMessage(error) })
        }
    }

    await refreshClassCatalog()
    return result
}
