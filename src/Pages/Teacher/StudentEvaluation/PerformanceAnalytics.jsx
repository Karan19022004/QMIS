import React, { useEffect, useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { hydrateEnrolledStudentsFromApi } from '../../../Common/StudentDatabase/enrolledStudentsData'
import { getStudentsList } from '../../../Common/StudentDatabase/studentDatabaseData'
import { useTeacherAssignments } from '../../../Common/Teacher/useTeacherAssignments'
import { isApiStudentsEnabled } from '../../../services/apiClient'
import {
    canUseExamsApi,
    listExamsApi,
    listMarksBatchesApi,
    mapExamFromApi,
    mapMarksBatchFromApi,
} from '../../../services/examsApi'

const selectClass = 'border border-[#D9D9D9] rounded-md px-2 py-2 text-sm bg-white min-w-[12rem]'

const PerformanceAnalytics = () => {
    const assignments = useTeacherAssignments()
    const [students, setStudents] = useState([])
    const [batches, setBatches] = useState([])
    const [examsById, setExamsById] = useState({})
    const [studentId, setStudentId] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            setLoading(true)
            setError('')
            try {
                if (isApiStudentsEnabled()) await hydrateEnrolledStudentsFromApi()
                const all = getStudentsList()
                const scoped = assignments.ready && assignments.assignments.length
                    ? all.filter((row) => assignments.studentInScope(row))
                    : []
                if (cancelled) return
                setStudents(scoped)

                if (!canUseExamsApi()) {
                    setBatches([])
                    setExamsById({})
                    return
                }
                const [examRows, batchRows] = await Promise.all([
                    listExamsApi(),
                    listMarksBatchesApi({ mine: true }),
                ])
                if (cancelled) return
                const examMap = {}
                examRows.map(mapExamFromApi).forEach((exam) => {
                    examMap[exam.id] = exam
                })
                setExamsById(examMap)
                setBatches(batchRows.map(mapMarksBatchFromApi))
            } catch (err) {
                if (!cancelled) setError(err?.message || 'Could not load marks.')
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => {
            cancelled = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when assignment hydrate settles
    }, [assignments.ready, assignments.assignments.length])

    useEffect(() => {
        if (!studentId && students[0]) setStudentId(String(students[0].id))
    }, [students, studentId])

    const selected = students.find((row) => String(row.id) === String(studentId))

    const series = useMemo(() => {
        if (!studentId) return { labels: [], scores: [], averages: [], rows: [] }
        const points = []
        batches.forEach((batch) => {
            const entry = (batch.entries || []).find((item) => String(item.studentId) === String(studentId))
            if (!entry || entry.absent || entry.marks == null || !batch.maxMarks) return
            const scored = (Number(entry.marks) / Number(batch.maxMarks)) * 100
            const classMarks = (batch.entries || [])
                .filter((item) => !item.absent && item.marks != null)
                .map((item) => (Number(item.marks) / Number(batch.maxMarks)) * 100)
            const classAvg = classMarks.length
                ? classMarks.reduce((sum, value) => sum + value, 0) / classMarks.length
                : null
            const exam = examsById[batch.examId]
            points.push({
                label: exam?.name || batch.examName || batch.subject || 'Exam',
                subject: batch.subject || '',
                score: Math.round(scored * 10) / 10,
                average: classAvg == null ? null : Math.round(classAvg * 10) / 10,
                status: batch.status,
            })
        })
        return {
            labels: points.map((item) => item.label),
            scores: points.map((item) => item.score),
            averages: points.map((item) => item.average),
            rows: points,
        }
    }, [batches, examsById, studentId])

    const option = useMemo(() => ({
        color: ['#515DEF', '#B4C4FF'],
        tooltip: { trigger: 'axis' },
        legend: { data: ['Student score', 'Class average'] },
        xAxis: { type: 'category', data: series.labels.length ? series.labels : ['No exams'] },
        yAxis: { type: 'value', min: 0, max: 100 },
        series: [
            { name: 'Student score', type: 'line', data: series.scores },
            { name: 'Class average', type: 'line', data: series.averages },
        ],
    }), [series])

    const avgScore = series.scores.length
        ? Math.round((series.scores.reduce((sum, value) => sum + value, 0) / series.scores.length) * 10) / 10
        : null

    return (
        <section className='bg-white rounded-2xl shadow-md p-4 space-y-4'>
            <div className='flex justify-between gap-3 flex-wrap items-start'>
                <div>
                    <h2 className='text-xl font-semibold'>Student performance comparison</h2>
                    <p className='text-sm text-[#667085]'>
                        Scores from your marks batches for students in assigned classes. Empty until marks are entered and submitted.
                    </p>
                    {assignments.emptyReason ? (
                        <p className='text-sm text-[#E65100] mt-1'>{assignments.emptyReason}</p>
                    ) : null}
                    {error ? <p className='text-sm text-[#FF0000] mt-1'>{error}</p> : null}
                </div>
                <select
                    value={studentId}
                    onChange={(event) => setStudentId(event.target.value)}
                    className={selectClass}
                    disabled={!students.length}
                >
                    {!students.length ? <option value=''>No assigned students</option> : null}
                    {students.map((student) => (
                        <option key={student.id} value={String(student.id)}>
                            {student.name} ({student.className || student.class}{student.section ? `-${student.section}` : ''})
                        </option>
                    ))}
                </select>
            </div>

            {selected ? (
                <p className='text-sm text-[#667085]'>
                    {selected.name}
                    {selected.className || selected.class
                        ? ` · ${selected.className || selected.class}${selected.section ? `-${selected.section}` : ''}`
                        : ''}
                    {avgScore != null ? ` · Average ${avgScore}% across ${series.scores.length} marked exam(s)` : ''}
                </p>
            ) : null}

            {loading ? (
                <p className='text-sm text-[#667085]'>Loading analytics…</p>
            ) : !canUseExamsApi() ? (
                <p className='text-sm text-[#667085]'>Sign in with API auth to load exam marks.</p>
            ) : !series.rows.length ? (
                <p className='text-sm text-[#667085]'>
                    No marks found for this student in your batches yet. Enter marks under Student Evaluation / Mark Entry, then return here.
                </p>
            ) : (
                <ReactECharts option={option} style={{ height: 320 }} />
            )}

            {series.rows.length > 0 ? (
                <div className='overflow-x-auto'>
                    <table className='w-full text-sm'>
                        <thead>
                            <tr className='text-left text-[#667085] border-b'>
                                <th className='py-2 pr-3'>Exam</th>
                                <th className='py-2 pr-3'>Subject</th>
                                <th className='py-2 pr-3'>Student %</th>
                                <th className='py-2 pr-3'>Class avg %</th>
                                <th className='py-2'>Batch status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {series.rows.map((row) => (
                                <tr key={`${row.label}-${row.subject}`} className='border-b border-[#F0F0F0]'>
                                    <td className='py-2 pr-3'>{row.label}</td>
                                    <td className='py-2 pr-3'>{row.subject || '—'}</td>
                                    <td className='py-2 pr-3'>{row.score}</td>
                                    <td className='py-2 pr-3'>{row.average ?? '—'}</td>
                                    <td className='py-2'>{row.status || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : null}
        </section>
    )
}

export default PerformanceAnalytics
