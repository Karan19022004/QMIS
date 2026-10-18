import React, { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { OVERVIEW_SUMMARY } from '../collectionsData'
import { FlowBars, Panel, SummaryCards } from './CollectionsShared'
import { useFinance } from '../../financeDomain/FinanceContext'
import { formatCurrency } from '../../financeDomain/financeHelpers'
import { buildMoneyFlowSources, buildMonthlyFlowTrend } from '../../financeDomain/financeLiveViews'

const OverviewTab = () => {
    const { dashboardMetrics, postedInflow, transactions, financePersistence } = useFinance()
    const apiLive = Boolean(financePersistence?.apiEnabled)

    const summaryCards = useMemo(() => {
        const inflow = (postedInflow || []).reduce((sum, row) => sum + Number(row.amount || 0), 0)
        const outflow = (transactions || [])
            .filter((row) => row.direction === 'OUT' && row.status === 'POSTED')
            .reduce((sum, row) => sum + Number(row.amount || 0), 0)
        const net = inflow - outflow
        return OVERVIEW_SUMMARY.map((card) => {
            if (card.label === 'Total Inflow') {
                return { ...card, value: formatCurrency(inflow), sub: apiLive ? 'Posted IN (snapshot)' : 'Live posted inflow' }
            }
            if (card.label === 'Total Outflow') {
                return { ...card, value: formatCurrency(outflow), sub: apiLive ? 'Posted OUT (snapshot)' : 'Live posted outflow' }
            }
            if (card.label === 'Net Position') {
                return { ...card, value: formatCurrency(net), sub: 'Inflow − outflow', subTone: net >= 0 ? 'success' : 'danger' }
            }
            if (card.label === 'Closing Balance') {
                return { ...card, value: formatCurrency(dashboardMetrics?.currentDue ?? 0), sub: 'Outstanding fee dues' }
            }
            return card
        })
    }, [apiLive, dashboardMetrics, postedInflow, transactions])

    const sources = useMemo(() => buildMoneyFlowSources(transactions || []), [transactions])
    const trend = useMemo(() => buildMonthlyFlowTrend(transactions || [], 6), [transactions])

    const inflowOutflowOption = useMemo(() => ({
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params) => {
                const lines = (params || []).map((item) => `${item.seriesName}: ${formatCurrency(item.value || 0)}`)
                return `${params?.[0]?.axisValue || ''}<br/>${lines.join('<br/>')}`
            },
        },
        legend: {
            data: ['Inflow', 'Outflow'],
            bottom: 0,
            textStyle: { color: '#667085', fontSize: 11 },
        },
        grid: { left: 48, right: 16, top: 16, bottom: 48 },
        xAxis: {
            type: 'category',
            data: trend.labels,
            axisLine: { lineStyle: { color: '#E0E0E0' } },
            axisLabel: { color: '#667085', fontSize: 11 },
        },
        yAxis: {
            type: 'value',
            axisLabel: {
                color: '#667085',
                fontSize: 11,
                formatter: (v) => (v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : `₹${Math.round(v / 1000)}k`),
            },
            splitLine: { lineStyle: { color: '#F2F4F7' } },
        },
        series: [
            {
                name: 'Inflow',
                type: 'bar',
                barWidth: 18,
                data: trend.inflow,
                itemStyle: { color: '#4CAF50', borderRadius: [4, 4, 0, 0] },
            },
            {
                name: 'Outflow',
                type: 'bar',
                barWidth: 18,
                data: trend.outflow,
                itemStyle: { color: '#FF5722', borderRadius: [4, 4, 0, 0] },
            },
        ],
    }), [trend])

    return (
        <div className='space-y-6'>
            <SummaryCards cards={summaryCards} />

            <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
                <Panel title='Where money is coming from'>
                    {sources.moneyIn.length ? (
                        <FlowBars items={sources.moneyIn} />
                    ) : (
                        <p className='text-sm text-[#667085] py-6 text-center'>No posted inflow categories in the snapshot yet.</p>
                    )}
                </Panel>

                <Panel title='Where money is going'>
                    {sources.moneyOut.length ? (
                        <FlowBars items={sources.moneyOut} />
                    ) : (
                        <p className='text-sm text-[#667085] py-6 text-center'>No posted outflow categories in the snapshot yet.</p>
                    )}
                </Panel>
            </div>

            <Panel title='Inflow vs outflow — last 6 months (snapshot)'>
                <ReactECharts option={inflowOutflowOption} style={{ height: 260 }} opts={{ renderer: 'svg' }} />
            </Panel>
        </div>
    )
}

export default OverviewTab
