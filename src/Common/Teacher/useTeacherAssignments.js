import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getActiveCreatedUserSession } from '../RBAC/createdUsersData'
import { TEACHER_ALLOCATIONS_UPDATED_EVENT } from '../../Pages/Principal/TeacherAllocation/teacherAllocationData'
import { CLASS_TIMETABLES_UPDATED_EVENT } from '../../Pages/Principal/ClassTimetable/classTimetableData'
import {
    getCachedTeacherProfile,
    getTeacherAssignmentRows,
    getTeacherClassOptions,
    getTeacherClassSectionOptions,
    getTeacherSectionOptions,
    getTeacherSubjectOptions,
    getTeacherWeeklyScheduleFromTimetables,
    hydrateTeacherPortalAssignments,
    matchesClassSectionFilter,
    studentInTeacherScope,
    TEACHER_ASSIGNMENTS_UPDATED_EVENT,
} from './teacherAssignedClasses'

/** React hook: assigned classes/sections/subjects for the signed-in teacher. */
export const useTeacherAssignments = () => {
    const { email, name } = useAuth()
    const [ready, setReady] = useState(false)
    const [tick, setTick] = useState(0)
    const sessionEmail = String(email || getActiveCreatedUserSession()?.email || '').toLowerCase()

    useEffect(() => {
        let cancelled = false
        setReady(false)
        hydrateTeacherPortalAssignments({
            force: true,
            email: sessionEmail,
            name: name || '',
        }).finally(() => {
            if (!cancelled) {
                setReady(true)
                setTick((n) => n + 1)
            }
        })
        const onUpdate = () => setTick((n) => n + 1)
        window.addEventListener(TEACHER_ASSIGNMENTS_UPDATED_EVENT, onUpdate)
        window.addEventListener(TEACHER_ALLOCATIONS_UPDATED_EVENT, onUpdate)
        window.addEventListener(CLASS_TIMETABLES_UPDATED_EVENT, onUpdate)
        return () => {
            cancelled = true
            window.removeEventListener(TEACHER_ASSIGNMENTS_UPDATED_EVENT, onUpdate)
            window.removeEventListener(TEACHER_ALLOCATIONS_UPDATED_EVENT, onUpdate)
            window.removeEventListener(CLASS_TIMETABLES_UPDATED_EVENT, onUpdate)
        }
    }, [sessionEmail, name])

    return useMemo(() => {
        const profile = getCachedTeacherProfile() || { employeeId: '', name: name || '', email: sessionEmail }
        const assignments = getTeacherAssignmentRows(sessionEmail)
        return {
            ready,
            profile: {
                employeeId: profile.employeeId,
                name: profile.name || name || '',
                email: profile.email || sessionEmail,
            },
            assignments,
            classes: getTeacherClassOptions(sessionEmail),
            classSections: getTeacherClassSectionOptions(sessionEmail),
            sectionsFor: (className) => getTeacherSectionOptions(sessionEmail, className),
            subjects: getTeacherSubjectOptions(sessionEmail),
            studentInScope: (student) => studentInTeacherScope(student, sessionEmail),
            matchesClassSection: (entity, filter) => matchesClassSectionFilter(entity, filter),
            weeklyFromTimetables: getTeacherWeeklyScheduleFromTimetables(
                profile.name || name,
                profile.employeeId,
            ),
            emptyReason: !assignments.length
                ? 'No classes assigned yet. Ask Principal to allocate you under Teacher Allocation (or Admin Class Details assignments).'
                : '',
        }
        // tick forces refresh after hydrate / allocation events
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, sessionEmail, name, tick])
}

export default useTeacherAssignments
