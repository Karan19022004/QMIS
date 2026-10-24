import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { StatusBadge } from '../../../Common/demoDomain/statusBadge'
import { getInventoryItems, hydrateInventoryItemsFromApi } from '../Inventory/inventoryData'
import {
    addStationeryRequirement,
    getStationeryRequirements,
    hydrateStationeryRequirementsFromApi,
} from './requirementsData'

const inputClass = 'text-sm border border-[#D9D9D9] rounded-md px-2 py-2 w-full'

const Requirements = () => {
    const [rows, setRows] = useState(() => getStationeryRequirements())
    const [items, setItems] = useState(() => getInventoryItems())
    const [form, setForm] = useState({
        item: '',
        quantity: 10,
        requiredDate: '',
        remarks: '',
        year: '2026-27',
        planType: 'Annual minimum order',
    })

    useEffect(() => {
        let active = true
        Promise.all([
            hydrateStationeryRequirementsFromApi(),
            hydrateInventoryItemsFromApi(),
        ]).finally(() => {
            if (!active) return
            setRows(getStationeryRequirements())
            setItems(getInventoryItems())
        })
        return () => { active = false }
    }, [])

    const submit = async (event) => {
        event.preventDefault()
        if (!String(form.item || '').trim()) {
            toast.error('Item is required.')
            return
        }
        const result = await addStationeryRequirement({
            ...form,
            department: 'Stores',
            requestedBy: 'Stores Manager',
        })
        if (result?.success === false) {
            toast.error(result.message || 'Could not save requirement.')
            return
        }
        setRows(getStationeryRequirements())
        setForm((prev) => ({ ...prev, item: '', quantity: 10, remarks: '' }))
        toast.success('Requirement saved to stationery stores.')
    }

    return (
        <section className='space-y-4'>
            <div className='bg-white rounded-2xl shadow-md p-4'>
                <h2 className='text-xl font-semibold text-black'>Stationery requirements</h2>
                <p className='text-sm text-[#667085] mt-1'>Department store of record. Vendor is not required at this stage.</p>
            </div>
            <form onSubmit={submit} className='bg-white rounded-2xl shadow-md p-4 grid grid-cols-1 md:grid-cols-4 gap-3'>
                <select value={form.year} onChange={(event) => setForm({ ...form, year: event.target.value })} className={inputClass}>
                    <option>2026-27</option>
                    <option>2025-26</option>
                </select>
                <input
                    list='stationery-requirement-items'
                    value={form.item}
                    onChange={(event) => setForm({ ...form, item: event.target.value })}
                    className={inputClass}
                    placeholder='Item'
                />
                <datalist id='stationery-requirement-items'>
                    {items.map((item) => (
                        <option key={item.itemId} value={item.itemName} />
                    ))}
                </datalist>
                <input type='number' min='1' value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} className={inputClass} />
                <input type='date' value={form.requiredDate} onChange={(event) => setForm({ ...form, requiredDate: event.target.value })} className={inputClass} />
                <button type='submit' className='bg-[#515DEF] text-white rounded-md text-sm cursor-pointer'>Submit requirement</button>
            </form>
            <div className='bg-white rounded-2xl shadow-md p-4 overflow-x-auto'>
                <table className='w-full text-sm'>
                    <thead className='text-xs bg-[#EDEEF5]'>
                        <tr>{['ID', 'Item', 'Qty', 'Department', 'Required', 'Status'].map((label) => <th key={label} className='px-2 py-3 text-left'>{label}</th>)}</tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && (
                            <tr><td colSpan={6} className='px-2 py-6 text-center text-[#667085]'>No stationery requirements yet.</td></tr>
                        )}
                        {rows.map((row) => (
                            <tr key={row.id} className='border-b border-[#f2f4f7]'>
                                <td className='px-2 py-3'>{row.id}</td>
                                <td className='px-2 py-3'>{row.item}</td>
                                <td className='px-2 py-3'>{row.quantity}</td>
                                <td className='px-2 py-3'>{row.department}</td>
                                <td className='px-2 py-3'>{row.requiredDate}</td>
                                <td className='px-2 py-3'><StatusBadge status={row.status} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    )
}

export default Requirements
