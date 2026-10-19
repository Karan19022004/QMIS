import React, { useCallback, useEffect, useMemo, useState } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { Calendar } from 'lucide-react'
import { useActiveStudent } from '../../../context/ActiveStudentContext'
import ExamSchedulePanel from '../../../Common/ExamSchedule/ExamSchedulePanel'
import {
    filterStudentVisibleExams,
    loadMergedExamRecords,
    toScheduleRow,
} from '../../../Common/ExamSchedule/examScheduleData'
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

    const reload = useCallback(async () => {
        if (!placed) {
            setRows([])
            setLoading(false)
            return
        }
        setLoading(true)
        setError('')
        try {
            const merged = await loadMergedExamRecords()
            const visible = filterStudentVisibleExams(merged, activeStudent)
            setRows(visible.map(toScheduleRow))
        } catch (err) {
            setRows([])
            setError(err?.message || 'Could not load exam schedules.')
        } finally {
            setLoading(false)
        }
    }, [activeStudent, placed])

    useEffect(() => {
        reload()
    }, [reload])

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase()
        return rows.filter((row) => {
            if (query) {
                const hay = `${row.name || ''} ${row.examType || ''} ${row.id || ''}`.toLowerCase()
                if (!hay.includes(query)) return false
            }
            const start = row.startDate
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
    }, [rows, search, fromDate, toDate])

    if (!placed) {
        return (
            <section>
                <div className='bg-white rounded-2xl shadow-md p-8'>
                    <h2 className='text-xl font-semibold text-black mb-4'>Exam Schedule</h2>
                    <PlacementAwaitingNotice
                        studentName={activeStudent?.name}
                        featureLabel='exam schedules'
                    />
                </div>
            </section>
        )
    }

    return (
        <section className='space-y-6'>
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

            <ExamSchedulePanel
                title='Exam Schedule'
                description='Exam timetables for your class after your grade coordinator forwards them.'
                rows={filtered}
                loading={loading}
                error={error}
                mode='view'
                emptyMessage='No exam timetables forwarded for your class yet.'
            />
        </section>
    )
}

export default ExamSchedule
