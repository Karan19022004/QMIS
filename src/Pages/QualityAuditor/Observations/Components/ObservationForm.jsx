import React, { useMemo } from 'react'
import {
    DEPARTMENTS,
    PRIORITIES,
    SEVERITIES,
    CATEGORIES,
    OBSERVATION_STATUSES,
    AUDIT_REFERENCES,
    RESPONSIBLE_PERSONS,
} from '../observationsData'
import { AUDIT_COMPONENTS_KEY, COMPONENT_SEED } from '../../../../Common/demoDomain/auditSeeds'
import { ensureSeed } from '../../../../Common/demoDomain/storage'
import { getAuditSchedules } from '../../AuditManagement/AuditSchedule/auditScheduleData'

const inputClass =
    'text-sm text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-3 py-2 w-full focus:border-[#515DEF] outline-none'

const ObservationForm = ({ form, onChange, readOnly = false }) => {
    const update = (field, value) => onChange({ ...form, [field]: value })

    const componentOptions = useMemo(() => {
        const rows = ensureSeed(AUDIT_COMPONENTS_KEY, COMPONENT_SEED)
        const names = rows.map((row) => row.component).filter(Boolean)
        const fromSchedules = getAuditSchedules().map((item) => item.componentName).filter(Boolean)
        return [...new Set([...names, ...fromSchedules, ...CATEGORIES])]
    }, [])

    const auditReferences = useMemo(() => {
        const fromSchedule = getAuditSchedules().map((item) => item.auditId).filter(Boolean)
        return [...new Set([...fromSchedule, ...AUDIT_REFERENCES])]
    }, [])

    const Field = ({ label, children }) => (
        <div className='flex flex-col gap-y-2'>
            <label className='text-sm font-medium text-[#808080]'>{label}</label>
            {children}
        </div>
    )

    if (readOnly) {
        return (
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
                {[
                    ['Observation ID', form.observationId],
                    ['Reference Number', form.referenceNumber || form.observationId],
                    ['Audit Reference', form.auditReference],
                    ['Department', form.department || '—'],
                    ['Component', form.category],
                    ['Grade', form.grade || '—'],
                    ['Section', form.section || '—'],
                    ['Subject', form.subject || '—'],
                    ['Priority', form.priority],
                    ['Severity', form.severity],
                    ['Recipient', form.recipient || form.responsiblePerson],
                    ['Responsible Department', form.responsibleDepartment],
                    ['Responsible Person', form.responsiblePerson],
                    ['Due Date', form.dueDate],
                    ['Status', form.status],
                    ['Attachment', form.evidence || '—'],
                ].map(([label, value]) => (
                    <div key={label} className='flex flex-col gap-y-1'>
                        <span className='text-sm font-medium text-[#808080]'>{label}</span>
                        <span className='text-sm text-[#1E1E1E]'>{value || '—'}</span>
                    </div>
                ))}
                <div className='sm:col-span-2 lg:col-span-3 flex flex-col gap-y-1'>
                    <span className='text-sm font-medium text-[#808080]'>Description</span>
                    <span className='text-sm text-[#1E1E1E] whitespace-pre-wrap'>{form.description}</span>
                </div>
            </div>
        )
    }

    return (
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
            <Field label='Reference Number'>
                <input
                    type='text'
                    value={form.referenceNumber || ''}
                    onChange={(e) => update('referenceNumber', e.target.value)}
                    placeholder='Editable reference (optional)'
                    className={inputClass}
                />
            </Field>
            <Field label='Audit Reference'>
                <select value={form.auditReference || ''} onChange={(e) => update('auditReference', e.target.value)} className={inputClass}>
                    <option value=''>Select audit</option>
                    {auditReferences.map((ref) => (
                        <option key={ref} value={ref}>{ref}</option>
                    ))}
                </select>
            </Field>
            <Field label='Department'>
                <select value={form.department || ''} onChange={(e) => update('department', e.target.value)} className={inputClass}>
                    <option value=''>Select department</option>
                    <option value='Academics'>Academics</option>
                    {DEPARTMENTS.filter((dept) => dept !== 'Academics').map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                    ))}
                </select>
            </Field>
            <Field label='Component'>
                <select value={form.category || ''} onChange={(e) => update('category', e.target.value)} className={inputClass}>
                    <option value=''>Select component</option>
                    {componentOptions.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>
            </Field>
            <Field label='Grade'>
                <input type='text' value={form.grade || ''} onChange={(e) => update('grade', e.target.value)} placeholder='Leave blank if not applicable' className={inputClass} />
            </Field>
            <Field label='Section'>
                <input type='text' value={form.section || ''} onChange={(e) => update('section', e.target.value)} placeholder='Leave blank if not applicable' className={inputClass} />
            </Field>
            <Field label='Subject'>
                <input type='text' value={form.subject || ''} onChange={(e) => update('subject', e.target.value)} placeholder='Leave blank if not applicable' className={inputClass} />
            </Field>
            <Field label='Rating (1-5)'>
                <select value={form.rating || ''} onChange={(e) => update('rating', e.target.value)} className={inputClass}>
                    <option value=''>Select rating</option>
                    {['1', '2', '3', '4', '5'].map((score) => <option key={score}>{score}</option>)}
                </select>
            </Field>
            <Field label='Priority'>
                <select value={form.priority} onChange={(e) => update('priority', e.target.value)} className={inputClass}>
                    {PRIORITIES.map((p) => (
                        <option key={p} value={p}>{p}</option>
                    ))}
                </select>
            </Field>
            <Field label='Severity'>
                <select value={form.severity} onChange={(e) => update('severity', e.target.value)} className={inputClass}>
                    {SEVERITIES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
            </Field>
            <Field label='Recipient (escalate to)'>
                <select
                    value={form.recipient || form.responsiblePerson || ''}
                    onChange={(e) => onChange({ ...form, recipient: e.target.value, responsiblePerson: e.target.value })}
                    className={inputClass}
                >
                    <option value=''>Select recipient</option>
                    {RESPONSIBLE_PERSONS.map((person) => (
                        <option key={person} value={person}>{person}</option>
                    ))}
                </select>
            </Field>
            <Field label='Due Date'>
                <input type='date' value={form.dueDate} onChange={(e) => update('dueDate', e.target.value)} className={inputClass} />
            </Field>
            <Field label='Status'>
                <select value={form.status} onChange={(e) => update('status', e.target.value)} className={inputClass}>
                    {OBSERVATION_STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
            </Field>
            <Field label='Attachment (all file types)'>
                <input
                    type='file'
                    accept='.png,.jpg,.jpeg,.pdf,.doc,.docx,.xls,.xlsx,image/png,image/*,*/*'
                    onChange={(e) => {
                        const file = e.target.files?.[0]
                        const name = file ? file.name : ''
                        onChange({ ...form, evidence: name, attachmentName: name })
                    }}
                    className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-[#515DEF] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white`}
                />
                {form.evidence ? <p className='text-xs text-[#667085]'>Selected: {form.evidence}</p> : null}
            </Field>
            <div className='sm:col-span-2 lg:col-span-3'>
                <Field label='Description (used as observation detail)'>
                    <textarea
                        value={form.description}
                        onChange={(e) => update('description', e.target.value)}
                        placeholder='Describe the non-compliance or finding in detail...'
                        className={`${inputClass} min-h-[120px] resize-y`}
                        required
                    />
                </Field>
            </div>
        </div>
    )
}

export default ObservationForm
