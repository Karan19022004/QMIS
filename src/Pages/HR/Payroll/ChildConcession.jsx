import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { employeeName, getConcessions, getEmployees, nextId, saveConcessions } from '../domain/hrStore'
import { formatInr } from '../domain/payrollCalculations'
import { Badge, KeyFields, Modal, PageIntro, PrimaryButton, Select, TableWrap, TextField, td, th, useHrTick } from '../components/HrUi'
import { apiRequest, getAccessToken } from '../../../services/apiClient'
import { connectHrApi } from '../../../services/hrApi'

const ChildConcession = () => {
    const tick = useHrTick()
    const rows = useMemo(() => getConcessions(), [tick])
    const employees = useMemo(() => getEmployees(), [tick])
    const [students, setStudents] = useState([])
    const [studentsError, setStudentsError] = useState(null)
    const [form, setForm] = useState(null)

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                if (!getAccessToken()) await connectHrApi()
                const list = await apiRequest('/admissions/enrolled-students')
                if (!cancelled) {
                    setStudents(Array.isArray(list) ? list : [])
                    setStudentsError(null)
                }
            } catch (error) {
                if (!cancelled) {
                    setStudents([])
                    setStudentsError(error?.message || 'Could not load enrolled students from API')
                }
            }
        })()
        return () => { cancelled = true }
    }, [])

    const save = (event) => {
        event.preventDefault()
        const student = students.find((item) => item.id === form.studentId)
        const record = {
            id: nextId('CON-2026', rows),
            employeeId: form.employeeId,
            studentName: student?.name || form.studentName || 'Staff child',
            relationship: form.relationship,
            admissionNumber: student?.admissionNumber || form.admissionNumber || '',
            className: form.className || student?.className || '',
            academicYear: '2026-27',
            type: form.type,
            percent: Number(form.percent) || 0,
            amount: Number(form.amount) || 0,
            from: form.from,
            to: form.to,
            status: 'Pending',
            approvedBy: '',
        }
        saveConcessions([record, ...getConcessions()])
        toast.success('Concession saved to HR API (linked to enrolled student list).')
        setForm(null)
    }

    return (
        <section>
            <PageIntro text='Students come from the API enrolled-student list. This page does not read browser localStorage.' />
            {studentsError && (
                <p className='mb-3 text-sm text-[#B42318]'>{studentsError}</p>
            )}
            <TableWrap
                title='Employee Child Concession'
                action={(
                    <PrimaryButton
                        onClick={() => setForm({
                            employeeId: employees[0]?.id,
                            studentId: students[0]?.id || '',
                            relationship: 'Son',
                            className: students[0]?.className || 'Class 5',
                            type: 'Staff Child Tuition',
                            percent: 25,
                            amount: 10000,
                            from: '2026-04-01',
                            to: '2027-03-31',
                        })}
                    >
                        Add concession
                    </PrimaryButton>
                )}
            >
                <table className='w-full text-left'>
                    <thead className='bg-[#EDEEF5]'>
                        <tr>{['Employee', 'Student', 'Admission', 'Type', 'Amount', 'Status'].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.id} className='border-b'>
                                <td className={td}>{employeeName(row.employeeId)}</td>
                                <td className={td}>{row.studentName}</td>
                                <td className={td}>{row.admissionNumber}</td>
                                <td className={td}>{row.type} · {row.percent}%</td>
                                <td className={td}>{formatInr(row.amount)}</td>
                                <td className={td}><Badge value={row.status} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </TableWrap>
            {form && (
                <Modal title='Concession' onClose={() => setForm(null)}>
                    <form onSubmit={save} className='grid gap-3'>
                        <Select label='Employee (parent / staff)' value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} options={employees.map((item) => ({ value: item.id, label: item.name }))} allLabel='Select employee' />
                        <Select
                            label='Enrolled student'
                            value={form.studentId || ''}
                            onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                            options={students.map((item) => ({ value: item.id, label: `${item.name} · ${item.admissionNumber}` }))}
                            allLabel='No enrolled student selected'
                        />
                        <TextField label='Student name (if not enrolled)' value={form.studentName || ''} onChange={(e) => setForm({ ...form, studentName: e.target.value })} />
                        <KeyFields keys={['relationship', 'className', 'type', 'percent', 'amount', 'from', 'to']} form={form} setForm={setForm} types={{ percent: 'number', amount: 'number' }} />
                        <PrimaryButton type='submit'>Save</PrimaryButton>
                    </form>
                </Modal>
            )}
        </section>
    )
}

export default ChildConcession
