import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { Calendar } from 'lucide-react'
import ExamTimelineEditor from './Components/ExamTimelineEditor'
import ScrollableSelect from '../../../Common/CommonComponents/ScrollableSelect'
import {
    EXAM_STATUSES,
    EXAM_TYPE_OPTIONS,
    addExamTimetable,
    defaultExamTimetableForm,
    examRecordToForm,
    generateExamId,
    getExamTimetableById,
    getExamTimetableRoutes,
    getSubjectsForClass,
    loadExamFormOptions,
    mapExamApiToTimetableRecord,
    updateExamTimetable,
} from './examinationTimetableData'
import { TEACHER_ALLOCATIONS_UPDATED_EVENT } from '../TeacherAllocation/teacherAllocationData'
import {
    findCoordinatorForClass,
    loadCoordinatorOptions,
} from '../../../Common/ExamSchedule/examScheduleData'
import {
    canUseExamsApi,
    createExamApi,
    getExamApi,
    submitExamApi,
    updateExamApi,
} from '../../../services/examsApi'
import { loadAcademicYearOptions } from '../ClassTimetable/classTimetableData'

const inputClass =
    'text-sm font-normal text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-2 py-3 w-full'

const toIsoDate = (value) => {
    if (!value) return null
    if (typeof value === 'string') return value.slice(0, 10)
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

const CreateExaminationTimetable = () => {
    const navigate = useNavigate()
    const { pathname } = useLocation()
    const { id: editId } = useParams()
    const { listPath } = getExamTimetableRoutes(pathname)
    const isEdit = Boolean(editId)
    const api = canUseExamsApi()
    const [form, setForm] = useState(() => ({
        ...defaultExamTimetableForm(),
        examId: generateExamId(),
    }))
    const [errors, setErrors] = useState([])
    const [saving, setSaving] = useState(false)
    const [optionsLoading, setOptionsLoading] = useState(true)
    const [recordLoading, setRecordLoading] = useState(isEdit)
    const [classOptions, setClassOptions] = useState([])
    const [sectionsByClass, setSectionsByClass] = useState({})
    const [coordinatorOptions, setCoordinatorOptions] = useState([])
    const [academicYearOptions, setAcademicYearOptions] = useState([])
    /** Bumps when allocations hydrate / update so class subjects recompute. */
    const [allocationsTick, setAllocationsTick] = useState(0)

    useEffect(() => {
        let cancelled = false
        setOptionsLoading(true)
        Promise.all([loadExamFormOptions(), loadCoordinatorOptions(), loadAcademicYearOptions()])
            .then(([opts, coordinators, years]) => {
                if (cancelled) return
                setClassOptions(opts.classes || [])
                setSectionsByClass(opts.sectionsByClass || {})
                setCoordinatorOptions(coordinators || [])
                const yearRows = Array.isArray(years) ? years : []
                setAcademicYearOptions(yearRows)
                const currentYear = yearRows.find((y) => y.isCurrent)?.name || yearRows[0]?.name || ''
                if (!isEdit && currentYear) {
                    setForm((current) => ({
                        ...current,
                        academicYear: current.academicYear || currentYear,
                    }))
                }
                setAllocationsTick((n) => n + 1)
            })
            .catch(() => {
                if (!cancelled) {
                    setClassOptions([])
                    setSectionsByClass({})
                    setCoordinatorOptions([])
                    setAcademicYearOptions([])
                }
            })
            .finally(() => {
                if (!cancelled) setOptionsLoading(false)
            })
        return () => { cancelled = true }
    }, [isEdit])

    useEffect(() => {
        if (!isEdit) {
            setRecordLoading(false)
            return undefined
        }
        let cancelled = false
        setRecordLoading(true)
        const load = async () => {
            let record = getExamTimetableById(editId)
            if (!record && api) {
                try {
                    const row = await getExamApi(editId)
                    record = mapExamApiToTimetableRecord(row)
                } catch {
                    record = null
                }
            }
            if (cancelled) return
            if (!record) {
                setErrors(['Examination timetable not found.'])
                setRecordLoading(false)
                return
            }
            const nextForm = examRecordToForm(record)
            if (nextForm.academicYear) {
                setAcademicYearOptions((years) => (
                    years.some((y) => y.name === nextForm.academicYear)
                        ? years
                        : [{ id: nextForm.academicYear, name: nextForm.academicYear, isCurrent: false }, ...years]
                ))
            }
            setForm(nextForm)
            setRecordLoading(false)
        }
        load()
        return () => { cancelled = true }
    }, [isEdit, editId, api])

    useEffect(() => {
        const onAllocationsUpdated = () => setAllocationsTick((n) => n + 1)
        window.addEventListener(TEACHER_ALLOCATIONS_UPDATED_EVENT, onAllocationsUpdated)
        return () => window.removeEventListener(TEACHER_ALLOCATIONS_UPDATED_EVENT, onAllocationsUpdated)
    }, [])

    // When class + coordinator list are ready, auto-pick grade in-charge if none selected.
    useEffect(() => {
        if (!form.className || !coordinatorOptions.length) return
        if (form.coordinatorId || form.coordinatorEmail) return
        const inCharge = findCoordinatorForClass(form.className, coordinatorOptions)
        if (!inCharge) return
        setForm((current) => ({
            ...current,
            coordinatorId: inCharge.id || '',
            coordinatorName: inCharge.name || '',
            coordinatorEmail: inCharge.email || '',
            teacherName: inCharge.name || '',
        }))
    }, [form.className, form.coordinatorId, form.coordinatorEmail, coordinatorOptions])

    const sectionOptions = useMemo(() => {
        if (!form.className) return []
        return sectionsByClass[form.className] || []
    }, [form.className, sectionsByClass])

    const classSubjectOptions = useMemo(
        () => getSubjectsForClass(form.className, form.sections),
        // allocationsTick forces refresh after hydrate / allocation edits
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [form.className, form.sections, allocationsTick],
    )

    const coordinatorSelectOptions = useMemo(
        () => coordinatorOptions.map((row) => ({
            value: row.id || row.email || row.name,
            label: row.email ? `${row.name} (${row.email})` : row.name,
        })),
        [coordinatorOptions],
    )

    const applyCoordinator = (coordinator) => ({
        coordinatorId: coordinator?.id || '',
        coordinatorName: coordinator?.name || '',
        coordinatorEmail: coordinator?.email || '',
        teacherName: coordinator?.name || '',
    })

    const scrubTimelineSubjects = (timelines, allowedSubjects) => {
        const allowed = new Set(allowedSubjects)
        return timelines.map((row) => (
            row.subject && !allowed.has(row.subject)
                ? { ...row, subject: '' }
                : row
        ))
    }

    const updateField = (key, value) => {
        setForm((current) => {
            if (key === 'className') {
                const nextSubjects = getSubjectsForClass(value, [])
                const inCharge = findCoordinatorForClass(value, coordinatorOptions)
                return {
                    ...current,
                    className: value,
                    sections: [],
                    timelines: scrubTimelineSubjects(current.timelines, nextSubjects),
                    ...applyCoordinator(inCharge),
                }
            }
            if (key === 'sections') {
                const nextSubjects = getSubjectsForClass(current.className, value)
                return {
                    ...current,
                    sections: value,
                    timelines: scrubTimelineSubjects(current.timelines, nextSubjects),
                }
            }
            if (key === 'coordinatorId') {
                const selected = coordinatorOptions.find(
                    (row) => String(row.id || row.email || row.name) === String(value),
                )
                return { ...current, ...applyCoordinator(selected) }
            }
            return { ...current, [key]: value }
        })
    }

    const validate = () => {
        const nextErrors = []
        if (!form.examName) nextErrors.push('Exam name is required.')
        if (!form.examType) nextErrors.push('Exam type is required.')
        if (!form.academicYear) nextErrors.push('Academic year is required.')
        if (!form.className) nextErrors.push('Class is required.')
        if (!form.sections?.length) nextErrors.push('Select at least one section (or All).')
        if (!form.coordinatorId && !form.coordinatorEmail) {
            nextErrors.push('Select the grade coordinator who will forward this timetable.')
        }
        if (!form.startDate) nextErrors.push('Start date is required.')
        if (!form.endDate) nextErrors.push('End date is required.')
        if (!form.timelines.some((row) => row.day && row.subject && row.startTime && row.endTime)) {
            nextErrors.push('Add at least one complete timeline row (day, subject, start and end time).')
        }
        setErrors(nextErrors)
        return nextErrors.length === 0
    }

    const handleSubmit = async () => {
        if (!validate()) return
        if (isEdit) {
            // Campus UUID exams: PUT /exams/{id} updates the record and reopens approval.
            if (api && /^[0-9a-f-]{36}$/i.test(String(editId))) {
                setSaving(true)
                setErrors([])
                try {
                    const updated = await updateExamApi(editId, {
                        name: form.examName,
                        examType: form.examType || 'MIDTERM',
                        className: form.className,
                        academicYear: form.academicYear || '',
                        startDate: toIsoDate(form.startDate),
                        endDate: toIsoDate(form.endDate),
                    })
                    updateExamTimetable(editId, {
                        ...form,
                        examId: String(editId),
                        availableSections: sectionOptions,
                        approvalId: updated?.approvalId || null,
                        approvalStatus: 'Pending',
                        status: 'Draft',
                        distributionStatus: '',
                        resetApproval: true,
                        source: 'api',
                    })
                    navigate(listPath)
                } catch (err) {
                    setErrors([err?.message || 'Could not update exam on campus API.'])
                } finally {
                    setSaving(false)
                }
                return
            }
            updateExamTimetable(editId, {
                ...form,
                availableSections: sectionOptions,
            })
            navigate(listPath)
            return
        }
        if (!api) {
            addExamTimetable({
                ...form,
                availableSections: sectionOptions,
            })
            navigate(listPath)
            return
        }
        setSaving(true)
        setErrors([])
        try {
            const created = await createExamApi({
                name: form.examName,
                examType: form.examType || 'MIDTERM',
                className: form.className,
                academicYear: form.academicYear || '',
                startDate: toIsoDate(form.startDate),
                endDate: toIsoDate(form.endDate),
            })
            if (created?.id) {
                const submitted = await submitExamApi(created.id)
                // Keep local timelines / sections alongside the campus exam id.
                updateExamTimetable(created.id, {
                    ...form,
                    examId: String(created.id),
                    availableSections: sectionOptions,
                    approvalId: submitted?.approvalId || created.approvalId || null,
                    source: 'api',
                })
            }
            navigate(listPath)
        } catch (err) {
            setErrors([err?.message || 'Could not save exam to campus API.'])
        } finally {
            setSaving(false)
        }
    }

    return (
        <section>
            <div className='bg-white rounded-2xl shadow-md p-4 space-y-8'>
                <div>
                    <h2 className='text-xl font-semibold text-black'>
                        {isEdit ? 'Edit Examination Timetable' : 'Create Examination Timetable'}
                    </h2>
                    <p className='text-sm text-[#667085] mt-1'>
                        {isEdit
                            ? 'Principal or Director can edit. Saving returns the timetable to Pending for Principal or Director approval.'
                            : api
                              ? 'Creates a campus exam (POST /exams) and submits it for Principal or Director approval. Subjects come from teacher allocations for the selected class.'
                              : 'Enter exam details once, then add multiple exam timelines using Add More. Pick All or multiple sections to apply the same dates and subjects.'}
                    </p>
                    {(optionsLoading || recordLoading) && (
                        <p className='text-sm text-[#667085] mt-2'>
                            {recordLoading ? 'Loading timetable…' : 'Loading class and teacher options…'}
                        </p>
                    )}
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
                    <h3 className='text-lg font-semibold text-black mb-4'>Examination Information</h3>
                    <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6'>
                        <div className='flex flex-col gap-y-2'>
                            <label htmlFor='exam-id' className='text-base font-medium text-[#1E1E1E]'>Exam ID:</label>
                            <input type='text' id='exam-id' value={form.examId} readOnly className={inputClass} />
                        </div>
                        <div className='flex flex-col gap-y-2'>
                            <label htmlFor='exam-name' className='text-base font-medium text-[#1E1E1E]'>Exam Name:</label>
                            <input
                                type='text'
                                id='exam-name'
                                value={form.examName}
                                onChange={(e) => updateField('examName', e.target.value)}
                                placeholder='Mid Term Examination'
                                className={inputClass}
                            />
                        </div>
                        <div className='flex flex-col gap-y-2'>
                            <label htmlFor='exam-type' className='text-base font-medium text-[#1E1E1E]'>Exam Type:</label>
                            <ScrollableSelect
                                id='exam-type'
                                value={form.examType}
                                onChange={(value) => updateField('examType', value)}
                                options={EXAM_TYPE_OPTIONS.map((item) => ({ value: item.code, label: item.label }))}
                                placeholder='Select exam type'
                                listClassName='max-h-48'
                            />
                        </div>
                        <div className='flex flex-col gap-y-2'>
                            <label htmlFor='academic-year' className='text-base font-medium text-[#1E1E1E]'>Academic Year:</label>
                            <ScrollableSelect
                                id='academic-year'
                                value={form.academicYear}
                                onChange={(value) => updateField('academicYear', value)}
                                options={academicYearOptions.map((item) => ({
                                    value: item.name,
                                    label: item.isCurrent ? `${item.name} (Current)` : item.name,
                                }))}
                                placeholder={
                                    optionsLoading
                                        ? 'Loading…'
                                        : academicYearOptions.length
                                          ? 'Select academic year'
                                          : 'No academic years — add under Admin → Class'
                                }
                                disabled={optionsLoading || !academicYearOptions.length}
                                listClassName='max-h-48'
                            />
                        </div>
                        <div className='flex flex-col gap-y-2'>
                            <label htmlFor='class' className='text-base font-medium text-[#1E1E1E]'>Class:</label>
                            <ScrollableSelect
                                id='class'
                                value={form.className}
                                onChange={(value) => updateField('className', value)}
                                options={classOptions}
                                placeholder={optionsLoading ? 'Loading…' : 'Select class'}
                                disabled={optionsLoading}
                                listClassName='max-h-48'
                            />
                        </div>
                        <div className='flex flex-col gap-y-2'>
                            <label htmlFor='section' className='text-base font-medium text-[#1E1E1E]'>Section:</label>
                            <ScrollableSelect
                                id='section'
                                multiple
                                showAllOption
                                allLabel='All'
                                value={form.sections}
                                onChange={(value) => updateField('sections', value)}
                                options={sectionOptions}
                                placeholder={
                                    !form.className
                                        ? 'Select class first'
                                        : sectionOptions.length
                                          ? 'Select section(s) or All'
                                          : 'No sections for this class'
                                }
                                disabled={!form.className || !sectionOptions.length}
                                listClassName='max-h-48'
                            />
                            <p className='text-xs text-[#667085]'>
                                Choose All or multiple sections to reuse the same exam dates and subjects.
                            </p>
                        </div>
                        <div className='flex flex-col gap-y-2'>
                            <label htmlFor='coordinator' className='text-base font-medium text-[#1E1E1E]'>Coordinator:</label>
                            <ScrollableSelect
                                id='coordinator'
                                value={form.coordinatorId || form.coordinatorEmail || ''}
                                onChange={(value) => updateField('coordinatorId', value)}
                                options={coordinatorSelectOptions}
                                placeholder={
                                    optionsLoading
                                        ? 'Loading…'
                                        : form.className
                                          ? 'Select grade coordinator'
                                          : 'Select class first'
                                }
                                disabled={optionsLoading || !coordinatorOptions.length}
                                listClassName='max-h-48'
                            />
                            <p className='text-xs text-[#667085]'>
                                After approval, this coordinator forwards the timetable to teachers and students of the grade.
                            </p>
                            {!optionsLoading && coordinatorOptions.length === 0 && (
                                <p className='text-xs text-[#B54708]'>No coordinators found in the campus directory.</p>
                            )}
                        </div>
                        <div className='flex flex-col gap-y-2'>
                            <label htmlFor='status' className='text-base font-medium text-[#1E1E1E]'>Status:</label>
                            <ScrollableSelect
                                id='status'
                                value={form.status}
                                onChange={(value) => updateField('status', value)}
                                options={EXAM_STATUSES}
                                placeholder='Select status'
                                listClassName='max-h-48'
                            />
                        </div>
                        <div className='flex flex-col gap-y-2'>
                            <label className='text-base font-medium text-[#1E1E1E]'>Start Date:</label>
                            <div className='relative w-full'>
                                <DatePicker
                                    selected={form.startDate}
                                    onChange={(date) => updateField('startDate', date)}
                                    isClearable
                                    showMonthYearDropdown
                                    scrollableMonthYearDropdown
                                    dateFormat='dd/MM/yyyy'
                                    className='w-full text-sm text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-3 py-3 pr-10 focus:outline-none'
                                />
                                <Calendar size={16} className='absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] pointer-events-none' />
                            </div>
                        </div>
                        <div className='flex flex-col gap-y-2'>
                            <label className='text-base font-medium text-[#1E1E1E]'>End Date:</label>
                            <div className='relative w-full'>
                                <DatePicker
                                    selected={form.endDate}
                                    onChange={(date) => updateField('endDate', date)}
                                    isClearable
                                    showMonthYearDropdown
                                    scrollableMonthYearDropdown
                                    dateFormat='dd/MM/yyyy'
                                    className='w-full text-sm text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-3 py-3 pr-10 focus:outline-none'
                                />
                                <Calendar size={16} className='absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] pointer-events-none' />
                            </div>
                        </div>
                    </div>
                </div>

                <ExamTimelineEditor
                    timelines={form.timelines}
                    onChange={(timelines) => updateField('timelines', timelines)}
                    subjects={classSubjectOptions}
                    classSelected={Boolean(form.className)}
                />
            </div>

            <div className='flex sm:justify-end justify-center gap-x-4 mt-6'>
                <button
                    type='button'
                    onClick={() => navigate(listPath)}
                    className='bg-white text-[#515DEF] text-sm text-center px-12 py-2 rounded-md border border-[#515DEF] hover:bg-[#515DEF] hover:text-white hover:border-[#515DEF] transition-all duration-200 cursor-pointer md:w-auto w-full'
                >
                    Discard Changes
                </button>
                <button
                    type='button'
                    disabled={saving || recordLoading}
                    onClick={handleSubmit}
                    className='bg-[#515DEF] text-white text-sm text-center px-12 py-2 rounded-md border border-[#515DEF] hover:opacity-90 transition-all duration-200 cursor-pointer md:w-auto w-full disabled:opacity-60'
                >
                    {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Save Timetable'}
                </button>
            </div>
        </section>
    )
}

export default CreateExaminationTimetable
