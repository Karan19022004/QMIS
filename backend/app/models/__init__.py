from app.models.academics import AcademicYear, FinancialYear, SchoolClass, Section, Subject
from app.models.admission import Admission, AdmissionEnquiry, Guardian, Student
from app.models.activities import Activity, ActivityPlayer
from app.models.announcements import Announcement, AnnouncementReply, AnnouncementResponse
from app.models.calendar import CalendarEvent
from app.models.communication import Conversation, ConversationParticipant, Message
from app.models.tc_requests import TcRequest
from app.models.approval import ApprovalEvent, ApprovalRequest, Notification
from app.models.escalation import Escalation, Task, TaskEvent
from app.models.exams import Exam, ExamType, ExamWeightage, MarkEntry, MarksBatch
from app.models.leave import LeaveRequest
from app.models.lesson_plan import LessonPlan
from app.models.attendance import StudentAttendance
from app.models.audit import AuditLog
from app.models.base import Base
from app.models.campus import Campus
from app.models.documents import DocumentItem, DocumentRecord
from app.models.file_asset import FileAsset
from app.models.finance import FinanceRecord
from app.models.front_office import FrontOfficeRecord
from app.models.hr_employee import HrEmployee
from app.models.hr_record import HrRecord
from app.models.otp import OtpChallenge
from app.models.role import Permission, Role, RolePermission
from app.models.user import User
from app.models.user_profile import UserProfile

__all__ = [
    "AcademicYear",
    "Activity",
    "ActivityPlayer",
    "FinancialYear",
    "Admission",
    "AdmissionEnquiry",
    "Announcement",
    "AnnouncementReply",
    "AnnouncementResponse",
    "ApprovalEvent",
    "ApprovalRequest",
    "AuditLog",
    "Base",
    "CalendarEvent",
    "Campus",
    "Conversation",
    "ConversationParticipant",
    "DocumentItem",
    "DocumentRecord",
    "FileAsset",
    "FinanceRecord",
    "FrontOfficeRecord",
    "Guardian",
    "HrEmployee",
    "Escalation",
    "Exam",
    "ExamType",
    "ExamWeightage",
    "HrRecord",
    "LeaveRequest",
    "LessonPlan",
    "Message",
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
    "TcRequest",
    "User",
    "UserProfile",
]
