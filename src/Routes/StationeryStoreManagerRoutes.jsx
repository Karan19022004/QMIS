import React from 'react'
import { Route, Routes as ReactRoutes, Navigate } from 'react-router-dom'
import Dashboard from '../Pages/StationeryStoreManager/Dashboard/Dashboard'
import Inventory from '../Pages/StationeryStoreManager/Inventory/Inventory'
import AddInventory from '../Pages/StationeryStoreManager/Inventory/AddInventory'
import ViewInventoryItem from '../Pages/StationeryStoreManager/Inventory/ViewInventoryItem'
import IssueReturnsList from '../Pages/StationeryStoreManager/IssueReturns/IssueReturnsList'
import AddIssueReturn from '../Pages/StationeryStoreManager/IssueReturns/AddIssueReturn'
import ViewIssueReturn from '../Pages/StationeryStoreManager/IssueReturns/ViewIssueReturn'
import RequestsApprovalsList from '../Pages/StationeryStoreManager/RequestsApprovals/RequestsApprovalsList'
import AddRequest from '../Pages/StationeryStoreManager/RequestsApprovals/AddRequest'
import ViewRequest from '../Pages/StationeryStoreManager/RequestsApprovals/ViewRequest'
import Reports from '../Pages/StationeryStoreManager/Reports/Reports'
import AnnouncementList from '../Pages/StationeryStoreManager/Announcement/AnnouncementList'
import ViewAnnouncement from '../Pages/StationeryStoreManager/Announcement/ViewAnnouncement'
import Requirements from '../Pages/StationeryStoreManager/Requirements/Requirements'
import StockIssue from '../Pages/StationeryStoreManager/StockIssue/StockIssue'
import CriticalAlerts from '../Pages/StationeryStoreManager/CriticalAlerts/CriticalAlerts'
import PurchaseWorkflow from '../Pages/StationeryStoreManager/PurchaseWorkflow/PurchaseWorkflow'

const StationeryStoreManagerRoutes = () => {
    return (
        <ReactRoutes>
            <Route path="/stationery-store-manager/dashboard" element={<Dashboard />} />
            <Route path="/stationery-store-manager/inventory" element={<Inventory />} />
            <Route path="/stationery-store-manager/inventory/add-item" element={<AddInventory />} />
            <Route path="/stationery-store-manager/inventory/view-item/:id" element={<ViewInventoryItem />} />
            <Route path="/stationery-store-manager/issue-returns" element={<IssueReturnsList />} />
            <Route path="/stationery-store-manager/issue-returns/add" element={<AddIssueReturn />} />
            <Route path="/stationery-store-manager/issue-returns/view/:id" element={<ViewIssueReturn />} />
            <Route path="/stationery-store-manager/requests-approvals" element={<RequestsApprovalsList />} />
            <Route path="/stationery-store-manager/requests-approvals/add-request" element={<AddRequest />} />
            <Route path="/stationery-store-manager/requests-approvals/view-request/:id" element={<ViewRequest />} />
            <Route path="/stationery-store-manager/reports" element={<Reports />} />
            <Route path="/stationery-store-manager/broadcast" element={<AnnouncementList />} />
            <Route path="/stationery-store-manager/broadcast/view-broadcast/:id" element={<ViewAnnouncement />} />
            <Route path="/stationery-store-manager/requirements" element={<Requirements />} />
            <Route path="/stationery-store-manager/stock-issue" element={<StockIssue />} />
            <Route path="/stationery-store-manager/critical-alerts" element={<CriticalAlerts />} />
            <Route path="/stationery-store-manager/purchase-workflow" element={<PurchaseWorkflow />} />
            <Route path="*" element={<Navigate to="/stationery-store-manager/dashboard" replace />} />
        </ReactRoutes>
    )
}

export default StationeryStoreManagerRoutes
