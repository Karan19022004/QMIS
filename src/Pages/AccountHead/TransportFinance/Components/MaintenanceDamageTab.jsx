import React from 'react'
import { Download, Plus, Search } from 'lucide-react'
import {
    DAMAGE_BREAKDOWN,
    MAINTENANCE_RECORDS,
    MAINTENANCE_SPEND,
    MAINTENANCE_SUMMARY,
    maintenanceStatusBadgeColor,
    maintenanceTypeBadgeColor,
} from '../transportFinanceData'
import {
    Panel,
    SummaryCards,
    TableCard,
    TablePagination,
    tdClass,
    thClass,
} from './TransportShared'
import { useFinance } from '../../financeDomain/FinanceContext'

const MaintenanceDamageTab = ({ onLogDamage }) => {
    const { financePersistence } = useFinance()
    const apiLive = Boolean(financePersistence?.apiEnabled)

    if (apiLive) {
        return (
            <div className='space-y-6'>
                <p className='text-sm text-[#667085] bg-[#F8FAFC] border border-[#E4E7EC] rounded-xl px-4 py-3'>
                    Maintenance & damage registers are not part of the finance snapshot API yet.
                    Use Fleet / Fuel claims for snapshot-backed transport spend. Offline demo tables are hidden in API mode.
                </p>
                <SummaryCards cards={[
                    { label: 'Snapshot coverage', value: 'Not available', sub: 'No maintenance collection on /finance/state', iconTone: 'warning' },
                    { label: 'Damage log', value: '—', sub: 'Awaiting ops transport API', iconTone: 'warning' },
                    { label: 'Vehicles tracked', value: '—', sub: 'Use Fleet & Service tab', iconTone: 'info' },
                    { label: 'Mode', value: 'API', sub: 'Honest empty — no demo seed', iconTone: 'success' },
                ]} />
            </div>
        )
    }

    return (
    <div className='space-y-6'>
        <p className='text-sm text-[#B8860B] bg-[#FFF8E7] border border-[#F5E6B8] rounded-xl px-4 py-3'>
            OFFLINE DEMO — maintenance & damage registers are local demo data, not the campus finance snapshot.
        </p>
        <SummaryCards cards={MAINTENANCE_SUMMARY} />

        <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            <Panel
                title='Maintenance spend by vehicle'
                action={(
                    <button type='button' className='text-sm font-medium text-[#515DEF] hover:opacity-80 cursor-pointer'>
                        Full report
                    </button>
                )}
            >
                <div className='space-y-4'>
                    {MAINTENANCE_SPEND.map((item) => (
                        <div key={item.vehicle}>
                            <div className='flex items-center justify-between text-sm mb-1.5'>
                                <span className='text-[#667085]'>{item.vehicle}</span>
                                <span className='font-semibold text-[#1E1E1E]'>{item.amount}</span>
                            </div>
                            <div className='h-2 rounded-full bg-[#EDEEF5] overflow-hidden'>
                                <div
                                    className={`h-full rounded-full ${item.warn ? 'bg-[#FF5722]' : 'bg-[#515DEF]'}`}
                                    style={{ width: `${item.value}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </Panel>
            <Panel title='Damage breakdown'>
                <div className='space-y-3'>
                    {DAMAGE_BREAKDOWN.map((item) => (
                        <div key={item.label} className='flex items-center justify-between text-sm'>
                            <span className='text-[#667085]'>{item.label}</span>
                            <span className='font-semibold text-[#1E1E1E]'>{item.amount}</span>
                        </div>
                    ))}
                </div>
            </Panel>
        </div>

        <TableCard
            title='Maintenance & damage records'
            filters={(
                <div className='flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3'>
                    <div className='relative min-w-[160px]'>
                        <Search size={16} className='absolute left-3 top-1/2 -translate-y-1/2 text-[#808080]' />
                        <input type='text' placeholder='Search vehicle...' className='w-full text-sm border border-[#D9D9D9] rounded-md pl-9 pr-3 py-2' />
                    </div>
                    <button
                        type='button'
                        onClick={onLogDamage}
                        className='inline-flex items-center gap-2 bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md hover:opacity-90 cursor-pointer'
                    >
                        <Plus size={16} />
                        Log damage
                    </button>
                    <button type='button' className='inline-flex items-center gap-2 text-sm font-medium text-[#515DEF] border border-[#515DEF] px-4 py-2 rounded-md cursor-pointer'>
                        <Download size={16} />
                        Export
                    </button>
                </div>
            )}
            footer={<TablePagination summary={`${MAINTENANCE_RECORDS.length} records`} />}
        >
            <table className='w-full text-sm text-left mt-4'>
                <thead className='text-xs bg-[#EDEEF5] whitespace-nowrap rounded-lg'>
                    <tr>
                        <th className={`${thClass} rounded-s-lg`}>Vehicle</th>
                        <th className={thClass}>Type</th>
                        <th className={thClass}>Status</th>
                        <th className={`${thClass} rounded-e-lg`}>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {MAINTENANCE_RECORDS.map((row) => (
                        <tr key={row.id} className='border-b border-[#f2f4f7]'>
                            <td className={`${tdClass} rounded-s-lg`}>{row.vehicle}</td>
                            <td className={tdClass}>
                                <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${maintenanceTypeBadgeColor[row.type] || ''}`}>{row.type}</span>
                            </td>
                            <td className={tdClass}>
                                <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${maintenanceStatusBadgeColor[row.status] || ''}`}>{row.status}</span>
                            </td>
                            <td className={`${tdClass} rounded-e-lg font-semibold`}>{row.cost}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </TableCard>
    </div>
    )
}

export default MaintenanceDamageTab
