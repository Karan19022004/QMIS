import React, { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../../../context/AuthContext'
import ExamSchedulePanel from '../../../../Common/ExamSchedule/ExamSchedulePanel'
import {
    filterTeacherVisibleExams,
    loadMergedExamRecords,
    toScheduleRow,
} from '../../../../Common/ExamSchedule/examScheduleData'
import { hydrateTeacherPortalAssignments } from '../../../../Common/Teacher/teacherAssignedClasses'

const ExamSchedule = () => {
    const { email } = useAuth()
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const reload = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            await hydrateTeacherPortalAssignments().catch(() => {})
            const merged = await loadMergedExamRecords()
            const visible = filterTeacherVisibleExams(merged, email)
            setRows(visible.map(toScheduleRow))
        } catch (err) {
            setRows([])
            setError(err?.message || 'Could not load exam schedules.')
        } finally {
            setLoading(false)
        }
    }, [email])

    useEffect(() => {
        reload()
    }, [reload])

    return (
        <ExamSchedulePanel
            title='Exam Schedule'
            description='Approved exam timetables forwarded by your grade coordinator for the classes and subjects you teach.'
            rows={rows}
            loading={loading}
            error={error}
            mode='view'
            emptyMessage='No forwarded exam timetables for your classes yet.'
        />
    )
}

export default ExamSchedule
