import React, { useEffect, useState } from 'react'
import { StatusBadge } from '../../../Common/demoDomain/statusBadge'
import { getStationeryCriticalAlerts, syncStationeryCriticalAlerts } from './criticalAlertsData'

const CriticalAlerts = () => {
    const [rows, setRows] = useState(() => getStationeryCriticalAlerts())

    useEffect(() => {
        let active = true
        syncStationeryCriticalAlerts().finally(() => {
            if (active) setRows(getStationeryCriticalAlerts())
        })
        return () => { active = false }
    }, [])

    return (
        <div className='bg-white rounded-2xl shadow-md p-4 overflow-x-auto'>
            <h2 className='text-xl font-semibold mb-1'>Critical inventory alerts</h2>
            <p className='text-sm text-[#667085] mb-4'>Derived from stationery inventory low / out-of-stock items and persisted to campus stores.</p>
            <table className='w-full text-sm'>
                <thead className='text-xs bg-[#EDEEF5]'>
                    <tr>{['Module', 'Item', 'Requirement', 'Available', 'Difference', 'Status'].map((label) => <th key={label} className='px-2 py-3 text-left'>{label}</th>)}</tr>
                </thead>
                <tbody>
                    {rows.length === 0 && (
                        <tr><td colSpan={6} className='px-2 py-6 text-center text-[#667085]'>No critical stationery alerts.</td></tr>
                    )}
                    {rows.map((row) => (
                        <tr key={row.id || row.item} className='border-b border-[#f2f4f7]'>
                            <td className='px-2 py-3'>{row.module}</td>
                            <td className='px-2 py-3'>{row.item}</td>
                            <td className='px-2 py-3'>{row.required}</td>
                            <td className='px-2 py-3'>{row.actual}</td>
                            <td className='px-2 py-3'>{row.difference}</td>
                            <td className='px-2 py-3'><StatusBadge status={row.status} /></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

export default CriticalAlerts
