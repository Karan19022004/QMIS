import React, { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../../../context/AuthContext'
import ExamSchedulePanel from '../../../../Common/ExamSchedule/ExamSchedulePanel'
import {
    DISTRIBUTION,
    filterCoordinatorInbox,
    loadMergedExamRecords,
    loadMyCoordinatorBand,
    toScheduleRow,
} from '../../../../Common/ExamSchedule/examScheduleData'

const ExamSchedule = () => {
    const { email, name } = useAuth()
    const [inbox, setInbox] = useState([])
    const [forwarded, setForwarded] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [bandLabel, setBandLabel] = useState('')

    const reload = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const [merged, band] = await Promise.all([
                loadMergedExamRecords(),
                loadMyCoordinatorBand(),
            ])
            const gradeFrom = band?.gradeFrom ?? null
            const gradeTo = band?.gradeTo ?? null
            const userId = band?.userId || ''
            if (gradeFrom != null && gradeTo != null) {
                setBandLabel(`Grades ${gradeFrom}–${gradeTo}`)
            } else {
                setBandLabel('')
            }

            const waiting = filterCoordinatorInbox(merged, {
                email,
                name,
                userId,
                gradeFrom,
                gradeTo,
            })
            const sent = merged.filter((row) => (
                String(row.approvalStatus || '').toLowerCase() === 'approved'
                && row.distributionStatus === DISTRIBUTION.FORWARDED
                && (
                    !row.coordinatorEmail
                    || String(row.coordinatorEmail).toLowerCase() === String(email || '').toLowerCase()
                    || (userId && String(row.coordinatorId || '') === String(userId))
                    || (
                        gradeFrom != null
                        && gradeTo != null
                        && (() => {
                            const g = Number(String(row.className || '').match(/(\d{1,2})/)?.[1])
                            return Number.isFinite(g) && g >= gradeFrom && g <= gradeTo
                        })()
                    )
                )
            ))
            setInbox(waiting.map(toScheduleRow))
            setForwarded(sent.map(toScheduleRow))
        } catch (err) {
            setInbox([])
            setForwarded([])
            setError(err?.message || 'Could not load exam timetables.')
        } finally {
            setLoading(false)
        }
    }, [email, name])

    useEffect(() => {
        reload()
    }, [reload])

    return (
        <div className='space-y-8'>
            <ExamSchedulePanel
                title='Approved Exam Timetables'
                description={
                    bandLabel
                        ? `Principal/Director approved timetables for ${bandLabel}. Forward each one to teachers and students of that grade.`
                        : 'Principal/Director approved timetables assigned to you. Forward each one to teachers and students of that grade.'
                }
                rows={inbox}
                loading={loading}
                error={error}
                mode='forward'
                onForwarded={reload}
                emptyMessage='No approved exam timetables waiting to be forwarded.'
            />
            <ExamSchedulePanel
                title='Forwarded to Class'
                description='Timetables you already sent to teachers and students.'
                rows={forwarded}
                loading={false}
                error=''
                mode='view'
                emptyMessage='Nothing forwarded yet.'
            />
        </div>
    )
}

export default ExamSchedule
