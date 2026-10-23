from datetime import date
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    must_change_password: bool


class OtpChallengeRequest(BaseModel):
    email: EmailStr


class OtpVerifyRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1)
    # Strength rules live in app.core.passwords so the API returns one clear message.
    new_password: str = Field(min_length=1, max_length=128)


class CampusOut(BaseModel):
    id: UUID
    code: str
    name: str
    city: str

    model_config = {"from_attributes": True}


class MeResponse(BaseModel):
    id: UUID
    email: EmailStr
    role: str
    role_name: str
    campus: CampusOut | None
    permissions: list[str]
    must_change_password: bool
    is_active: bool


class AcademicYearCreate(BaseModel):
    name: str = Field(min_length=4, max_length=50)
    start_date: date | None = None
    end_date: date | None = None
    is_current: bool = False


class AcademicYearUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=4, max_length=50)
    start_date: date | None = None
    end_date: date | None = None
    is_current: bool | None = None
    is_active: bool | None = None


class AcademicYearOut(BaseModel):
    id: UUID
    name: str
    start_date: date | None
    end_date: date | None
    is_current: bool
    is_active: bool = True

    model_config = {"from_attributes": True}


class FinancialYearCreate(BaseModel):
    name: str = Field(min_length=4, max_length=50)
    start_date: date
    end_date: date
    is_current: bool = False


class FinancialYearUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=4, max_length=50)
    start_date: date | None = None
    end_date: date | None = None
    is_current: bool | None = None
    is_active: bool | None = None


class FinancialYearOut(BaseModel):
    id: UUID
    name: str
    start_date: date
    end_date: date
    is_current: bool
    is_active: bool = True

    model_config = {"from_attributes": True}


class ClassCreate(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    section: str | None = None
    academic_year_id: UUID | None = None


class ClassUpdate(BaseModel):
    """A class row is identified by name + academic year, so neither can be edited here: students,
    admissions and attendance refer to the class by name. Edit a class's sections for capacity, room
    and class teacher; use this to deactivate or reactivate the class."""

    is_active: bool | None = None


class ClassOut(BaseModel):
    id: UUID
    name: str
    section: str | None
    academic_year_id: UUID | None = None
    is_active: bool = True
    # Derived: the sum of the capacities of the class's active sections that have one. None when no
    # section has a capacity. Not stored, so it can never disagree with the sections.
    capacity: int | None = None

    model_config = {"from_attributes": True}


class ClassTeacherOptionOut(BaseModel):
    """A login that may be chosen as a class teacher."""

    user_id: UUID
    email: str
    name: str | None = None
    role: str


class SectionCreate(BaseModel):
    class_id: UUID
    name: str = Field(min_length=1, max_length=20)
    capacity: int | None = Field(default=None, ge=1, le=1000)
    room_number: str | None = Field(default=None, max_length=20)
    class_teacher_user_id: UUID | None = None


class SectionUpdate(BaseModel):
    """Send only what changes. For capacity, room_number and class_teacher_user_id an explicit null
    clears the value, while leaving the field out keeps it."""

    name: str | None = Field(default=None, min_length=1, max_length=20)
    is_active: bool | None = None
    capacity: int | None = Field(default=None, ge=1, le=1000)
    room_number: str | None = Field(default=None, max_length=20)
    class_teacher_user_id: UUID | None = None


class SectionOut(BaseModel):
    id: UUID
    class_id: UUID
    name: str
    is_active: bool = True
    capacity: int | None = None
    room_number: str | None = None
    class_teacher_user_id: UUID | None = None
    # Display only, resolved from the login and its HR record at read time. Never stored on the section.
    class_teacher_name: str | None = None
    class_teacher_email: str | None = None

    model_config = {"from_attributes": True}


class SubjectCreate(BaseModel):
    code: str = Field(min_length=1, max_length=20)
    name: str = Field(min_length=1, max_length=120)


class SubjectOut(BaseModel):
    id: UUID
    code: str
    name: str

    model_config = {"from_attributes": True}


class EnquiryCreate(BaseModel):
    student_name: str
    class_name: str
    guardian_name: str
    guardian_phone: str


class EnquiryOut(BaseModel):
    id: UUID
    student_name: str
    class_name: str
    guardian_name: str
    guardian_phone: str
    status: str

    model_config = {"from_attributes": True}


class StudentOut(BaseModel):
    id: UUID
    admission_number: str
    full_name: str
    class_name: str

    model_config = {"from_attributes": True}


class GuardianOut(BaseModel):
    id: UUID
    full_name: str
    phone: str
    relationship: str

    model_config = {"from_attributes": True}


class EnrollOut(BaseModel):
    student: StudentOut
    guardian: GuardianOut


class EmployeeCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: str | None = None
    department: str | None = None
    designation: str | None = None
    joining_date: str | None = None
    status: str | None = None
    employment_type: str | None = None
    category: str | None = None
    gross_salary: int | None = None


class EmployeeOut(BaseModel):
    id: UUID
    employee_code: str
    first_name: str
    last_name: str
    # Plain str: stored demo/audit addresses may use reserved TLDs (e.g. .local)
    # that EmailStr rejects; create still validates with EmailStr where appropriate.
    email: str
    phone: str | None = None
    department: str | None = None
    designation: str | None = None
    joining_date: str | None = None
    status: str | None = None
    employment_type: str | None = None
    category: str | None = None
    gross_salary: int | None = None

    model_config = {"from_attributes": True}
