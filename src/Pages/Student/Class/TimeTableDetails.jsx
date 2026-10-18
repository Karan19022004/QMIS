import React, { useEffect, useMemo, useState } from 'react'
import WeeklyTimetable from '../Components/WeeklyTimetable'
import { useActiveStudent } from '../../../context/ActiveStudentContext'
import PlacementAwaitingNotice, { isStudentPlaced } from './Components/PlacementAwaitingNotice'
import {
    buildClassGridFromTimelines,
    getClassTimetables,
    hydrateClassTimetablesFromApi,
} from '../../Principal/ClassTimetable/classTimetableData'
import { canUseAcademicsApi } from '../../../services/academicsApi'

const classKey = (value) => String(value || '').trim().toLowerCase()

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const pickTimetableForStudent = (timetables, student) => {
    if (!student || !timetables?.length) return null
    const wantClass = classKey(student.className)
    const wantSection = classKey(student.section)
    const approved = timetables.filter((row) => {
        const status = String(row.approvalStatus || row.status || '').toLowerCase()
        return !status || status === 'approved' || status === 'active'
    })
    const pool = approved.length ? approved : timetables

    const scored = pool.map((row) => {
        const rowClass = classKey(row.className)
        const timelines = row.timelines || []
        const timelineMatch = timelines.some((t) => classKey(t.className) === wantClass)
        const classMatch = rowClass === wantClass || timelineMatch
        const sectionMatch = !wantSection
            || wantSection === '—'
            || classKey(row.section) === wantSection
            || timelines.some((t) => classKey(t.className) === wantClass && classKey(t.section) === wantSection)
        return { row, score: (classMatch ? 2 : 0) + (sectionMatch ? 1 : 0) }
    })
    scored.sort((a, b) => b.score - a.score)
    return scored[0]?.score > 0 ? scored[0].row : null
}

const deriveDailyRows = (grid) => {
    if (!grid?.timeSlots?.length || !grid?.schedule) return []
    const todayName = DAY_NAMES[new Date().getDay()]
    const dayKey = (grid.days || []).find((d) => classKey(d) === classKey(todayName))
        || (grid.days || [])[0]
    if (!dayKey) return []
    return grid.timeSlots.map((slot, index) => {
        const cell = grid.schedule?.[slot]?.[dayKey] || {}
        return {
            period: String(index + 1),
            time: slot,
            subject: cell.subject || '—',
            teacher: cell.teacher || '—',
        }
    }).filter((row) => row.subject && row.subject !== '—')
}

/**
 * Student/Parent timetable from campus class-timetables (no demo schedule).
 * `weeklyOnly` keeps a simpler Parent layout; Student still gets Daily + Weekly tabs from the same data.
 */
const TimeTableDetails = ({ weeklyOnly = false }) => {
    const { activeStudent, isParentPortal } = useActiveStudent()
    const [activeTab, setActiveTab] = useState(weeklyOnly ? 2 : 2)
    const [loading, setLoading] = useState(true)
    const [timetables, setTimetables] = useState([])
    const [loadError, setLoadError] = useState(null)

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        setLoadError(null)
        const load = async () => {
            if (canUseAcademicsApi()) {
                const ok = await hydrateClassTimetablesFromApi()
                if (!ok && !cancelled) {
                    setLoadError('Could not load class timetables from the campus API.')
                }
            }
            if (!cancelled) {
                setTimetables(getClassTimetables())
                setLoading(false)
            }
        }
        load()
        return () => { cancelled = true }
    }, [activeStudent?.id])

    const matched = useMemo(
        () => pickTimetableForStudent(timetables, activeStudent),
        [timetables, activeStudent],
    )

    const grid = useMemo(() => {
        if (!matched?.timelines?.length) return null
        const built = buildClassGridFromTimelines(
            matched.timelines.filter((row) => {
                if (!activeStudent?.className) return true
                return classKey(row.className) === classKey(activeStudent.className)
            }),
        )
        const schedule = {}
        Object.entries(built.schedule || {}).forEach(([slot, days]) => {
            schedule[slot] = {}
            Object.entries(days || {}).forEach(([day, cell]) => {
                const subject = String(cell?.subject || '').replace(/\s*\([^)]*\)\s*$/, '').trim()
                schedule[slot][day] = { subject: subject || cell?.subject, teacher: cell?.teacher || '—' }
            })
        })
        return { ...built, schedule }
    }, [matched, activeStudent?.className])

    const dailyRows = useMemo(() => deriveDailyRows(grid), [grid])
    const placed = isStudentPlaced(activeStudent)

    const header = (
        <div>
            <h2 className='text-xl font-medium text-black'>
                {weeklyOnly ? 'Timetable' : 'Time Table List'}
            </h2>
            <p className='text-sm text-[#667085] mt-1'>
                {activeStudent?.name
                    ? `${activeStudent.name} · ${activeStudent.className || 'Class'}${activeStudent.section ? `-${activeStudent.section}` : ''}`
                    : 'Select a child to view the class timetable'}
                {isParentPortal ? ' · campus class timetable' : ''}
            </p>
            {placed && activeStudent?.classTeacherEmail ? (
                <p className='text-sm text-[#515DEF] mt-1'>
                    Class teacher: {activeStudent.classTeacherEmail}
                </p>
            ) : null}
        </div>
    )

    const emptyOrLoading = (
        <>
            {!placed && (
                <PlacementAwaitingNotice
                    studentName={activeStudent?.name}
                    featureLabel='the class timetable'
                />
            )}
            {placed && loading && (
                <p className='text-sm text-[#667085] py-8 text-center'>Loading timetable…</p>
            )}
            {placed && !loading && loadError && (
                <p className='text-sm text-[#B54708] py-4'>{loadError}</p>
            )}
            {placed && !loading && !loadError && !matched && (
                <div className='py-10 text-center text-sm text-[#667085] space-y-2'>
                    <p>No approved class timetable found for this student’s class yet.</p>
                    <p className='text-xs'>
                        Principal / Coordinator publish class timetables under Academics.
                        Until then, this page stays empty (no demo schedule).
                    </p>
                </div>
            )}
        </>
    )

    if (weeklyOnly) {
        return (
            <section>
                <div className='bg-white rounded-2xl shadow-md p-4 space-y-4'>
                    {header}
                    {emptyOrLoading}
                    {placed && !loading && matched && grid && (
                        <WeeklyTimetable
                            days={grid.days}
                            timeSlots={grid.timeSlots}
                            schedule={grid.schedule}
                        />
                    )}
                </div>
            </section>
        )
    }

    return (
        <section>
            <div className='bg-white rounded-2xl shadow-md p-4 space-y-4'>
                {header}

                {emptyOrLoading}

                {placed && !loading && matched && grid && (
                    <>
                        <div className='flex gap-6 overflow-x-auto no-scrollbar border-b border-[#F2F4F7]'>
                            {[
                                { id: 1, label: 'Daily Timetable' },
                                { id: 2, label: 'Weekly Timetable' },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    type='button'
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`whitespace-nowrap px-1 pb-3 text-sm md:text-base font-medium cursor-pointer transition-all duration-200 ${
                                        activeTab === tab.id
                                            ? 'text-[#515DEF] border-b-2 border-[#515DEF] font-semibold'
                                            : 'text-[#808080]'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {activeTab === 1 && (
                            <div className='overflow-x-auto'>
                                {dailyRows.length === 0 ? (
                                    <p className='text-sm text-[#667085] py-8 text-center'>
                                        No periods scheduled for today in the published timetable.
                                    </p>
                                ) : (
                                    <table className='w-full text-sm text-left'>
                                        <thead className='text-xs bg-[#EDEEF5]'>
                                            <tr>
                                                <th className='px-3 py-3 rounded-s-lg'>Period</th>
                                                <th className='px-3 py-3'>Time</th>
                                                <th className='px-3 py-3'>Subject</th>
                                                <th className='px-3 py-3 rounded-e-lg'>Teacher</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {dailyRows.map((row) => (
                                                <tr key={`${row.period}-${row.time}`} className='border-b border-[#F2F4F7]'>
                                                    <td className='px-3 py-3'>{row.period}</td>
                                                    <td className='px-3 py-3'>{row.time}</td>
                                                    <td className='px-3 py-3'>{row.subject}</td>
                                                    <td className='px-3 py-3'>{row.teacher}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}

                        {activeTab === 2 && (
                            <WeeklyTimetable
                                days={grid.days}
                                timeSlots={grid.timeSlots}
                                schedule={grid.schedule}
                            />
                        )}
                    </>
                )}
            </div>
        </section>
    )
}

export default TimeTableDetails
