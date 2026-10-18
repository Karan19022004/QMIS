import React, { useMemo, useState, useSyncExternalStore } from 'react'
import { getHrStoreVersion, subscribeHrStore } from '../domain/hrStorage'
import { hrBadge } from '../domain/hrStatus'
import ExportModal from '../../../Common/CommonComponents/ExportModal'
import {
    DateField,
    FormField,
    KeyFields,
    SelectField,
    TextField,
    formInputClass,
    formatFormDate,
    humanizeLabel,
    parseFormDate,
} from '../../../Common/CommonComponents/FormField'
import { X } from 'lucide-react'

export {
    DateField,
    FormField,
    KeyFields,
    SelectField,
    TextField,
    formatFormDate,
    humanizeLabel,
    parseFormDate,
}

export const useHrTick = () => useSyncExternalStore(subscribeHrStore, getHrStoreVersion, getHrStoreVersion)

export const Badge = ({ value }) => (
    <span className={`px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${hrBadge(value)}`}>{value || '—'}</span>
)

export const Field = ({ label, children }) => (
    <FormField label={label}>
        {children}
    </FormField>
)

export const inputClass = formInputClass

export const Modal = ({ title, onClose, children, wide = false }) => (
    <div className='fixed inset-0 z-500 flex items-center justify-center p-4'>
        <button type='button' className='absolute inset-0 bg-black/40' onClick={onClose} aria-label='Close' />
        <div className={`relative z-10 w-full ${wide ? 'max-w-4xl' : 'max-w-2xl'} max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-lg p-5`}>
            <div className='flex justify-between items-center mb-4'>
                <h2 className='text-xl font-semibold text-black'>{title}</h2>
                <button type='button' onClick={onClose} className='hover:text-red-500 cursor-pointer'><X /></button>
            </div>
            {children}
        </div>
    </div>
)

export const PrimaryButton = ({ children, onClick, type = 'button' }) => (
    <button type={type} onClick={onClick} className='bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md hover:opacity-90 cursor-pointer'>{children}</button>
)

export const GhostButton = ({ children, onClick, type = 'button' }) => (
    <button type={type} onClick={onClick} className='bg-white text-[#515DEF] text-sm px-4 py-2 rounded-md border border-[#515DEF] hover:bg-[#515DEF] hover:text-white cursor-pointer'>{children}</button>
)

export { downloadTableCsv as downloadCsv } from '../../../Common/exportDownload'

/**
 * Open a print-friendly HTML document (offer letters, etc.).
 * Do not use noopener here — modern browsers then return null / a blank tab we cannot write into.
 */
export const printHtml = (title, html, { autoPrint = false } = {}) => {
    const frame = window.open('', '_blank', 'width=960,height=720')
    if (!frame) {
        window.alert('Pop-up blocked. Allow pop-ups for this site to preview or print the letter.')
        return
    }
    const safeTitle = String(title || 'Preview')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    frame.document.open()
    frame.document.write(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Georgia, 'Times New Roman', Times, serif; color: #1e1e1e; background: #f2f4f7; }
    .toolbar { position: sticky; top: 0; z-index: 2; display: flex; gap: 8px; justify-content: flex-end; padding: 12px 16px; background: #101828; }
    .toolbar button { border: 0; border-radius: 6px; padding: 8px 14px; font: 600 13px Arial, sans-serif; cursor: pointer; }
    .toolbar .print { background: #515DEF; color: #fff; }
    .toolbar .close { background: #fff; color: #101828; }
    .sheet { max-width: 820px; margin: 20px auto; background: #fff; padding: 36px 44px; box-shadow: 0 8px 24px rgba(16,24,40,.08); }
    @media print {
      body { background: #fff; }
      .toolbar { display: none !important; }
      .sheet { margin: 0; box-shadow: none; max-width: none; padding: 12mm; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button type="button" class="print" onclick="window.print()">Print</button>
    <button type="button" class="close" onclick="window.close()">Close</button>
  </div>
  <div class="sheet">${html}</div>
</body>
</html>`)
    frame.document.close()
    frame.focus()
    if (autoPrint) {
        window.setTimeout(() => {
            try { frame.print() } catch { /* ignore */ }
        }, 350)
    }
}

export const HrExport = ({ open, setOpen, rows, filename }) => (
    <ExportModal
        exportModal={open}
        setExportModal={setOpen}
        filename={filename}
        rows={rows}
        exportDescription={`You are exporting ${rows.length} record(s).`}
    />
)

export const useFilters = (initial) => {
    const [filters, setFilters] = useState(initial)
    const set = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }))
    const clear = () => setFilters(initial)
    return { filters, set, clear, setFilters }
}

export const matches = (value, query) => String(value || '').toLowerCase().includes(String(query || '').toLowerCase())

export const Select = ({ label, value, onChange, options, allLabel = 'All' }) => (
    <SelectField
        label={label}
        value={value}
        onChange={onChange}
        options={options}
        placeholder={allLabel}
        inputClassName={inputClass}
    />
)

export const SearchBox = ({ value, onChange, placeholder }) => (
    <Field label='Search'>
        <input className={inputClass} value={value} onChange={onChange} placeholder={placeholder} />
    </Field>
)

export const TableWrap = ({ title, action, children }) => (
    <div className='bg-white rounded-2xl shadow-md p-4 mt-6'>
        <div className='flex justify-between items-center sm:flex-row flex-col gap-y-2 mb-4'>
            <h2 className='text-xl font-medium text-black'>{title}</h2>
            <div className='flex flex-wrap gap-2'>{action}</div>
        </div>
        <div className='relative overflow-x-auto'>{children}</div>
    </div>
)

export const th = 'px-2 py-3.5 text-[#0C1E5B] font-medium uppercase text-xs whitespace-nowrap'
export const td = 'px-2 py-4 text-[#667085] text-sm'

export function PageIntro({ text, children }) {
    return (
        <div className='bg-white rounded-2xl shadow-md p-4'>
            <p className='text-sm text-[#667085] mb-4'>{text}</p>
            {children}
        </div>
    )
}

export function useList(loader) {
    const tick = useHrTick()
    return useMemo(() => loader(), [loader, tick])
}
