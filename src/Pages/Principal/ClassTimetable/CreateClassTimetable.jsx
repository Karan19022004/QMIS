import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ClassTimelineEditor from './Components/ClassTimelineEditor'
import {
    TERMS,
    addClassTimetable,
    defaultClassTimetableForm,
    generateTimetableId,
    getTimetableRoutes,
    hydrateClassTimetablesFromApi,
    loadClassTimetableTeacherOptions,
} from './classTimetableData'

const inputClass =
    'text-sm font-normal text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-2 py-3 w-full'

const selectClass =
    'text-sm font-normal text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-2 py-3 w-full bg-white'

const CreateClassTimetable = () => {
    const navigate = useNavigate()
    const { pathname } = useLocation()
    const { listPath } = getTimetableRoutes(pathname)
    const createdByRole = pathname.startsWith('/coordinator') ? 'Coordinator' : 'Principal'

    const [form, setForm] = useState(() => ({
        ...defaultClassTimetableForm(),
        timetableId: generateTimetableId(),
    }))
    const [errors, setErrors] = useState([])
    const [teachers, setTeachers] = useState([])
    const [loadingTeachers, setLoadingTeachers] = useState(true)

    useEffect(() => {
        hydrateClassTimetablesFromApi().then(() => {
            setForm((current) => ({
                ...current,
                timetableId: current.timetableId || generateTimetableId(),
            }))
        })
        let cancelled = false
        setLoadingTeachers(true)
        loadClassTimetableTeacherOptions()
            .then((rows) => {
                if (!cancelled) setTeachers(rows)
            })
            .finally(() => {
                if (!cancelled) setLoadingTeachers(false)
            })
        return () => {
            cancelled = true
        }
    }, [])

    const updateField = (key, value) => {
        setForm((current) => ({ ...current, [key]: value }))
    }

    const selectOwnerTeacher = (employeeId) => {
        const selected = teachers.find((item) => item.employeeId === employeeId)
        setForm((current) => ({
            ...current,
            ownerTeacherId: selected?.employeeId || '',
            ownerTeacherName: selected?.name || '',
            ownerTeacherEmail: selected?.email || '',
            timelines: current.timelines.map((row) => ({
                ...row,
                teacher: selected?.name || '',
                className: '',
                section: '',
                subject: '',
            })),
        }))
    }

    const validate = () => {
        const nextErrors = []
        if (!form.academicYear) nextErrors.push('Academic year is required.')
        if (!form.ownerTeacherId) nextErrors.push('Select the teacher this timetable belongs to.')
        if (!form.timelines.some((row) => (
            row.day && row.className && row.section && row.subject && row.startTime && row.endTime
        ))) {
            nextErrors.push('Add at least one complete timeline row (day, class, section, subject, and times).')
        }
        setErrors(nextErrors)
        return nextErrors.length === 0
    }

    const handleSubmit = () => {
        if (!validate()) return
        addClassTimetable({ ...form, createdByRole })
        navigate(listPath)
    }

    return (
        <section>
            <div className='bg-white rounded-2xl shadow-md p-4 space-y-8'>
                <div>
                    <h2 className='text-xl font-semibold text-black'>Create Class Timetable</h2>
                    <p className='text-sm text-[#667085] mt-1'>
                        Select the teacher this timetable belongs to, then add periods with the grade for each slot.
                    </p>
                </div>

                {errors.length > 0 && (
                    <div className='rounded-lg border border-red-200 bg-red-50 p-4'>
                        <ul className='list-disc pl-5 text-sm text-red-600 space-y-1'>
                            {errors.map((error) => (
                                <li key={error}>{error}</li>
                            ))}
                        </ul>
                    </div>
                )}

                <div>
                    <h3 className='text-lg font-semibold text-black mb-4'>Timetable Information</h3>
                    <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6'>
                        <div className='flex flex-col gap-y-2'>
                            <label htmlFor='timetable-id' className='text-base font-medium text-[#1E1E1E]'>Timetable ID:</label>
                            <input type='text' id='timetable-id' value={form.timetableId} readOnly className={inputClass} />
                        </div>
                        <div className='flex flex-col gap-y-2'>
                            <label htmlFor='owner-teacher' className='text-base font-medium text-[#1E1E1E]'>Teacher:</label>
                            <select
                                id='owner-teacher'
                                value={form.ownerTeacherId}
                                onChange={(e) => selectOwnerTeacher(e.target.value)}
                                className={selectClass}
                                disabled={loadingTeachers}
                            >
                                <option value=''>
                                    {loadingTeachers ? 'Loading teachers…' : teachers.length ? 'Select teacher' : 'No teachers found'}
                                </option>
                                {teachers.map((teacher) => (
                                    <option key={teacher.employeeId} value={teacher.employeeId}>
                                        {teacher.name}{teacher.email ? ` (${teacher.email})` : ''}
                                    </option>
                                ))}
                            </select>
                            <p className='text-xs text-[#667085]'>This timetable ID belongs to the selected teacher.</p>
                        </div>
                        <div className='flex flex-col gap-y-2'>
                            <label htmlFor='academic-year' className='text-base font-medium text-[#1E1E1E]'>Academic Year:</label>
                            <input
                                type='text'
                                id='academic-year'
                                value={form.academicYear}
                                onChange={(e) => updateField('academicYear', e.target.value)}
                                placeholder='e.g. 2025-2026'
                                className={inputClass}
                            />
                        </div>
                        <div className='flex flex-col gap-y-2'>
                            <label htmlFor='term' className='text-base font-medium text-[#1E1E1E]'>Term:</label>
                            <select id='term' value={form.term} onChange={(e) => updateField('term', e.target.value)} className={selectClass}>
                                <option value=''>Select term</option>
                                {TERMS.map((term) => (
                                    <option key={term} value={term}>{term}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <ClassTimelineEditor
                    timelines={form.timelines}
                    onChange={(timelines) => updateField('timelines', timelines)}
                    ownerTeacherId={form.ownerTeacherId}
                    defaultTeacher={form.ownerTeacherName}
                />
            </div>

            <div className='flex sm:justify-end justify-center gap-x-4 mt-6'>
                <button
                    type='button'
                    onClick={() => navigate(listPath)}
                    className='bg-white text-[#515DEF] text-sm text-center px-12 py-2 rounded-md border border-[#515DEF] hover:bg-[#515DEF] hover:text-white transition-all duration-200 cursor-pointer md:w-auto w-full'
                >
                    Discard Changes
                </button>
                <button
                    type='button'
                    onClick={handleSubmit}
                    className='bg-[#515DEF] text-white text-sm text-center px-12 py-2 rounded-md border border-[#515DEF] hover:opacity-90 transition-all duration-200 cursor-pointer md:w-auto w-full'
                >
                    Submit for Approval
                </button>
            </div>
        </section>
    )
}

export default CreateClassTimetable
