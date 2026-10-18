import React, { useMemo } from 'react'
import DatePicker from 'react-datepicker'
import { Calendar } from 'lucide-react'
import 'react-datepicker/dist/react-datepicker.css'

/** camelCase / snake_case / bare keys → readable form headers */
export function humanizeLabel(key) {
    if (!key) return ''
    const known = {
        dateOfBirth: 'Date of birth',
        maritalStatus: 'Marital status',
        currentCompany: 'Current company',
        currentSalary: 'Current salary',
        expectedSalary: 'Expected salary',
        noticePeriod: 'Notice period',
        applicationDate: 'Application date',
        joiningDate: 'Joining date',
        grossSalary: 'Gross salary',
        reportingManager: 'Reporting manager',
        offerDate: 'Offer date',
        validityDate: 'Validity date',
        hiringManager: 'Hiring manager',
        postedDate: 'Posted date',
        closingDate: 'Closing date',
        nextStep: 'Next step',
        finalDecision: 'Final decision',
        leaveType: 'Leave type',
        fromDate: 'From date',
        toDate: 'To date',
        lastWorkingDate: 'Last working / leaving date',
        leavingDate: 'Leaving date',
        exitType: 'Exit type',
        actionType: 'Action type',
        employeeId: 'Employee',
        candidateId: 'Candidate',
        studentId: 'Student',
        studentName: 'Student name',
        mentorId: 'Mentor',
        className: 'Class',
        newDesignation: 'New designation',
        currentGross: 'Current gross',
        revisionPercent: 'Revision %',
        incrementType: 'Increment type',
        approvedBy: 'Approved by',
        effectiveDate: 'Effective date',
        reviewDate: 'Review date',
        startDate: 'Start date',
        endDate: 'End date',
        menteeResponse: 'Mentee response',
        practicalDifficulties: 'Practical difficulties',
        bestQualities: 'Best qualities',
        generalComments: 'General comments',
        mentorRemarks: 'Mentor remarks',
        reviewerRemarks: 'Reviewer remarks',
        schoolEthos: 'School ethos',
        requiredDate: 'Required date',
        planType: 'Plan type',
        itemName: 'Item',
        receivedBy: 'Received by',
        resumeName: 'Resume',
        jobId: 'Position / job',
        gender: 'Gender',
    }
    if (known[key]) return known[key]
    return String(key)
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^./, (c) => c.toUpperCase())
}

export const formInputClass =
    'text-sm font-normal text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-2 py-2 w-full bg-white'

/** start of local calendar day */
export function startOfToday() {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
}

/** Parse DD-MM-YYYY / YYYY-MM-DD / Date → Date | null */
export function parseFormDate(value) {
    if (!value) return null
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value
    const text = String(value).trim()
    const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
    if (dmy) {
        const parsed = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]))
        return Number.isNaN(parsed.getTime()) ? null : parsed
    }
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (iso) {
        const parsed = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
        return Number.isNaN(parsed.getTime()) ? null : parsed
    }
    const fallback = new Date(text)
    return Number.isNaN(fallback.getTime()) ? null : fallback
}

/** Store as DD-MM-YYYY (campus HR convention). */
export function formatFormDate(value) {
    const date = value instanceof Date ? value : parseFormDate(value)
    if (!date) return ''
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    return `${day}-${month}-${date.getFullYear()}`
}

/**
 * Date bound rules:
 * - past   → today and earlier (future disabled) — DOB, application date
 * - future → today and later (past disabled) — joining, leaving, closing, leave dates
 * - any    → no min/max
 */
export const DATE_BOUNDS = {
    past: 'past',
    future: 'future',
    any: 'any',
}

const GENDER_OPTIONS = ['Female', 'Male', 'Other']
const MARITAL_OPTIONS = ['Single', 'Married', 'Divorced', 'Widowed', 'Other']

/**
 * Auto control map for KeyFields / forms.
 * type: text | number | email | select | date
 * bound: for date fields
 */
export const FIELD_CONTROLS = {
    dateOfBirth: { type: 'date', bound: 'past', hint: 'Future dates are disabled' },
    applicationDate: { type: 'date', bound: 'past', hint: 'Cannot be a future date' },
    postedDate: { type: 'date', bound: 'past' },
    reviewDate: { type: 'date', bound: 'past' },
    offerDate: { type: 'date', bound: 'past' },

    joiningDate: { type: 'date', bound: 'future', hint: 'Past dates are disabled' },
    lastWorkingDate: { type: 'date', bound: 'future', hint: 'Past dates are disabled' },
    leavingDate: { type: 'date', bound: 'future', hint: 'Past dates are disabled' },
    closingDate: { type: 'date', bound: 'future', hint: 'Past dates are disabled' },
    validityDate: { type: 'date', bound: 'future', hint: 'Past dates are disabled' },
    requiredDate: { type: 'date', bound: 'future', hint: 'Past dates are disabled' },
    effectiveDate: { type: 'date', bound: 'future', hint: 'Past dates are disabled' },
    fromDate: { type: 'date', bound: 'future', hint: 'Past dates are disabled' },
    toDate: { type: 'date', bound: 'future', hint: 'Past dates are disabled' },
    startDate: { type: 'date', bound: 'future', hint: 'Past dates are disabled' },
    endDate: { type: 'date', bound: 'future', hint: 'Past dates are disabled' },

    date: { type: 'date', bound: 'any' },
    from: { type: 'date', bound: 'any' },
    to: { type: 'date', bound: 'any' },

    gender: { type: 'select', options: GENDER_OPTIONS, placeholder: 'Select gender' },
    maritalStatus: { type: 'select', options: MARITAL_OPTIONS, placeholder: 'Select marital status' },

    currentSalary: { type: 'number' },
    expectedSalary: { type: 'number' },
    grossSalary: { type: 'number' },
    openings: { type: 'number' },
    percent: { type: 'number' },
    amount: { type: 'number' },
    entitlement: { type: 'number' },
    currentGross: { type: 'number' },
    revisionPercent: { type: 'number' },
    email: { type: 'email' },
    mobile: { type: 'tel' },
}

export function FormField({ label, children, className = '', hint }) {
    return (
        <label className={`flex flex-col gap-y-1.5 text-sm font-medium text-[#344054] ${className}`}>
            <span>{label}</span>
            {children}
            {hint ? <span className='text-xs font-normal text-[#667085]'>{hint}</span> : null}
        </label>
    )
}

export function TextField({
    label,
    value,
    onChange,
    type = 'text',
    placeholder = '',
    className = '',
    inputClassName = formInputClass,
    hint,
    ...rest
}) {
    return (
        <FormField label={label} className={className} hint={hint}>
            <input
                type={type}
                className={inputClassName}
                value={value ?? ''}
                onChange={onChange}
                placeholder={placeholder}
                {...rest}
            />
        </FormField>
    )
}

export function SelectField({
    label,
    value,
    onChange,
    options = [],
    placeholder = 'Select…',
    className = '',
    inputClassName = formInputClass,
    hint,
    ...rest
}) {
    const normalized = options.map((option) => (
        typeof option === 'object' && option != null
            ? { value: String(option.value), label: option.label ?? String(option.value) }
            : { value: String(option), label: String(option) }
    ))
    return (
        <FormField label={label} className={className} hint={hint}>
            <select className={inputClassName} value={value ?? ''} onChange={onChange} {...rest}>
                {placeholder != null ? <option value=''>{placeholder}</option> : null}
                {normalized.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </select>
        </FormField>
    )
}

/**
 * Shared date picker.
 * @param {'past'|'future'|'any'} bound
 *   past   — maxDate = today (DOB)
 *   future — minDate = today (joining / leaving)
 *   any    — unrestricted
 */
export function DateField({
    label,
    value,
    onChange,
    bound = 'any',
    required = false,
    className = '',
    hint,
    minDate: minDateProp,
    maxDate: maxDateProp,
    placeholderText = 'DD-MM-YYYY',
}) {
    const today = useMemo(() => startOfToday(), [])
    const minDate = minDateProp ?? (bound === 'future' ? today : undefined)
    const maxDate = maxDateProp ?? (bound === 'past' ? today : undefined)
    const defaultHint = bound === 'past'
        ? 'Future dates are disabled'
        : bound === 'future'
            ? 'Past dates are disabled'
            : hint

    return (
        <FormField
            label={`${label || 'Date'}${required ? ' *' : ''}`}
            className={className}
            hint={hint ?? defaultHint}
        >
            <div className='relative'>
                <DatePicker
                    selected={parseFormDate(value)}
                    onChange={(date) => onChange(date ? formatFormDate(date) : '')}
                    dateFormat='dd-MM-yyyy'
                    placeholderText={placeholderText}
                    showMonthDropdown
                    showYearDropdown
                    dropdownMode='select'
                    isClearable={!required}
                    minDate={minDate}
                    maxDate={maxDate}
                    className={`${formInputClass} pr-10`}
                    wrapperClassName='w-full'
                    yearDropdownItemNumber={bound === 'past' ? 80 : 15}
                    scrollableYearDropdown
                />
                <Calendar size={16} className='absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] pointer-events-none' />
            </div>
        </FormField>
    )
}

function controlFor(key, overrides = {}) {
    return { ...(FIELD_CONTROLS[key] || { type: 'text' }), ...overrides }
}

/** Render a list of camelCase keys as typed labeled controls bound to form/setForm. */
export function KeyFields({ keys, form, setForm, types = {}, className = '', bounds = {} }) {
    return keys.map((key) => {
        const control = controlFor(key, {
            ...(types[key] ? { type: types[key] } : {}),
            ...(bounds[key] ? { bound: bounds[key] } : {}),
        })
        const label = humanizeLabel(key)
        const value = form?.[key] ?? ''
        const onChangeValue = (next) => setForm({ ...form, [key]: next })

        if (control.type === 'date') {
            return (
                <DateField
                    key={key}
                    label={label}
                    value={value}
                    onChange={onChangeValue}
                    bound={control.bound || 'any'}
                    hint={control.hint}
                    className={className}
                />
            )
        }
        if (control.type === 'select') {
            return (
                <SelectField
                    key={key}
                    label={label}
                    value={value}
                    onChange={(e) => onChangeValue(e.target.value)}
                    options={control.options || []}
                    placeholder={control.placeholder || `Select ${label.toLowerCase()}`}
                    className={className}
                />
            )
        }
        return (
            <TextField
                key={key}
                label={label}
                type={control.type || 'text'}
                value={value}
                onChange={(e) => onChangeValue(e.target.value)}
                placeholder={`Enter ${label.toLowerCase()}`}
                className={className}
            />
        )
    })
}
