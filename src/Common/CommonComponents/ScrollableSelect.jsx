import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

const ALL_VALUE = '__ALL__'

const optionValue = (opt) => (typeof opt === 'string' ? opt : opt?.value)
const optionLabel = (opt) => (typeof opt === 'string' ? opt : (opt?.label || opt?.value))

/**
 * Compact select with an in-panel scrollable options list.
 * Supports single or multi-select (with optional "All").
 */
const ScrollableSelect = ({
    id,
    value,
    onChange,
    options = [],
    placeholder = 'Select…',
    disabled = false,
    className = '',
    listClassName = 'max-h-48',
    multiple = false,
    showAllOption = false,
    allLabel = 'All',
    allValue = ALL_VALUE,
}) => {
    const autoId = useId()
    const fieldId = id || autoId
    const rootRef = useRef(null)
    const [open, setOpen] = useState(false)

    const normalizedOptions = useMemo(
        () => options.map((opt) => ({ value: optionValue(opt), label: optionLabel(opt) })).filter((o) => o.value != null && o.value !== ''),
        [options],
    )

    const selectedValues = useMemo(() => {
        if (multiple) return Array.isArray(value) ? value.map(String) : []
        return value == null || value === '' ? [] : [String(value)]
    }, [multiple, value])

    const allOptionValues = normalizedOptions.map((o) => o.value)
    const isAllSelected = multiple
        && showAllOption
        && allOptionValues.length > 0
        && (selectedValues.includes(allValue) || allOptionValues.every((v) => selectedValues.includes(v)))

    const displayLabel = useMemo(() => {
        if (!selectedValues.length) return ''
        if (multiple && isAllSelected) return allLabel
        if (!multiple) {
            const match = normalizedOptions.find((o) => o.value === selectedValues[0])
            return match?.label || selectedValues[0]
        }
        const labels = selectedValues
            .filter((v) => v !== allValue)
            .map((v) => normalizedOptions.find((o) => o.value === v)?.label || v)
        return labels.join(', ')
    }, [selectedValues, multiple, isAllSelected, allLabel, allValue, normalizedOptions])

    useEffect(() => {
        if (!open) return undefined
        const onPointerDown = (event) => {
            if (!rootRef.current?.contains(event.target)) setOpen(false)
        }
        const onKeyDown = (event) => {
            if (event.key === 'Escape') setOpen(false)
        }
        document.addEventListener('mousedown', onPointerDown)
        document.addEventListener('keydown', onKeyDown)
        return () => {
            document.removeEventListener('mousedown', onPointerDown)
            document.removeEventListener('keydown', onKeyDown)
        }
    }, [open])

    const toggleMulti = (nextValue) => {
        if (nextValue === allValue) {
            if (isAllSelected) onChange?.([])
            else onChange?.([allValue, ...allOptionValues])
            return
        }
        const withoutAll = selectedValues.filter((v) => v !== allValue)
        const exists = withoutAll.includes(nextValue)
        let next = exists ? withoutAll.filter((v) => v !== nextValue) : [...withoutAll, nextValue]
        if (allOptionValues.length && allOptionValues.every((v) => next.includes(v))) {
            next = [allValue, ...allOptionValues]
        }
        onChange?.(next)
    }

    const pickSingle = (nextValue) => {
        onChange?.(nextValue)
        setOpen(false)
    }

    const listItems = [
        ...(multiple && showAllOption && allOptionValues.length
            ? [{ value: allValue, label: allLabel }]
            : []),
        ...normalizedOptions,
    ]

    return (
        <div ref={rootRef} className={`relative ${className}`}>
            <button
                type='button'
                id={fieldId}
                disabled={disabled}
                aria-haspopup='listbox'
                aria-expanded={open}
                aria-multiselectable={multiple || undefined}
                onClick={() => !disabled && setOpen((current) => !current)}
                className='w-full text-left text-sm font-normal text-[#1E1E1E] border border-[#D9D9D9] rounded-md px-2 py-3 bg-white flex items-center justify-between gap-2 disabled:opacity-60 disabled:cursor-not-allowed'
            >
                <span className={`truncate ${displayLabel ? 'text-[#1E1E1E]' : 'text-[#808080]'}`}>
                    {displayLabel || placeholder}
                </span>
                <ChevronDown size={16} className={`shrink-0 text-[#808080] transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <ul
                    role='listbox'
                    className={`absolute z-40 mt-1 w-full overflow-y-auto rounded-md border border-[#D9D9D9] bg-white shadow-lg py-1 ${listClassName}`}
                >
                    {listItems.length === 0 && (
                        <li className='px-3 py-2 text-sm text-[#808080]'>No options</li>
                    )}
                    {listItems.map((item) => {
                        const active = item.value === allValue
                            ? isAllSelected
                            : selectedValues.includes(item.value) || isAllSelected
                        return (
                            <li key={String(item.value)}>
                                <button
                                    type='button'
                                    role='option'
                                    aria-selected={active}
                                    className={`w-full text-left px-3 py-2 text-sm cursor-pointer flex items-center justify-between gap-2 ${
                                        active
                                            ? 'bg-[#515DEF] text-white'
                                            : 'text-[#1E1E1E] hover:bg-[#EEF0F6]'
                                    }`}
                                    onClick={() => {
                                        if (multiple) toggleMulti(item.value)
                                        else pickSingle(item.value)
                                    }}
                                >
                                    <span>{item.label}</span>
                                    {multiple && active ? <Check size={14} className='shrink-0' /> : null}
                                </button>
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}

export const SCROLLABLE_SELECT_ALL = ALL_VALUE

export default ScrollableSelect
