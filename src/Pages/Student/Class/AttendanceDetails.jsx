import React, { useCallback, useEffect, useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { CalendarRange, BadgePercent, CircleCheck, Calendar, XCircle, ArrowRight } from 'lucide-react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import AttendanceCalendar from './Components/AttendanceCalendar'
import { NavLink } from 'react-router-dom'
import { useActiveStudent } from '../../../context/ActiveStudentContext'
import { getAccessToken, isApiAuthEnabled } from '../../../services/apiClient'
import { studentAttendanceCalendarApi } from '../../../services/attendanceApi'
import PlacementAwaitingNotice, { isStudentPlaced } from './Components/PlacementAwaitingNotice'

const recentStatusStyles = {
    P: 'bg-[#E8F0FE] text-[#0C1E5B]',
    A: 'bg-[#FDF3F4] text-[#980E0F]',
    H: 'bg-[#EDEEF5] text-[#808080]',
}

const summarizeCalendar = (calendar) => {
    const entries = Object.entries(calendar || {})
    let present = 0
    let absent = 0
    let holiday = 0
    entries.forEach(([, code]) => {
        if (code === 'P') present += 1
        else if (code === 'A') absent += 1
        else if (code === 'H') holiday += 1
    })
    const working = present + absent
    const percentage = working > 0 ? (present / working) * 100 : 0
    return {
        present,
        absent,
        holiday,
        working,
        percentage,
        totalMarked: entries.length,
    }
}

const AttendanceDetails = () => {
    const { routePrefix, activeStudent } = useActiveStudent()
    const [selectMonth, setSelectMonth] = useState(new Date())
    const [calendar, setCalendar] = useState({})
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const fetchAttendance = useCallback(
        async (year, month) => {
            if (!isApiAuthEnabled() || !getAccessToken() || !activeStudent?.id) {
                return {}
            }
            return studentAttendanceCalendarApi(activeStudent.id, year, month)
        },
        [activeStudent?.id],
    )

    useEffect(() => {
        if (!isStudentPlaced(activeStudent) || !activeStudent?.id || !selectMonth) {
            setCalendar({})
            return undefined
        }
        let cancelled = false
        setLoading(true)
        setError('')
        const year = selectMonth.getFullYear()
        const month = selectMonth.getMonth() + 1
        fetchAttendance(year, month)
            .then((data) => {
                if (!cancelled) setCalendar(data && typeof data === 'object' ? data : {})
            })
            .catch((err) => {
                if (!cancelled) {
                    setCalendar({})
                    setError(err.message || 'Could not load attendance.')
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => { cancelled = true }
    }, [activeStudent, selectMonth, fetchAttendance])

    const stats = useMemo(() => summarizeCalendar(calendar), [calendar])

    const recentAttendance = useMemo(() => {
        return Object.entries(calendar)
            .map(([dateKey, status]) => {
                const d = new Date(`${dateKey}T12:00:00`)
                return {
                    status,
                    dateKey,
                    date: Number.isNaN(d.getTime())
                        ? dateKey
                        : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                    label: status === 'H' ? 'Holiday' : status === 'A' ? 'Absent' : 'Present',
                }
            })
            .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
            .slice(0, 8)
    }, [calendar])

    const attendanceChartOption = useMemo(() => ({
        series: [{
            type: 'gauge',
            startAngle: 90,
            endAngle: -270,
            min: 0,
            max: 100,
            pointer: { show: false },
            axisTick: { show: false },
            splitLine: { show: false },
            axisLabel: { show: false },
            progress: {
                show: true,
                width: 18,
                roundCap: true,
                itemStyle: { color: '#FF8C00' },
            },
            axisLine: {
                lineStyle: {
                    width: 18,
                    color: [[1, 'rgba(255, 152, 0, 0.25)']],
                },
            },
            data: [{ value: Number(stats.percentage.toFixed(2)) }],
            detail: { show: false },
        }],
    }), [stats.percentage])

    const percentageTone = stats.percentage >= 75 ? 'Good' : stats.percentage > 0 ? 'Needs attention' : '—'

    if (!isStudentPlaced(activeStudent)) {
        return (
            <section>
                <div className='bg-white rounded-2xl shadow-md p-4'>
                    <h2 className='text-xl font-medium text-black mb-2'>Attendance</h2>
                    <PlacementAwaitingNotice
                        studentName={activeStudent?.name}
                        featureLabel='attendance'
                    />
                </div>
            </section>
        )
    }

    return (
        <section>
            <div className='bg-white rounded-2xl shadow-md p-4 mt-2'>
                {activeStudent?.classTeacherEmail ? (
                    <p className='text-sm text-[#515DEF] mb-4'>
                        Class teacher: {activeStudent.classTeacherEmail}
                    </p>
                ) : null}
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end'>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#808080]'>Select Month</label>
                        <div className='relative w-full'>
                            <DatePicker
                                selected={selectMonth}
                                onChange={(date) => setSelectMonth(date || new Date())}
                                showMonthYearPicker
                                dateFormat='MMMM yyyy'
                                className='w-full text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-3 py-3 pr-10 focus:outline-none'
                            />
                            <Calendar
                                size={16}
                                className='absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] pointer-events-none'
                            />
                        </div>
                    </div>
                    <button
                        type='button'
                        onClick={() => setSelectMonth(new Date())}
                        className='bg-[#515DEF] text-white uppercase text-sm px-6 py-3 rounded-lg'
                    >
                        Clear Filters
                    </button>
                </div>
                {error && <p className='text-sm text-[#B54708] mt-3'>{error}</p>}
                {loading && <p className='text-sm text-[#667085] mt-3'>Loading attendance…</p>}
            </div>

            <div className='bg-white rounded-2xl shadow-md p-4 mt-6'>
                <div className='grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-4'>
                    <div className='bg-[#F0F8FE] border border-[#D2E2F0] rounded-xl p-4 flex justify-center items-center'>
                        <div className='flex flex-col items-center gap-4'>
                            <div className='flex items-center justify-center w-20 h-20 rounded-full bg-[#BFD9F8] p-4'>
                                <CalendarRange className='text-[#515DEF] w-10 h-10' />
                            </div>
                            <div className='flex flex-col items-center gap-y-2'>
                                <h3 className='text-lg font-bold text-[#0C1E5B]'>Total Working Days</h3>
                                <span className='text-4xl font-bold text-[#0C1E5B]'>{stats.working}</span>
                            </div>
                        </div>
                    </div>
                    <div className='bg-[#F1FCF2] border border-[#D1E7CC] rounded-xl p-4 flex justify-center items-center'>
                        <div className='flex flex-col items-center gap-4'>
                            <div className='flex items-center justify-center w-20 h-20 rounded-full bg-[#C7E9C7] p-4'>
                                <CircleCheck className='text-[#0B6D2C] w-10 h-10' />
                            </div>
                            <div className='flex flex-col items-center gap-y-2'>
                                <h3 className='text-lg font-bold text-[#0B6D2C]'>Present Days</h3>
                                <span className='text-4xl font-bold text-[#0B6D2C]'>{stats.present}</span>
                            </div>
                        </div>
                    </div>
                    <div className='bg-[#FDF3F4] border border-[#F5D7DA] rounded-xl p-4 flex justify-center items-center'>
                        <div className='flex flex-col items-center gap-4'>
                            <div className='flex items-center justify-center w-20 h-20 rounded-full bg-[#F2C9CB] p-4'>
                                <XCircle className='text-[#980E0F] w-10 h-10' />
                            </div>
                            <div className='flex flex-col items-center gap-y-2'>
                                <h3 className='text-lg font-bold text-[#980E0F]'>Absent Days</h3>
                                <span className='text-4xl font-bold text-[#980E0F]'>{stats.absent}</span>
                            </div>
                        </div>
                    </div>
                    <div className='bg-[#F9F7FE] border border-[#DFDDEF] rounded-xl p-4 flex justify-center items-center'>
                        <div className='flex flex-col items-center gap-4'>
                            <div className='flex items-center justify-center w-20 h-20 rounded-full bg-[#E1D7FD] p-4'>
                                <BadgePercent className='text-[#2515B4] w-10 h-10' />
                            </div>
                            <div className='flex flex-col items-center gap-y-2'>
                                <h3 className='text-lg font-bold text-[#2515B4]'>Attendance Percentage</h3>
                                <span className='text-4xl font-bold text-[#2515B4]'>
                                    {stats.working ? `${stats.percentage.toFixed(2)}%` : '—'}
                                </span>
                                <span className='text-sm font-medium text-[#008000]'>{percentageTone}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-x-6 gap-y-4 mt-6'>
                <div className='col-span-4'>
                    <AttendanceCalendar fetchAttendance={fetchAttendance} />
                </div>

                <div className='col-span-2'>
                    <div className='bg-white rounded-2xl shadow-md p-6 flex flex-col gap-6 h-full'>
                        <h3 className='text-xl font-bold text-[#0C1E5B] text-center'>Overall Attendance</h3>

                        <div className='relative w-[200px] h-[200px] mx-auto shrink-0'>
                            <ReactECharts
                                option={attendanceChartOption}
                                style={{ height: '200px', width: '200px' }}
                                opts={{ renderer: 'svg' }}
                            />
                            <div className='absolute inset-0 flex flex-col items-center justify-center pointer-events-none'>
                                <span className='text-2xl font-bold text-[#0C1E5B]'>
                                    {stats.working ? `${stats.percentage.toFixed(2)}%` : '—'}
                                </span>
                                <span className='text-sm font-medium text-[#FF8C00] mt-1'>This month</span>
                            </div>
                        </div>

                        <div className='flex flex-col gap-4'>
                            <div className='flex items-center justify-between'>
                                <span className='text-base font-bold text-[#0C1E5B]'>Working days</span>
                                <span className='text-base font-bold text-[#0C1E5B]'>{stats.working}</span>
                            </div>
                            <div className='flex items-center justify-between'>
                                <span className='text-base font-bold text-[#0C1E5B]'>Present</span>
                                <span className='text-base font-bold text-[#0C1E5B]'>{stats.present}</span>
                            </div>
                            <div className='flex items-center justify-between'>
                                <span className='text-base font-bold text-[#0C1E5B]'>Absent</span>
                                <span className='text-base font-bold text-[#0C1E5B]'>{stats.absent}</span>
                            </div>
                            <div className='flex items-center justify-between'>
                                <span className='text-base font-bold text-[#0C1E5B]'>Holidays</span>
                                <span className='text-base font-bold text-[#0C1E5B]'>{stats.holiday}</span>
                            </div>
                        </div>

                        <hr className='border-t border-[#E0E0E0] rounded-full' />

                        <p className='text-sm text-[#808080]'>
                            Note: Minimum 75% attendance required. Subject-wise breakdown is not available from
                            the attendance API yet.
                        </p>
                    </div>
                </div>
            </div>

            <div className='grid grid-cols-1 lg:grid-cols-6 gap-x-6 gap-y-4 mt-6'>
                <div className='col-span-4'>
                    <div className='bg-white rounded-2xl shadow-md p-6'>
                        <h3 className='text-lg font-bold text-[#0C1E5B] mb-2'>Subject-wise Attendance Summary</h3>
                        <p className='text-sm text-[#667085] py-8 text-center'>
                            Subject-wise attendance is not published yet. Daily present/absent marks are shown
                            in the calendar and report.
                        </p>
                    </div>
                </div>

                <div className='col-span-2'>
                    <div className='bg-white rounded-2xl shadow-md p-6 flex flex-col h-full'>
                        <h3 className='text-lg font-bold text-[#0C1E5B] mb-4'>Recent Attendance</h3>

                        <div className='flex flex-col gap-5 flex-1'>
                            {recentAttendance.length === 0 && (
                                <p className='text-sm text-[#667085] text-center py-6'>No marks for this month.</p>
                            )}
                            {recentAttendance.map((item) => (
                                <div key={item.dateKey} className='flex items-center gap-3'>
                                    <span
                                        className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${recentStatusStyles[item.status] || recentStatusStyles.H}`}
                                    >
                                        {item.status}
                                    </span>
                                    <div className='flex flex-1 items-center justify-between gap-2 min-w-0'>
                                        <span className='text-sm font-bold text-[#0C1E5B] whitespace-nowrap'>{item.date}</span>
                                        <span className='text-sm text-[#0C1E5B] truncate'>{item.label}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <NavLink
                            to={`${routePrefix}/class/attendance-report`}
                            className='flex justify-center items-center gap-1.5 text-base font-medium text-[#515DEF] text-center underline-offset-8 underline decoration-[#515DEF] mt-6 hover:opacity-80 transition-opacity cursor-pointer'
                        >
                            View Full Report
                            <ArrowRight className='w-4 h-4' />
                        </NavLink>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default AttendanceDetails
