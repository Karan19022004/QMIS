import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { StatusBadge } from '../../../Common/demoDomain/statusBadge'
import {
    advanceStationeryProcurement,
    createStationeryProcurementRequest,
    downloadQuotationTemplate,
    getStationeryProcurement,
    getStationeryPurchaseOrders,
    hydrateStationeryProcurementFromApi,
    PROCUREMENT_STATUSES,
} from './procurementData'

const PurchaseWorkflow = () => {
    const [rows, setRows] = useState(() => getStationeryProcurement())
    const [title, setTitle] = useState('')
    const [amount, setAmount] = useState('')
    const [minor, setMinor] = useState(true)

    const refresh = () => setRows(getStationeryProcurement())

    useEffect(() => {
        let active = true
        hydrateStationeryProcurementFromApi().finally(() => {
            if (active) refresh()
        })
        return () => { active = false }
    }, [])

    const create = async (event) => {
        event.preventDefault()
        if (!title.trim()) {
            toast.error('Request title is required.')
            return
        }
        const result = await createStationeryProcurementRequest({
            title: title.trim(),
            amount,
            minorPurchase: minor,
            department: 'Stores',
            requestedBy: 'Stores Manager',
            primaryApprover: 'Joint Director Operations',
        })
        if (result?.success === false) {
            toast.error(result.message || 'Could not create request.')
            return
        }
        setTitle('')
        setAmount('')
        refresh()
        toast.success('Request saved to stationery procurement.')
    }

    const advance = async (id) => {
        const result = await advanceStationeryProcurement(id)
        if (result?.success === false) {
            toast.error(result.message || 'Could not advance workflow.')
            return
        }
        refresh()
        toast.success('Workflow advanced.')
    }

    const orders = getStationeryPurchaseOrders(rows)

    return (
        <section className='space-y-6'>
            <div className='bg-white rounded-2xl shadow-md p-4'>
                <h2 className='text-xl font-semibold text-black'>Purchase workflow</h2>
                <p className='text-sm text-[#667085] mt-1'>Stationery store of record. Primary approver: Joint Director Operations.</p>
                <p className='text-xs text-[#808080] mt-2'>{PROCUREMENT_STATUSES.join(' → ')}</p>
                <button type='button' onClick={downloadQuotationTemplate} className='mt-3 text-sm text-[#515DEF] underline cursor-pointer'>Download comparative quotation template</button>
                <form onSubmit={create} className='grid grid-cols-1 md:grid-cols-4 gap-3 mt-4'>
                    <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder='Request title' className='border border-[#D9D9D9] rounded-md px-2 py-2 text-sm' />
                    <input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder='Amount' type='number' className='border border-[#D9D9D9] rounded-md px-2 py-2 text-sm' />
                    <label className='text-sm flex items-center gap-2'>
                        <input type='checkbox' checked={minor} onChange={(event) => setMinor(event.target.checked)} />
                        Minor purchase
                    </label>
                    <button type='submit' className='bg-[#515DEF] text-white rounded-md text-sm cursor-pointer'>Create request</button>
                </form>
            </div>
            <div className='bg-white rounded-2xl shadow-md p-4 overflow-x-auto'>
                <table className='w-full text-sm text-left'>
                    <thead className='text-xs bg-[#EDEEF5]'>
                        <tr>
                            {['Request', 'Title', 'Amount', 'Status', 'PO', 'Action'].map((label) => (
                                <th key={label} className='px-2 py-3 text-[#0C1E5B] uppercase'>{label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && (
                            <tr><td colSpan={6} className='px-2 py-6 text-center text-[#667085]'>No stationery purchase requests yet.</td></tr>
                        )}
                        {rows.map((row) => (
                            <tr key={row.id} className='border-b border-[#f2f4f7]'>
                                <td className='px-2 py-3'>{row.id}</td>
                                <td className='px-2 py-3'>{row.title}</td>
                                <td className='px-2 py-3'>{row.amount}</td>
                                <td className='px-2 py-3'><StatusBadge status={row.status} /></td>
                                <td className='px-2 py-3'>{row.poNumber || '—'}</td>
                                <td className='px-2 py-3'>
                                    <button type='button' onClick={() => advance(row.id)} className='text-[#515DEF] text-xs cursor-pointer'>Advance</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <h3 className='text-base font-semibold mt-6 mb-2'>Purchase orders</h3>
                <ul className='text-sm text-[#667085] space-y-1'>
                    {orders.length === 0 && <li>No purchase orders yet.</li>}
                    {orders.map((order) => <li key={order.id}>{order.id} · {order.requestId} · {order.status} · ₹{order.amount}</li>)}
                </ul>
            </div>
        </section>
    )
}

export default PurchaseWorkflow
