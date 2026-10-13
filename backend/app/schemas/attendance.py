from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field


class AttendanceMarkIn(BaseModel):
    student_id: UUID = Field(alias="studentId")
    status: str = Field(min_length=1, max_length=20)
    in_out_status: str | None = Field(default=None, alias="inOutStatus")

    model_config = {"populate_by_name": True}


class AttendanceUpsertIn(BaseModel):
    date: date
    class_name: str = Field(alias="className", min_length=1, max_length=40)
    section: str | None = Field(default=None, max_length=20)
    marks: list[AttendanceMarkIn] = Field(min_length=1)

    model_config = {"populate_by_name": True}
