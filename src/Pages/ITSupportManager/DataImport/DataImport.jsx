import React, { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { toast } from 'react-toastify'
import { logActivity } from '../../../Common/demoDomain/activityLog'
import {
    ASSET_CATEGORIES,
    getAssets,
    hydrateAssetsFromApi,
    importAssets,
} from '../AssetManagement/assetData'

const TEMPLATE_HEADER = 'assetName,category,brand,model,serialNumber,status,department,custodian,purchaseDate,warrantyExpiry'
const TEMPLATE_ROW = 'Demo tablet,Others,Apple,iPad,TAB-001,Active,IT Support,IT Store,24-10-2026,23-10-2028'

const parseCsv = (text) => {
    const lines = text.split(/\r?\n/).filter((line) => line.trim())
    if (!lines.length) return []
    const headers = lines[0].split(',').map((cell) => cell.trim())
    return lines.slice(1).map((line) => {
        const cells = line.split(',').map((cell) => cell.trim())
        const row = {}
        headers.forEach((header, index) => {
            row[header] = cells[index] || ''
        })
        if (!row.assetName && cells[0]) {
            const [assetName, category, quantity, serialNumber] = cells
            row.assetName = assetName
            row.category = category
            row.quantity = quantity
            row.serialNumber = serialNumber
        }
        const category = ASSET_CATEGORIES.includes(row.category) ? row.category : (row.category || 'Others')
        return {
            ...row,
            category,
            valid: Boolean(row.assetName && category),
        }
    })
}

const DataImport = () => {
    const [preview, setPreview] = useState([])
    const [message, setMessage] = useState('')
    const [existingCount, setExistingCount] = useState(() => getAssets().length)
    const [importing, setImporting] = useState(false)

    useEffect(() => {
        hydrateAssetsFromApi().finally(() => setExistingCount(getAssets().length))
    }, [])

    const download = () => {
        const csv = `${TEMPLATE_HEADER}\n${TEMPLATE_ROW}\n`
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'asset-import-template.csv'
        link.click()
        URL.revokeObjectURL(url)
        logActivity({ action: 'DOWNLOAD_CLICK', module: 'Asset Import', details: 'Template' })
    }

    const onFile = async (event) => {
        const file = event.target.files?.[0]
        if (!file) return
        const text = await file.text()
        const rows = parseCsv(text)
        setPreview(rows)
        setMessage(`${file.name} loaded. ${rows.filter((row) => row.valid).length} valid of ${rows.length}.`)
        event.target.value = ''
    }

    const importRows = async () => {
        const valid = preview.filter((row) => row.valid)
        if (!valid.length) return
        setImporting(true)
        try {
            const imported = await importAssets(valid)
            setExistingCount(getAssets().length)
            logActivity({ action: 'CREATE', module: 'Asset Import', details: `${imported.length} records` })
            toast.success(`${imported.length} asset${imported.length === 1 ? '' : 's'} imported. They now appear on Asset Management.`)
            setMessage(`${imported.length} imported into IT assets. ${getAssets().length} total on the Asset Management list.`)
        } catch {
            toast.error('Could not import assets.')
        } finally {
            setImporting(false)
        }
    }

    return (
        <section className='bg-white rounded-2xl shadow-md p-4 space-y-3'>
            <h2 className='text-xl font-semibold'>Initial data import</h2>
            <p className='text-sm text-[#667085]'>
                CSV import writes to the same IT asset store as Asset Management ({existingCount} assets currently).
            </p>
            <div className='flex flex-wrap gap-2'>
                <button type='button' onClick={download} className='border border-[#515DEF] text-[#515DEF] text-sm px-3 py-2 rounded-md cursor-pointer'>Download Import Template</button>
                <label className='bg-[#515DEF] text-white text-sm px-3 py-2 rounded-md cursor-pointer'>
                    Upload File
                    <input type='file' accept='.csv,text/csv' className='hidden' onChange={onFile} />
                </label>
                <button type='button' onClick={importRows} disabled={!preview.length || importing} className='bg-[#515DEF] text-white text-sm px-3 py-2 rounded-md cursor-pointer disabled:opacity-50'>
                    {importing ? 'Importing…' : 'Import Records'}
                </button>
                <NavLink to='/it-support-manager/asset-management' className='border border-[#515DEF] text-[#515DEF] text-sm px-3 py-2 rounded-md'>
                    Open Asset Management
                </NavLink>
            </div>
            {message && <p className='text-sm'>{message}</p>}
            {preview.length > 0 && (
                <table className='w-full text-sm'>
                    <thead>
                        <tr>{['Name', 'Category', 'Brand', 'Serial', 'Status', 'Validate'].map((label) => <th key={label} className='text-left px-2 py-2'>{label}</th>)}</tr>
                    </thead>
                    <tbody>
                        {preview.map((row, index) => (
                            <tr key={`${row.serialNumber || row.assetName}-${index}`}>
                                <td className='px-2 py-2'>{row.assetName}</td>
                                <td>{row.category}</td>
                                <td>{row.brand || '—'}</td>
                                <td>{row.serialNumber}</td>
                                <td>{row.status || 'Active'}</td>
                                <td>{row.valid ? 'Valid' : 'Invalid'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </section>
    )
}

export default DataImport
