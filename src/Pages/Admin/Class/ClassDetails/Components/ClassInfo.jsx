import React, { useMemo } from 'react'
import { CLASS_LEVEL_OPTIONS } from '../classDetailsOptions'

const inputClass = 'text-sm font-normal text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-2 py-3 w-full'

const ClassInfo = ({
    form,
    onChange,
    apiMode = false,
    years = [],
    academicYearId = '',
    onAcademicYearChange,
    existingClassNames = [],
}) => {
    const classOptions = useMemo(() => {
        const merged = [...CLASS_LEVEL_OPTIONS, ...(existingClassNames || [])]
        return [...new Set(merged.map((item) => String(item || '').trim()).filter(Boolean))]
    }, [existingClassNames])

    return (
        <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-6 lg:mt-8 mt-2'>
            <div className='flex flex-col gap-y-2'>
                <label htmlFor='className' className='text-base font-medium text-[#1E1E1E]'>Class:</label>
                <select
                    id='className'
                    value={form.className}
                    onChange={(e) => onChange('className', e.target.value)}
                    className={inputClass}
                >
                    <option value=''>Select Class</option>
                    {classOptions.map((item) => (
                        <option key={item} value={item}>{item}</option>
                    ))}
                </select>
                <p className='text-xs text-[#667085]'>
                    Names stay as saved (e.g. Pre-KG, LKG, Grade 1) and sync to Teacher Allocation and other dropdowns.
                </p>
            </div>
            {apiMode ? (
                <div className='flex flex-col gap-y-2'>
                    <label htmlFor='academicYear' className='text-base font-medium text-[#1E1E1E]'>Academic Year:</label>
                    <select
                        id='academicYear'
                        value={academicYearId}
                        onChange={(e) => onAcademicYearChange?.(e.target.value)}
                        className={inputClass}
                    >
                        <option value=''>Current academic year</option>
                        {years.filter((year) => year.isActive).map((year) => (
                            <option key={year.id} value={year.id}>
                                {year.name}{year.isCurrent ? ' (current)' : ''}
                            </option>
                        ))}
                    </select>
                    <p className='text-xs text-[#667085]'>
                        Manage years under Class Details → Academic Years (add 2027-2028, set current).
                    </p>
                </div>
            ) : null}
        </div>
    )
}

export default ClassInfo
