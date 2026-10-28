import React from 'react'
import { Route, Routes as ReactRoutes, Navigate, useLocation } from 'react-router-dom'
import Dashboard from '../Pages/AccountHead/Dashboard/Dashboard'
import FeesManagement from '../Pages/AccountHead/FeesManagement/FeesManagement'
import TransportFinance from '../Pages/AccountHead/TransportFinance/TransportFinance'
import Collections from '../Pages/AccountHead/Collections/Collections'
import AdmissionReferrals from '../Pages/AccountHead/Referrals/AdmissionReferrals'
import WalletManagement from '../Pages/AccountHead/WalletManagement/WalletManagement'
import Accounting from '../Pages/AccountHead/Accounting/Accounting'
import Approvals from '../Pages/AccountHead/Approvals/Approvals'
import ReportsAnalytics from '../Pages/AccountHead/ReportsAnalytics/ReportsAnalytics'
import Settings from '../Pages/AccountHead/Settings/Settings'
import { TaskManagementRoutes } from '../Common/TaskManagement/TaskManagementRoutes'
import { BookFeePage, BudgetPage, FeeProjectionPanel, MfpPlaceholder } from '../Common/demoDomain/DemoScreens'
import PaymentVouchers from '../Pages/AccountHead/PaymentVouchers/PaymentVouchers'
import { useAuth } from '../context/AuthContext'
import { ROLES } from '../constants/roles'
import { isFinanceHeadOnlyPath } from '../Pages/AccountHead/financeDomain/financeRoleAccess'

const HeadOnlyOr = ({ children }) => {
    const { role } = useAuth()
    const { pathname } = useLocation()
    if (role === ROLES.FINANCE_ASSISTANT && isFinanceHeadOnlyPath(pathname)) {
        return <Navigate to="/account-head/dashboard" replace />
    }
    return children
}

const AccountHeadRoutes = () => {
    return (
        <ReactRoutes>
            <Route path="/account-head/dashboard" element={<Dashboard />} />
            <Route path="/account-head/fees-management" element={<FeesManagement />} />
            <Route path="/account-head/transport-finance" element={<TransportFinance />} />
            <Route path="/account-head/collections" element={<Collections />} />
            <Route path="/account-head/admission-referrals" element={<HeadOnlyOr><AdmissionReferrals /></HeadOnlyOr>} />
            <Route path="/account-head/wallet-management" element={<WalletManagement />} />
            <Route path="/account-head/accounting" element={<Navigate to="/account-head/accounting/day-book" replace />} />
            <Route path="/account-head/accounting/:section" element={<Accounting />} />
            <Route path="/account-head/approvals" element={<HeadOnlyOr><Approvals /></HeadOnlyOr>} />
            <Route path="/account-head/reports-analytics" element={<ReportsAnalytics />} />
            <Route path="/account-head/settings" element={<HeadOnlyOr><Settings /></HeadOnlyOr>} />
            <Route path="/account-head/payment-vouchers" element={<HeadOnlyOr><PaymentVouchers /></HeadOnlyOr>} />
            <Route path="/account-head/book-fee" element={<HeadOnlyOr><BookFeePage /></HeadOnlyOr>} />
            <Route path="/account-head/annual-budget" element={<HeadOnlyOr><BudgetPage /></HeadOnlyOr>} />
            <Route path="/account-head/mfp" element={<HeadOnlyOr><MfpPlaceholder /></HeadOnlyOr>} />
            <Route path="/account-head/fee-projection" element={<HeadOnlyOr><FeeProjectionPanel /></HeadOnlyOr>} />
            {TaskManagementRoutes({ basePath: '/account-head' })}
            <Route path="*" element={<Navigate to="/account-head/dashboard" replace />} />
        </ReactRoutes>
    )
}

export default AccountHeadRoutes
