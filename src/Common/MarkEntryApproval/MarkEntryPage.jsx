import React, { useEffect, useMemo, useState } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { Calendar, Download, Upload } from 'lucide-react'
import ExportModal from '../CommonComponents/ExportModal'
import EntryClosureGate from '../demoDomain/EntryClosureGate'
import { entryBlocked } from '../demoDomain/governance'
import IncompleteMarksModal from '../../Pages/Teacher/StudentEvaluation/MarkEntry/Components/IncompleteMarksModal'
import SubmitMarksConfirmModal from '../../Pages/Teacher/StudentEvaluation/MarkEntry/Components/SubmitMarksConfirmModal'
import { hydrateEnrolledStudentsFromApi } from '../StudentDatabase/enrolledStudentsData'
import { useTeacherAssignments } from '../Teacher/useTeacherAssignments'
import {
    ACADEMIC_YEARS,
    EXAM_OPTIONS,
    STATUS_FILTERS,
    buildContextKey,
    classesForExamName,
    createEmptyEntries,
    examMatchesAcademicYear,
    filterStudentsForTable,
    findExamForNameAndClass,
    formatClassLabel,
    getEntryWithComputed,
    getExamMaxMarks,
    getMarkEntryStats,
    getSessionStatusColor,
    getSessionStatusLabel,
    getStudentsForMarkEntry,
    isSessionLocked,
    loadMarkEntrySession,
    resultBadgeColor,
    saveMarkEntrySession,
    submitMarkEntrySession,
    uniqueExamNames,
} from './markEntryApprovalData'
import {
    canUseExamsApi,
    createMarksBatchApi,
    getMarksBatchApi,
    listMarksBatchesApi,
    mapMarksBatchFromApi,
    submitMarksBatchApi,
    updateMarksBatchEntriesApi,
} from '../../services/examsApi'
import { isApiStudentsEnabled } from '../../services/apiClient'
import { listStudentsApi, mapStudentListFromApi } from '../../services/studentsApi'
import { loadAcademicYearOptions } from '../../Pages/Principal/ClassTimetable/classTimetableData'
import {
    DISTRIBUTION,
    loadMergedExamRecords,
} from '../ExamSchedule/examScheduleData'
import { getTeacherSubjectOptions } from '../Teacher/teacherAssignedClasses'
import { useAuth } from '../../context/AuthContext'

const parseApiDate = (value) => {
    if (!value) return null
    const iso = String(value).slice(0, 10)
    const [year, month, day] = iso.split('-').map(Number)
    if (!year || !month || !day) return null
    return new Date(year, month - 1, day)
}

const inputClass =
    'text-sm font-normal text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-2 py-2.5 w-full bg-white'

const formatDate = (date) => {
    if (!date) return ''
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
}

const getSubmitMessage = (session) => {
    if (!session || session.status !== 'submitted') return ''
    if (session.approvalStatus === 'Pending') {
        return 'Marks submitted to the Director for review. They will be visible to students only after approval.'
    }
    if (session.approvalStatus === 'Approved') {
        return 'Marks approved by the Director and published to the student portal.'
    }
    if (session.approvalStatus === 'Rejected') {
        return session.rejectionReason
            ? `Marks rejected by the Director: ${session.rejectionReason}. Please revise and resubmit.`
            : 'Marks rejected by the Director. Please revise and resubmit.'
    }
    return 'Marks have already been submitted for this examination.'
}

const mapBatchStatus = (batch) => {
    const raw = String(batch?.status || 'draft').toLowerCase()
    if (raw.includes('draft') || !batch) {
        return { status: 'draft', approvalStatus: null }
    }
    if (raw.includes('publish') || raw === 'approved') {
        return { status: 'submitted', approvalStatus: 'Approved' }
    }
    if (raw.includes('reject')) {
        return { status: 'submitted', approvalStatus: 'Rejected' }
    }
    return { status: 'submitted', approvalStatus: 'Pending' }
}

const entriesPayloadFromSession = (session) =>
    session.students
        .map((student) => {
            const entry = session.entries[student.id] || {}
            const absent = Boolean(entry.absent)
            const hasMarks = entry.obtainedMarks !== null && entry.obtainedMarks !== undefined && entry.obtainedMarks !== ''
            if (!absent && !hasMarks) return null
            return {
                studentId: student.id,
                marks: absent ? null : Number(entry.obtainedMarks),
                absent,
                remarks: entry.remarks || '',
            }
        })
        .filter(Boolean)

const isApprovedExam = (row) => {
    const approval = String(row?.approvalStatus || '').toLowerCase()
    if (approval === 'approved') return true
    const status = String(row?.status || '').toLowerCase()
    return status === 'approved' || status === 'published'
}

/** Approved (+ forwarded when distribution is tracked) exams for mark entry. */
const isMarkEntryExam = (row) => {
    if (!isApprovedExam(row)) return false
    const dist = row.distributionStatus || DISTRIBUTION.NONE
    if (!dist) return true
    return dist === DISTRIBUTION.FORWARDED
}

const MarkEntryPage = ({ submittedByRole = 'Teacher' }) => {
    const api = canUseExamsApi()
    const { email, name } = useAuth()
    const assignments = useTeacherAssignments()
    const [academicYearOptions, setAcademicYearOptions] = useState(
        () => ACADEMIC_YEARS.map((name) => ({ id: name, name, isCurrent: false })),
    )
    const [academicYear, setAcademicYear] = useState(ACADEMIC_YEARS[0])
    const [exam, setExam] = useState('')
    const [examId, setExamId] = useState('')
    const [campusExams, setCampusExams] = useState([])
    const [className, setClassName] = useState('')
    const [section, setSection] = useState('')
    const [subject, setSubject] = useState('')
    const [examDate, setExamDate] = useState(null)

    const yearExams = useMemo(
        () => campusExams.filter((row) => (
            isMarkEntryExam(row) && examMatchesAcademicYear(row, academicYear)
        )),
        [campusExams, academicYear],
    )

    const examNameOptions = useMemo(() => uniqueExamNames(yearExams), [yearExams])

    const classOptions = useMemo(() => {
        if (!api) return assignments.classes
        if (!exam) return []
        const examClasses = classesForExamName(yearExams, exam)
        const teacherSet = new Set(
            (assignments.classes || []).map((item) => String(item).trim().toLowerCase()),
        )
        // Prefer intersection with teacher allocations; if none assigned yet, show exam classes.
        const scoped = teacherSet.size
            ? examClasses.filter((item) => teacherSet.has(String(item).trim().toLowerCase()))
            : examClasses
        return scoped.length ? scoped : examClasses
    }, [api, exam, yearExams, assignments.classes])

    const sectionOptions = assignments.sectionsFor(className)
    const subjectOptions = useMemo(() => {
        if (!className) return []
        const normalize = (value) => String(value || '').trim().toLowerCase().replace(/^grade\s+/, '')
        const forClass = [...new Set(
            (assignments.assignments || [])
                .filter((row) => normalize(row.className) === normalize(className))
                .map((row) => row.subject)
                .filter(Boolean),
        )].sort((a, b) => a.localeCompare(b))
        if (forClass.length) return forClass
        return getTeacherSubjectOptions(email)
    }, [className, email, assignments.assignments])

    const catalogEmpty = assignments.ready && !assignments.assignments.length

    const [session, setSession] = useState(null)
    const [loaded, setLoaded] = useState(false)
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('All')
    const [exportModal, setExportModal] = useState(false)
    const [incompleteModal, setIncompleteModal] = useState(false)
    const [submitModal, setSubmitModal] = useState(false)
    const [saveMessage, setSaveMessage] = useState('')
    const [submitMessage, setSubmitMessage] = useState('')

    useEffect(() => {
        let cancelled = false
        loadAcademicYearOptions()
            .then((rows) => {
                if (cancelled || !rows?.length) return
                setAcademicYearOptions(rows)
                setAcademicYear((current) => {
                    const currentMatch = rows.find((row) => row.name === current)
                    if (currentMatch) return currentMatch.name
                    const preferred = rows.find((row) => row.isCurrent) || rows[0]
                    return preferred?.name || current
                })
            })
            .catch(() => {})
        return () => { cancelled = true }
    }, [])

    useEffect(() => {
        if (!api) return undefined
        let cancelled = false
        loadMergedExamRecords()
            .then((rows) => {
                if (cancelled) return
                setCampusExams(Array.isArray(rows) ? rows : [])
            })
            .catch(() => {
                if (!cancelled) setCampusExams([])
            })
        return () => {
            cancelled = true
        }
    }, [api])

    useEffect(() => {
        if (!isApiStudentsEnabled()) return undefined
        hydrateEnrolledStudentsFromApi().catch(() => {})
        return undefined
    }, [])

    // Keep examId in sync with selected exam name + class (same name, many grade rows).
    useEffect(() => {
        if (!api) return
        if (!exam || !className) {
            setExamId('')
            return
        }
        const match = findExamForNameAndClass(yearExams, exam, className)
        setExamId(match ? String(match.id) : '')
        if (match?.startDate) {
            const nextDate = parseApiDate(match.startDate)
            if (nextDate) setExamDate(nextDate)
        }
    }, [api, exam, className, yearExams])

    const stats = useMemo(() => {
        if (!session) return null
        return getMarkEntryStats(session.students, session.entries, session.maxMarks)
    }, [session])

    const filteredStudents = useMemo(() => {
        if (!session) return []
        return filterStudentsForTable(session.students, session.entries, { search, statusFilter })
    }, [session, search, statusFilter])

    const isLocked = isSessionLocked(session)

    const handleLoadStudents = async () => {
        if (!className || !section || !subject) {
            setSaveMessage('Select class, section, and subject before entering marks.')
            setLoaded(false)
            setSession(null)
            return
        }
        if (assignments.ready && !assignments.assignments.length) {
            setSaveMessage(assignments.emptyReason || 'No classes assigned yet.')
            return
        }

        if (!api) {
            if (isApiStudentsEnabled()) await hydrateEnrolledStudentsFromApi().catch(() => {})
            let students = getStudentsForMarkEntry(className, section)
            if (assignments.assignments.length) {
                students = students.filter((student) => assignments.studentInScope(student))
            }
            const nextSession = {
                ...loadMarkEntrySession({
                    academicYear,
                    exam: exam || EXAM_OPTIONS[0]?.name || 'Exam',
                    className,
                    section,
                    subject,
                    examDate: formatDate(examDate),
                    maxMarks: getExamMaxMarks(exam),
                }),
                students,
                entries: createEmptyEntries(students),
            }
            setSession(nextSession)
            setLoaded(true)
            setSearch('')
            setStatusFilter('All')
            setSaveMessage(
                nextSession.students.length === 0
                    ? 'No enrolled students in this class and section yet.'
                    : '',
            )
            setSubmitMessage(getSubmitMessage(nextSession))
            return
        }

        if (!examId) {
            setSaveMessage('Select a campus exam before entering marks.')
            return
        }

        setLoading(true)
        setSaveMessage('')
        try {
            const [studentRows, batches] = await Promise.all([
                listStudentsApi({ className }),
                listMarksBatchesApi({ examId, mine: true }),
            ])
            let students = studentRows
                .map(mapStudentListFromApi)
                .filter((row) => !row.section || row.section === section || row.section === '—')
                .map((row) => ({
                    ...row,
                    rollNumber: row.rollNumber || row.admissionNumber || '',
                    section: row.section || section,
                }))
            if (assignments.assignments.length) {
                students = students.filter((student) => assignments.studentInScope(student))
            }
            const match = batches
                .map(mapMarksBatchFromApi)
                .find((batch) => batch.subject === subject && (!batch.section || batch.section === section))
            let batchDetail = match
            if (match?.id) {
                batchDetail = mapMarksBatchFromApi(await getMarksBatchApi(match.id))
            }
            const selectedExam = campusExams.find((item) => String(item.id) === String(examId))
            const context = {
                academicYear,
                exam: exam || selectedExam?.examName || selectedExam?.name || 'Exam',
                examId,
                className,
                section,
                subject,
                examDate: formatDate(examDate || parseApiDate(selectedExam?.startDate)),
                maxMarks: Number(batchDetail?.maxMarks) || getExamMaxMarks(exam) || 100,
            }
            const entries = createEmptyEntries(students)
            if (Array.isArray(batchDetail?.entries)) {
                batchDetail.entries.forEach((entry) => {
                    entries[String(entry.studentId)] = {
                        obtainedMarks: entry.marks ?? null,
                        absent: Boolean(entry.absent),
                        remarks: entry.remarks || '',
                    }
                })
            }
            const statusBits = mapBatchStatus(batchDetail)
            const nextSession = {
                contextKey: buildContextKey(context),
                ...context,
                batchId: batchDetail?.id || null,
                ...statusBits,
                entries,
                students,
                source: 'api',
            }
            setSession(nextSession)
            setLoaded(true)
            setSearch('')
            setStatusFilter('All')
            setSaveMessage(students.length === 0 ? 'No students found for this class in your assigned scope.' : '')
            setSubmitMessage(getSubmitMessage(nextSession))
        } catch (err) {
            setLoaded(false)
            setSession(null)
            setSaveMessage(err?.message || 'Could not load mark entry from campus API.')
        } finally {
            setLoading(false)
        }
    }

    const updateEntry = (studentId, patch) => {
        setSession((current) => {
            if (!current) return current
            const existing = current.entries[studentId] ?? { obtainedMarks: null, absent: false, remarks: '' }
            let nextEntry = { ...existing, ...patch }

            if (patch.absent) {
                nextEntry = { ...nextEntry, obtainedMarks: null }
            }

            if (patch.obtainedMarks !== undefined && patch.obtainedMarks !== null && patch.obtainedMarks !== '') {
                nextEntry = { ...nextEntry, absent: false }
            }

            return {
                ...current,
                entries: {
                    ...current.entries,
                    [studentId]: nextEntry,
                },
            }
        })
        setSaveMessage('')
        setSubmitMessage('')
    }

    const handleSaveDraft = async () => {
        if (!api && entryBlocked('Mark Entry', submittedByRole)) return
        if (!session || isLocked) return
        if (!api || session.source !== 'api') {
            const saved = saveMarkEntrySession({ ...session, status: 'draft', approvalStatus: null })
            setSession(saved)
            setSaveMessage('Draft saved successfully. You can continue entering marks later.')
            return
        }
        const entries = entriesPayloadFromSession(session)
        if (entries.length === 0) {
            setSaveMessage('Enter marks or mark absent for at least one student before saving draft.')
            return
        }
        try {
            let batch
            if (session.batchId) {
                batch = mapMarksBatchFromApi(await updateMarksBatchEntriesApi(session.batchId, entries))
            } else {
                batch = mapMarksBatchFromApi(
                    await createMarksBatchApi({
                        examId: session.examId,
                        subject: session.subject,
                        section: session.section,
                        maxMarks: session.maxMarks,
                        entries,
                    }),
                )
            }
            setSession((current) => ({
                ...current,
                batchId: batch.id,
                status: 'draft',
                approvalStatus: null,
                maxMarks: batch.maxMarks ?? current.maxMarks,
            }))
            setSaveMessage('Draft saved to campus marks batch. You can continue entering marks later.')
            setSubmitMessage('')
        } catch (err) {
            setSaveMessage(err?.message || 'Could not save draft to campus API.')
        }
    }

    const handleSubmitClick = () => {
        if (!session || !stats || isLocked) return
        if (stats.pending > 0) {
            setIncompleteModal(true)
            return
        }
        setSubmitModal(true)
    }

    const handleConfirmSubmit = async () => {
        if (!api && entryBlocked('Mark Entry', submittedByRole)) return
        if (!session) return
        if (!api || session.source !== 'api') {
            const submitted = submitMarkEntrySession(session, { submittedByRole })
            setSession(submitted)
            setSubmitModal(false)
            setSubmitMessage(getSubmitMessage(submitted))
            setSaveMessage('')
            return
        }
        const entries = entriesPayloadFromSession(session)
        try {
            let batchId = session.batchId
            if (!batchId) {
                const created = mapMarksBatchFromApi(
                    await createMarksBatchApi({
                        examId: session.examId,
                        subject: session.subject,
                        section: session.section,
                        maxMarks: session.maxMarks,
                        entries,
                    }),
                )
                batchId = created.id
            } else {
                await updateMarksBatchEntriesApi(batchId, entries)
            }
            const submitted = mapMarksBatchFromApi(await submitMarksBatchApi(batchId))
            const statusBits = mapBatchStatus(submitted)
            setSession((current) => ({
                ...current,
                batchId,
                approvalId: submitted.approvalId || current.approvalId || null,
                ...statusBits,
                submittedByRole,
                submittedByName: submitted.teacherName || name || email || submittedByRole,
                teacherEmail: submitted.teacherEmail || email || '',
                submittedAt: new Date().toISOString(),
            }))
            setSubmitModal(false)
            setSubmitMessage('Marks submitted for Director approval via campus API.')
            setSaveMessage('')
        } catch (err) {
            setSubmitModal(false)
            setSaveMessage(err?.message || 'Could not submit marks batch.')
        }
    }

    return (
        <section className='space-y-6'>
            {!api ? <EntryClosureGate moduleName='Mark Entry' actor={submittedByRole} /> : null}
            <div>
                <h1 className='text-2xl font-semibold text-black'>Mark Entry</h1>
                <p className='text-sm text-[#667085] mt-1'>
                    Enter examination marks for students in your assigned classes. Submitted marks go to the Director for approval before publishing.
                </p>
            </div>

            {catalogEmpty && (
                <div className='bg-white rounded-2xl shadow-md p-6 border border-[#EDEEF5]'>
                    <h2 className='text-lg font-semibold text-[#0C1E5B]'>No classes assigned yet</h2>
                    <p className='text-sm text-[#667085] mt-2'>
                        {assignments.emptyReason || 'Ask Principal to allocate you under Teacher Allocation before using Mark Entry.'}
                    </p>
                </div>
            )}

            {api && campusExams.length === 0 && (
                <div className='rounded-xl border border-[#FF980033] bg-[#FFF8E1] px-4 py-3 text-sm text-[#E65100]'>
                    No campus exams are scheduled yet. Create an exam under Student Evaluation first, then return here to enter marks.
                </div>
            )}

            {api && campusExams.length > 0 && yearExams.length === 0 && (
                <div className='rounded-xl border border-[#FF980033] bg-[#FFF8E1] px-4 py-3 text-sm text-[#E65100]'>
                    No approved exams for {academicYear} yet. Pick another academic year, or wait until the coordinator forwards the timetable.
                </div>
            )}

            {saveMessage && !loaded && (
                <div className='rounded-xl border border-[#FF980033] bg-[#FFF8E1] px-4 py-3 text-sm text-[#E65100]'>
                    {saveMessage}
                </div>
            )}

            <div className='bg-white rounded-2xl shadow-md p-4'>
                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='academic-year' className='text-base font-medium text-[#808080]'>Academic Year</label>
                        <select
                            id='academic-year'
                            value={academicYear}
                            onChange={(e) => {
                                setAcademicYear(e.target.value)
                                setExam('')
                                setExamId('')
                                setClassName('')
                                setSection('')
                                setSubject('')
                                setExamDate(null)
                                setLoaded(false)
                                setSession(null)
                            }}
                            className={inputClass}
                        >
                            {academicYearOptions.map((item) => (
                                <option key={item.id || item.name} value={item.name}>{item.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='exam' className='text-base font-medium text-[#808080]'>Exam</label>
                        {api ? (
                            <select
                                id='exam'
                                value={exam}
                                onChange={(e) => {
                                    const nextName = e.target.value
                                    setExam(nextName)
                                    setExamId('')
                                    setClassName('')
                                    setSection('')
                                    setSubject('')
                                    setExamDate(null)
                                    setLoaded(false)
                                    setSession(null)
                                    if (nextName) {
                                        const first = yearExams.find((row) => (
                                            String(row.examName || row.name || '').trim().toLowerCase()
                                            === nextName.trim().toLowerCase()
                                        ))
                                        const nextDate = parseApiDate(first?.startDate)
                                        if (nextDate) setExamDate(nextDate)
                                    }
                                }}
                                className={inputClass}
                                disabled={!academicYear || examNameOptions.length === 0}
                            >
                                <option value=''>
                                    {examNameOptions.length ? 'Select exam' : 'No exams for this year'}
                                </option>
                                {examNameOptions.map((name) => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                        ) : (
                            <select id='exam' value={exam} onChange={(e) => setExam(e.target.value)} className={inputClass}>
                                <option value=''>Select exam</option>
                                {EXAM_OPTIONS.map((item) => (
                                    <option key={item.name} value={item.name}>{item.name}</option>
                                ))}
                            </select>
                        )}
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='class' className='text-base font-medium text-[#808080]'>Class</label>
                        <select
                            id='class'
                            value={className}
                            onChange={(e) => {
                                setClassName(e.target.value)
                                setSection('')
                                setSubject('')
                                setLoaded(false)
                                setSession(null)
                            }}
                            className={inputClass}
                            disabled={api && !exam}
                        >
                            <option value=''>
                                {api && exam && classOptions.length === 0
                                    ? 'No classes for this exam'
                                    : 'Select class'}
                            </option>
                            {classOptions.map((item) => (
                                <option key={item} value={item}>{formatClassLabel(item)}</option>
                            ))}
                        </select>
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='section' className='text-base font-medium text-[#808080]'>Section</label>
                        <select
                            id='section'
                            value={section}
                            onChange={(e) => setSection(e.target.value)}
                            className={inputClass}
                            disabled={!className}
                        >
                            <option value=''>Select section</option>
                            {sectionOptions.map((item) => (
                                <option key={item} value={item}>{item}</option>
                            ))}
                        </select>
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label htmlFor='subject' className='text-base font-medium text-[#808080]'>Subject</label>
                        <select
                            id='subject'
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className={inputClass}
                            disabled={!className}
                        >
                            <option value=''>Select subject</option>
                            {subjectOptions.map((item) => (
                                <option key={item} value={item}>{item}</option>
                            ))}
                        </select>
                    </div>
                    <div className='flex flex-col gap-y-2'>
                        <label className='text-base font-medium text-[#808080]'>Exam Date</label>
                        <div className='relative w-full'>
                            <DatePicker
                                selected={examDate}
                                onChange={(date) => setExamDate(date)}
                                dateFormat='dd/MM/yyyy'
                                placeholderText='From selected exam'
                                isClearable
                                disabled={isLocked}
                                className='w-full text-sm text-[#808080] border border-[#D9D9D9] rounded-md px-3 py-2.5 pr-10 focus:outline-none disabled:bg-[#F2F4F7]'
                            />
                            <Calendar size={16} className='absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] pointer-events-none' />
                        </div>
                    </div>
                    <div className='flex items-end'>
                        <button
                            type='button'
                            disabled={loading}
                            onClick={handleLoadStudents}
                            className='w-full bg-[#515DEF] text-white text-sm px-6 py-2.5 rounded-md border border-[#515DEF] hover:opacity-90 transition-all duration-200 cursor-pointer disabled:opacity-60'
                        >
                            {loading ? 'Loading…' : 'Load Students'}
                        </button>
                    </div>
                </div>
            </div>

            {loaded && session && (
                <>
                    <div className='bg-white rounded-2xl shadow-md p-4'>
                        <h2 className='text-xl font-semibold text-black mb-4'>Exam Information</h2>
                        <div className='rounded-xl border border-[#EEF0F6] bg-[#FAFBFD] p-4'>
                            <h3 className='text-lg font-semibold text-[#0C1E5B]'>
                                {/examination$/i.test(String(exam || '').trim()) ? exam : `${exam} Examination`}
                            </h3>
                            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3 mt-4 text-sm'>
                                <p><span className='text-[#808080]'>Academic Year :</span> <span className='text-[#1E1E1E]'>{academicYear}</span></p>
                                <p><span className='text-[#808080]'>Class :</span> <span className='text-[#1E1E1E]'>{formatClassLabel(className)}</span></p>
                                <p><span className='text-[#808080]'>Section :</span> <span className='text-[#1E1E1E]'>{section}</span></p>
                                <p><span className='text-[#808080]'>Subject :</span> <span className='text-[#1E1E1E]'>{subject}</span></p>
                                <p><span className='text-[#808080]'>Maximum Marks :</span> <span className='text-[#1E1E1E]'>{session.maxMarks}</span></p>
                                <p><span className='text-[#808080]'>Exam Date :</span> <span className='text-[#1E1E1E]'>{formatDate(examDate)}</span></p>
                                <p>
                                    <span className='text-[#808080]'>Status :</span>{' '}
                                    <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${getSessionStatusColor(session)}`}>
                                        {getSessionStatusLabel(session)}
                                    </span>
                                </p>
                                {(session.submittedByName || session.submittedByRole) ? (
                                    <p><span className='text-[#808080]'>Submitted By :</span> <span className='text-[#1E1E1E]'>{session.submittedByName || session.submittedByRole}</span></p>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    <div className='bg-white rounded-2xl shadow-md p-4'>
                        <h2 className='text-xl font-semibold text-black mb-4'>Mark Entry Summary</h2>
                        <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4'>
                            {[
                                { label: 'Total Students', value: stats.totalStudents },
                                { label: 'Marks Entered', value: stats.marksEntered },
                                { label: 'Pending', value: stats.pending },
                                { label: 'Absent', value: stats.absent },
                                { label: 'Average Mark', value: stats.averageMark },
                                { label: 'Highest Mark', value: stats.highestMark },
                            ].map((item) => (
                                <div key={item.label} className='rounded-xl border border-[#EEF0F6] bg-[#FAFBFD] p-4 text-center'>
                                    <span className='text-sm text-[#808080]'>{item.label}</span>
                                    <p className='text-2xl font-semibold text-[#0C1E5B] mt-2'>{item.value}</p>
                                </div>
                            ))}
                        </div>
                        <div className='mt-4 rounded-xl border border-[#EEF0F6] bg-[#FAFBFD] p-4 inline-block min-w-[180px]'>
                            <span className='text-sm text-[#808080]'>Lowest Mark</span>
                            <p className='text-2xl font-semibold text-[#0C1E5B] mt-2'>{stats.lowestMark}</p>
                        </div>
                    </div>

                    <div className='bg-white rounded-2xl shadow-md p-4'>
                        <div className='flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-4'>
                            <div className='flex flex-col gap-y-2 flex-1 max-w-md'>
                                <label htmlFor='search-student' className='text-base font-medium text-[#808080]'>Search Student</label>
                                <input
                                    id='search-student'
                                    type='text'
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder='Search by name, roll number, admission number...'
                                    className={inputClass}
                                />
                            </div>
                            <div className='flex flex-col gap-y-2 w-full lg:max-w-xs'>
                                <label htmlFor='status-filter' className='text-base font-medium text-[#808080]'>Status Filter</label>
                                <select id='status-filter' value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputClass}>
                                    {STATUS_FILTERS.map((item) => (
                                        <option key={item} value={item}>{item}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className='relative overflow-x-auto'>
                            <table className='w-full text-sm text-left'>
                                <thead className='text-xs bg-[#EDEEF5] whitespace-nowrap rounded-lg'>
                                    <tr>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-s-lg'>S.No.</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Roll No.</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Student Name</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Admission No.</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Maximum Marks</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Obtained Marks</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Absent</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Grade</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Percentage</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase'>Result</th>
                                        <th className='px-2 py-3.5 text-[#0C1E5B] font-medium uppercase rounded-e-lg'>Teacher Remarks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStudents.length === 0 ? (
                                        <tr>
                                            <td colSpan={11} className='px-2 py-8 text-center text-[#667085]'>
                                                {session.students.length === 0
                                                    ? 'No students in this class yet. Create students under Admin → RBAC → User Creation.'
                                                    : 'No students match the selected filters.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredStudents.map((student, index) => {
                                            const entry = getEntryWithComputed(
                                                session.entries[student.id] ?? { obtainedMarks: null, absent: false, remarks: '' },
                                                session.maxMarks,
                                            )
                                            const rollDisplay = String(student.rollNumber).replace(/^.*-(\d+)$/, '$1').slice(-2)
                                                || String(index + 1).padStart(2, '0')

                                            return (
                                                <tr key={student.id} className='border-b text-[#667085] border-[#f2f4f7] hover:bg-[#f2f4f7]'>
                                                    <td className='px-2 py-3 rounded-s-lg'>{index + 1}</td>
                                                    <td className='px-2 py-3'>{rollDisplay}</td>
                                                    <td className='px-2 py-3 font-medium text-[#1E1E1E]'>{student.name}</td>
                                                    <td className='px-2 py-3'>{student.admissionNumber}</td>
                                                    <td className='px-2 py-3'>{session.maxMarks}</td>
                                                    <td className='px-2 py-3'>
                                                        <input
                                                            type='number'
                                                            min='0'
                                                            max={session.maxMarks}
                                                            disabled={entry.absent || isLocked}
                                                            value={entry.absent ? '' : (entry.obtainedMarks ?? '')}
                                                            placeholder='--'
                                                            onChange={(e) => updateEntry(student.id, { obtainedMarks: e.target.value === '' ? null : e.target.value })}
                                                            className='w-20 text-sm border border-[#D9D9D9] rounded-md px-2 py-1.5 disabled:bg-[#F2F4F7] disabled:text-[#667085]'
                                                        />
                                                    </td>
                                                    <td className='px-2 py-3'>
                                                        <label className='inline-flex items-center gap-2 cursor-pointer'>
                                                            <input
                                                                type='checkbox'
                                                                checked={entry.absent}
                                                                disabled={isLocked}
                                                                onChange={(e) => updateEntry(student.id, { absent: e.target.checked })}
                                                                className='rounded border-[#D9D9D9] text-[#515DEF] focus:ring-[#515DEF]'
                                                            />
                                                            <span className='text-xs'>Absent</span>
                                                        </label>
                                                    </td>
                                                    <td className='px-2 py-3 font-medium text-[#1E1E1E]'>{entry.grade}</td>
                                                    <td className='px-2 py-3'>{entry.displayPercent}</td>
                                                    <td className='px-2 py-3'>
                                                        <span className={`px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${resultBadgeColor[entry.result] ?? resultBadgeColor['—']}`}>
                                                            {entry.result}
                                                        </span>
                                                    </td>
                                                    <td className='px-2 py-3 rounded-e-lg min-w-[180px]'>
                                                        <input
                                                            type='text'
                                                            value={entry.remarks ?? ''}
                                                            disabled={isLocked}
                                                            placeholder='Optional remark...'
                                                            onChange={(e) => updateEntry(student.id, { remarks: e.target.value })}
                                                            className='w-full text-sm border border-[#D9D9D9] rounded-md px-2 py-1.5 disabled:bg-[#F2F4F7]'
                                                        />
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {(saveMessage || submitMessage) && (
                        <div className={`rounded-xl p-4 text-sm ${
                            submitMessage && session?.approvalStatus === 'Rejected'
                                ? 'bg-[#FDF3F4] border border-[#F5D7DA] text-[#980E0F]'
                                : submitMessage
                                    ? 'bg-[#F1FCF2] border border-[#D1E7CC] text-[#0B6D2C]'
                                    : 'bg-[#515DEF0D] border border-[#515DEF33] text-[#515DEF]'
                        }`}>
                            {submitMessage || saveMessage}
                        </div>
                    )}

                    <div className='bg-white rounded-2xl shadow-md p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4'>
                        <div className='flex flex-wrap gap-3'>
                            <button
                                type='button'
                                onClick={() => alert('Import marks from spreadsheet will be available in a future update.')}
                                className='bg-white text-[#515DEF] text-sm px-4 py-2 rounded-md border border-[#515DEF] hover:bg-[#515DEF0D] transition-all duration-200 cursor-pointer flex items-center gap-x-2'
                            >
                                <Upload size={16} />
                                Import Marks
                            </button>
                            <button
                                type='button'
                                onClick={() => setExportModal(true)}
                                className='bg-white text-[#515DEF] text-sm px-4 py-2 rounded-md border border-[#515DEF] hover:bg-[#515DEF0D] transition-all duration-200 cursor-pointer flex items-center gap-x-2'
                            >
                                <Download size={16} />
                                Export
                            </button>
                        </div>
                        <div className='flex flex-wrap gap-3'>
                            <button
                                type='button'
                                onClick={handleSaveDraft}
                                disabled={isLocked}
                                className='bg-white text-[#515DEF] text-sm px-6 py-2.5 rounded-md border border-[#515DEF] hover:bg-[#515DEF0D] transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
                            >
                                Save Draft
                            </button>
                            <button
                                type='button'
                                onClick={handleSubmitClick}
                                disabled={isLocked}
                                className='bg-[#515DEF] text-white text-sm px-6 py-2.5 rounded-md border border-[#515DEF] hover:opacity-90 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
                            >
                                Submit for Approval
                            </button>
                        </div>
                    </div>
                </>
            )}

            <ExportModal
                exportModal={exportModal}
                setExportModal={setExportModal}
                filename='mark-entry-page'
                rows={Array.isArray(session?.students) ? session.students : []}
                exportDescription={<>You are exporting {Array.isArray(session?.students) ? session.students.length : 0} record(s).</>}
            />
            <IncompleteMarksModal open={incompleteModal} onClose={() => setIncompleteModal(false)} stats={stats} />
            <SubmitMarksConfirmModal
                open={submitModal}
                onClose={() => setSubmitModal(false)}
                onConfirm={handleConfirmSubmit}
                stats={stats}
                examLabel={`${exam} — ${formatClassLabel(className)} Section ${section} — ${subject}`}
            />
        </section>
    )
}

export default MarkEntryPage
