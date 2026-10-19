import EmployeeDatabaseListView from '../../../Common/UserDatabase/EmployeeDatabaseListView'
import { ROUTE_BASE, isTeacherDatabaseRecord } from './teacherDatabaseData'

const TeachersList = () => (
    <EmployeeDatabaseListView
        routeBase={ROUTE_BASE}
        title='Teacher Database'
        subtitle='Teachers from HR (role Teacher) and teacher logins from User Creation appear here.'
        recordFilter={isTeacherDatabaseRecord}
        showDepartmentFilter={false}
        emptyMessage='No teachers found yet. Accept a teacher offer in HR or create a teacher login, then refresh.'
    />
)

export default TeachersList
