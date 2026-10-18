import React from 'react'
import { Download } from 'lucide-react'
import {
    COMPLIANCE_DOCS,
    COMPLIANCE_SUMMARY,
    complianceStatusBadgeColor,
} from '../transportFinanceData'
import {
    SummaryCards,
    TableCard,
    TablePagination,
    tdClass,
    thClass,
} from './TransportShared'
import { useFinance } from '../../financeDomain/FinanceContext'

const ComplianceTab = () => {
    const { financePersistence } = useFinance()
    const apiLive = Boolean(financePersistence?.apiEnabled)

    if (apiLive) {
        return (
            <div className='space-y-6'>
                <p className='text-sm text-[#667085] bg-[#F8FAFC] border border-[#E4E7EC] rounded-xl px-4 py-3'>
                    Compliance documents are not stored on the finance snapshot. Offline demo register is hidden in API mode.
                </p>
                <SummaryCards cards={[
                    { label: 'Documents on snapshot', value: '0', sub: 'No compliance collection yet', iconTone: 'warning' },
                    { label: 'Expiring soon', value: '—', sub: 'Awaiting transport ops API', iconTone: 'warning' },
                    { label: 'Mode', value: 'API', sub: 'Honest empty — no demo seed', iconTone: 'success' },
                    { label: 'Next step', value: 'Ops API', sub: 'Wire when transport compliance endpoints land', iconTone: 'info' },
                ]} />
            </div>
        )
    }

    return (
    <div className='space-y-6'>
        <p className='text-sm text-[#B8860B] bg-[#FFF8E7] border border-[#F5E6B8] rounded-xl px-4 py-3'>
            OFFLINE DEMO — compliance documents are local demo data, not the campus finance snapshot.
        </p>
        <SummaryCards cards={COMPLIANCE_SUMMARY} />

        <TableCard
            title='Compliance & documentation register'
            filters={(
                <div className='flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3'>
                    <select className='text-sm border border-[#D9D9D9] rounded-md px-3 py-2 min-w-[150px]'>
                        <option>All Types</option>
                        <option>Insurance</option>
                        <option>Fitness Cert.</option>
                        <option>Permit</option>
                        <option>Pollution Cert.</option>
                        <option>Driver License</option>
                    </select>
                    <select className='text-sm border border-[#D9D9D9] rounded-md px-3 py-2 min-w-[130px]'>
                        <option>All Status</option>
                        <option>Valid</option>
                        <option>Expiring Soon</option>
                        <option>Expired</option>
                    </select>
                    <button type='button' className='inline-flex items-center gap-2 text-sm font-medium text-[#515DEF] border border-[#515DEF] px-4 py-2 rounded-md cursor-pointer'>
                        <Download size={16} />
                        Export
                    </button>
                </div>
            )}
            footer={<TablePagination summary={`${COMPLIANCE_DOCS.length} documents`} />}
        >
            <table className='w-full text-sm text-left mt-4'>
                <thead className='text-xs bg-[#EDEEF5] whitespace-nowrap rounded-lg'>
                    <tr>
                        <th className={`${thClass} rounded-s-lg`}>Document</th>
                        <th className={thClass}>Vehicle / Driver</th>
                        <th className={thClass}>Valid till</th>
                        <th className={`${thClass} rounded-e-lg`}>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {COMPLIANCE_DOCS.map((row) => (
                        <tr key={row.id} className='border-b border-[#f2f4f7]'>
                            <td className={`${tdClass} rounded-s-lg`}>{row.docType}</td>
                            <td className={tdClass}>{row.entity}</td>
                            <td className={tdClass}>{row.validTill}</td>
                            <td className={`${tdClass} rounded-e-lg`}>
                                <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${complianceStatusBadgeColor[row.status] || ''}`}>
                                    {row.status}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </TableCard>
    </div>
    )
}

export default ComplianceTab
