from app.models.academics import AcademicYear, FinancialYear, SchoolClass, Section, Subject
from app.models.admission import Admission, AdmissionEnquiry, Guardian, Student
from app.models.approval import ApprovalEvent, ApprovalRequest, Notification
from app.models.escalation import Escalation, Task, TaskEvent
from app.models.exams import Exam, ExamType, ExamWeightage, MarkEntry, MarksBatch
from app.models.leave import LeaveRequest
from app.models.lesson_plan import LessonPlan
from app.models.attendance import StudentAttendance
from app.models.audit import AuditLog
from app.models.base import Base
from app.models.campus import Campus
from app.models.file_asset import FileAsset
from app.models.finance import FinanceRecord
from app.models.hr_employee import HrEmployee
from app.models.hr_record import HrRecord
from app.models.otp import OtpChallenge
from app.models.role import Permission, Role, RolePermission
from app.models.user import User

__all__ = [
    "AcademicYear",
    "FinancialYear",
    "Admission",
    "AdmissionEnquiry",
    "ApprovalEvent",
    "ApprovalRequest",
    "AuditLog",
    "Base",
    "Campus",
    "FileAsset",
    "FinanceRecord",
    "Guardian",
    "HrEmployee",
    "Escalation",
    "Exam",
    "ExamType",
    "ExamWeightage",
    "HrRecord",
    "LeaveRequest",
    "LessonPlan",
    "MarkEntry",
    "MarksBatch",
    "Notification",
    "OtpChallenge",
    "Permission",
    "Role",
    "RolePermission",
    "SchoolClass",
    "Section",
    "Student",
    "StudentAttendance",
    "Subject",
    "Task",
    "TaskEvent",
    "User",
]
