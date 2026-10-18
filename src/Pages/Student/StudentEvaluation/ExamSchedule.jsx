import React, { useEffect, useMemo, useState } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { Calendar } from 'lucide-react'
import { useActiveStudent } from '../../../context/ActiveStudentContext'
import { canUseExamsApi, listExamsApi } from '../../../services/examsApi'
import { matchesStudentClass } from '../Class/studentClassMatch'
import PlacementAwaitingNotice, { isStudentPlaced } from '../Class/Components/PlacementAwaitingNotice'

const ExamSchedule = () => {
    const { activeStudent } = useActiveStudent()
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [fromDate, setFromDate] = useState(null)
    const [toDate, setToDate] = useState(null)
    const placed = isStudentPlaced(activeStudent)

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        setError('')
        ;(async () => {
            if (!canUseExamsApi()) {
                if (!cancelled) {
                    setRows([])
                    setLoading(false)
                }
                return
            }
            try {
                const list = await listExamsApi({ className: activeStudent?.className || undefined })
                if (!cancelled) setRows(list)
            } catch (err) {
                if (!cancelled) {
                    setRows([])
                    setError(err.message || 'Could not load exam schedules.')
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => { cancelled = true }
    }, [activeStudent?.id, activeStudent?.className])

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase()
        return rows.filter((row) => {
            const status = String(row.status || row.approvalStatus || '').toLowerCase()
            if (status && !['approved', 'published', 'scheduled', 'active'].includes(status)) {
                // still show if class matches and no strict status
            }
            const asRecord = {
                className: row.className || row.class_name || '',
                section: row.section || '',
            }
            if (activeStudent?.className && !matchesStudentClass(asRecord, activeStudent)) {
                // exams API may already filter by className
                if (asRecord.className && !matchesStudentClass(asRecord, activeStudent)) return false
            }
            if (query) {
                const hay = `${row.name || row.examName || ''} ${row.examType || ''} ${row.id || ''}`.toLowerCase()
                if (!hay.includes(query)) return false
            }
            const start = row.startDate || row.examDate || row.date
            if (start && fromDate) {
                const d = new Date(start)
                const begin = new Date(fromDate)
                begin.setHours(0, 0, 0, 0)
                if (!Number.isNaN(d.getTime()) && d < begin) return false
            }
            if (start && toDate) {
                const d = new Date(start)
                const end = new Date(toDate)
                end.setHours(23, 59, 59, 999)
                if (!Number.isNaN(d.getTime()) && d > end) return false
            }
            return true
        })
    }, [rows, activeStudent, search, fromDate, toDate])

    return (
        <section>
            <div className='bg-white rounded-2xl shadow-md p-4'>
                <div className='flex flex-wrap gap-4 justify-between'>
                    <button
                        type='button'
                        onClick={() => { setSearch(''); setFromDate(null); setToDate(null) }}
                        className='bg-[#515DEF] text-white uppercase text-sm px-6 py-2 rounded-lg'
                    >
                        Clear Filters
                    </button>
                </div>
                <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mt-4'>
                    <input
                        type='text'
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder='Search exam…'
                        className='text-sm border border-[#D9D9D9] rounded-md px-2 py-2'
                    />
                    <div className='relative'>
                        <DatePicker
                            selected={fromDate}
                            onChange={setFromDate}
                            isClearable
                            placeholderText='From'
                            className='w-full text-sm border border-[#D9D9D9] rounded-md px-3 py-2 pr-10'
                        />
                        <Calendar size={16} className='absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] pointer-events-none' />
                    </div>
                    <div className='relative'>
                        <DatePicker
                            selected={toDate}
                            onChange={setToDate}
                            isClearable
                            placeholderText='To'
                            className='w-full text-sm border border-[#D9D9D9] rounded-md px-3 py-2 pr-10'
                        />
                        <Calendar size={16} className='absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] pointer-events-none' />
                    </div>
                </div>
            </div>

            <div className='bg-white rounded-2xl shadow-md p-4 mt-8'>
                <h2 className='text-xl font-medium text-black mb-4'>Exam Schedule</h2>
                {!placed && (
                    <PlacementAwaitingNotice
                        studentName={activeStudent?.name}
                        featureLabel='exam schedules'
                    />
                )}
                {placed && error && <p className='text-sm text-[#B54708] mb-3'>{error}</p>}
                {placed && loading && <p className='text-sm text-[#667085] py-8 text-center'>Loading…</p>}
                {placed && !loading && (
                    <div className='overflow-x-auto'>
                        <table className='w-full text-sm text-left'>
                            <thead className='text-xs bg-[#EDEEF5]'>
                                <tr>
                                    <th className='px-2 py-3'>Exam</th>
                                    <th className='px-2 py-3'>Class</th>
                                    <th className='px-2 py-3'>Start</th>
                                    <th className='px-2 py-3'>End</th>
                                    <th className='px-2 py-3'>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className='px-2 py-10 text-center text-[#667085]'>
                                            No exam schedules published for your class yet.
                                        </td>
                                    </tr>
                                )}
                                {filtered.map((row) => (
                                    <tr key={row.id} className='border-b border-[#f2f4f7]'>
                                        <td className='px-2 py-4'>{row.name || row.examName || '—'}</td>
                                        <td className='px-2 py-4'>
                                            {row.className || '—'}
                                            {row.section ? `-${row.section}` : ''}
                                        </td>
                                        <td className='px-2 py-4'>{row.startDate || row.examDate || '—'}</td>
                                        <td className='px-2 py-4'>{row.endDate || '—'}</td>
                                        <td className='px-2 py-4'>{row.status || row.approvalStatus || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </section>
    )
}

export default ExamSchedule
