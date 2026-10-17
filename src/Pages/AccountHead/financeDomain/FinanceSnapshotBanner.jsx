import React from 'react'
import { useFinance } from './FinanceContext'

/**
 * Honest campus-snapshot status line for Account Head modules.
 * Does not invent KPIs — only reflects FinanceContext API/offline mode.
 */
const FinanceSnapshotBanner = ({ mockNote = '' }) => {
    const { financePersistence, financeStatus, financeError } = useFinance()
    const apiLive = Boolean(financePersistence?.apiEnabled)

    const base = apiLive
        ? `Campus finance snapshot (${financeStatus}${financeError ? ` — ${financeError}` : ''}).`
        : 'Offline demo mode — enable Finance API for live campus figures.'

    return (
        <p className='text-sm text-[#667085] mt-1'>
            {base}
            {mockNote ? ` ${mockNote}` : ''}
        </p>
    )
}

export default FinanceSnapshotBanner
