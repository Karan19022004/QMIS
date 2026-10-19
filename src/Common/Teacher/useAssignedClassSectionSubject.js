import { useMemo } from 'react'
import { useTeacherAssignments } from './useTeacherAssignments'
import { classKeysMatch, normalizeSectionKey } from './teacherAssignedClasses'

/**
 * Class → Section → Subject options from the logged-in user's teacher allocations.
 * Falls back to catalog lists only when the user has no assignment rows yet.
 */
export function useAssignedClassSectionSubject({
    className = '',
    section = '',
    fallbackClasses = [],
    fallbackSections = [],
    fallbackSubjects = [],
} = {}) {
    const assignments = useTeacherAssignments()

    const classOptions = useMemo(() => {
        if (assignments.classes?.length) return assignments.classes
        return fallbackClasses
    }, [assignments.classes, fallbackClasses])

    const sectionOptions = useMemo(() => {
        if (!className) return []
        const fromAssignments = assignments.sectionsFor?.(className) || []
        if (fromAssignments.length) return fromAssignments
        return assignments.assignments?.length ? [] : fallbackSections
    }, [assignments, className, fallbackSections])

    const subjectOptions = useMemo(() => {
        if (!assignments.assignments?.length) {
            return assignments.subjects?.length ? assignments.subjects : fallbackSubjects
        }
        const rows = assignments.assignments.filter((row) => {
            if (className && !classKeysMatch(row.className, className)) return false
            if (
                section
                && row.section
                && normalizeSectionKey(row.section) !== normalizeSectionKey(section)
            ) {
                return false
            }
            return Boolean(row.subject)
        })
        const subjects = [...new Set(rows.map((row) => row.subject).filter(Boolean))]
        if (subjects.length) return subjects.sort((a, b) => a.localeCompare(b))
        return assignments.subjects?.length ? assignments.subjects : fallbackSubjects
    }, [assignments, className, section, fallbackSubjects])

    const applyClassChange = (nextClass, current = {}) => {
        const nextSections = nextClass ? (assignments.sectionsFor?.(nextClass) || []) : []
        const nextSection = nextSections.includes(current.section)
            ? current.section
            : (nextSections[0] || '')
        const nextSubjects = (assignments.assignments || [])
            .filter((row) => classKeysMatch(row.className, nextClass)
                && (!nextSection || !row.section
                    || normalizeSectionKey(row.section) === normalizeSectionKey(nextSection)))
            .map((row) => row.subject)
            .filter(Boolean)
        const uniqueSubjects = [...new Set(nextSubjects)]
        const nextSubject = uniqueSubjects.includes(current.subject)
            ? current.subject
            : (uniqueSubjects[0] || '')
        return { className: nextClass, section: nextSection, subject: nextSubject }
    }

    const applySectionChange = (nextSection, current = {}) => {
        const nextSubjects = (assignments.assignments || [])
            .filter((row) => classKeysMatch(row.className, current.className)
                && (!nextSection || !row.section
                    || normalizeSectionKey(row.section) === normalizeSectionKey(nextSection)))
            .map((row) => row.subject)
            .filter(Boolean)
        const uniqueSubjects = [...new Set(nextSubjects)]
        const nextSubject = uniqueSubjects.includes(current.subject)
            ? current.subject
            : (uniqueSubjects[0] || '')
        return { section: nextSection, subject: nextSubject }
    }

    return {
        assignments,
        classOptions,
        sectionOptions,
        subjectOptions,
        applyClassChange,
        applySectionChange,
    }
}

export default useAssignedClassSectionSubject
