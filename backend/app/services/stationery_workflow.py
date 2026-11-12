"""Stationery store workflows with server-side stock and approval guards.

Authoritative collections:
- stationery-inventory
- stationery-issue-returns
- stationery-requests
- stationery-procurement

Client whole-list arithmetic is not trusted for stock deduction, GRN, or JD/Finance decisions.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import role_code_for
from app.models import OpsRecord, User
from app.services.audit import write_audit
from app.services.errors import fail

INV = "stationery-inventory"
MOVEMENTS = "stationery-issue-returns"
REQUESTS = "stationery-requests"
PROCUREMENT = "stationery-procurement"
STOCK_ISSUES = "stationery-stock-issues"

_STORE = {"stationerystoremanager", "admin", "superadmin", "managing_director"}
_JD = {"jointdirector", "jointdirectorassistant", "admin", "superadmin", "managing_director"}
_FINANCE = {
    "financemanager",
    "accounthead",
    "finance_assistant",
    "accountassistant",
    "admin",
    "superadmin",
    "managing_director",
}
_REQUEST_DECIDERS = _STORE | {"principal", "director"}

# Doc §4.3-oriented statuses (aligned with existing FE labels).
STORE_ADVANCE = {
    "DRAFT": "QUOTATION_PENDING",
    "QUOTATION_PENDING": "DEPARTMENT_REVIEW",
    "PO_REQUIRED": "PO_RAISED",
    "PO_RAISED": "PO_APPROVED",
}
JD_DECISIONS = {
    "approve": "MINOR_APPROVED",
    "escalate": "ESCALATED",
    "reject": "REJECTED",
}
FINANCE_DECISIONS = {
    "approve_budget": "PO_REQUIRED",
    "reject": "REJECTED",
}


def _code(db: Session, actor: User) -> str:
    return role_code_for(db, actor)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_item(row: OpsRecord) -> dict:
    body = dict(row.body or {})
    body["id"] = row.public_id
    body["_collection"] = row.collection
    body["_updatedAt"] = row.updated_at.isoformat() if row.updated_at else None
    body["_createdAt"] = row.created_at.isoformat() if row.created_at else None
    return body


def _get_row(db: Session, campus_id, collection: str, public_id: str) -> OpsRecord | None:
    return db.scalar(
        select(OpsRecord).where(
            OpsRecord.campus_id == campus_id,
            OpsRecord.collection == collection,
            OpsRecord.public_id == str(public_id),
        )
    )


def _find_inventory(db: Session, campus_id, *, item_id: str = "", item_name: str = "") -> OpsRecord | None:
    rows = db.scalars(
        select(OpsRecord).where(
            OpsRecord.campus_id == campus_id,
            OpsRecord.collection == INV,
        )
    ).all()
    want_id = str(item_id or "").strip()
    want_name = str(item_name or "").strip().lower()
    for row in rows:
        body = row.body or {}
        if want_id and str(body.get("itemId") or body.get("id") or row.public_id) == want_id:
            return row
        if want_name and str(body.get("itemName") or body.get("item") or "").strip().lower() == want_name:
            return row
    return None


def _derive_status(qty: float, reorder) -> str:
    if qty <= 0:
        return "Out of Stock"
    try:
        level = float(reorder)
    except (TypeError, ValueError):
        level = None
    if level is not None and qty <= level:
        return "Low Stock"
    return "Available"


def _put_body(db: Session, actor: User, collection: str, public_id: str, body: dict, *, commit: bool = False) -> OpsRecord:
    payload = {key: value for key, value in body.items() if not str(key).startswith("_")}
    payload["id"] = public_id
    if collection == INV:
        payload.setdefault("itemId", public_id)
    now = _now()
    row = _get_row(db, actor.campus_id, collection, public_id)
    if row is None:
        row = OpsRecord(
            id=uuid.uuid4(),
            campus_id=actor.campus_id,
            collection=collection,
            public_id=public_id,
            body=payload,
            created_by=actor.id,
            updated_at=now,
        )
        db.add(row)
    else:
        row.body = payload
        row.updated_at = now
    if commit:
        db.commit()
        db.refresh(row)
    return row


def _require_store(db: Session, actor: User) -> str:
    code = _code(db, actor)
    if code not in _STORE:
        fail(403, "forbidden", "Only Stationery Store staff may perform this stock action.")
    return code


def record_issue_return(db: Session, actor: User, body: dict) -> dict:
    """Atomic issue/return: validate stock, write movement, update inventory once."""
    _require_store(db, actor)
    if not isinstance(body, dict):
        fail(422, "invalid_body", "Body must be a JSON object.")

    activity = str(body.get("activityType") or "Issue").strip()
    # Receiving = inbound stock (audit/dept return-to-store); Issue = Given outbound.
    if activity not in {"Issue", "Return", "Receiving", "Given"}:
        fail(422, "invalid_body", "activityType must be Issue, Given, Return, or Receiving.")
    if activity == "Given":
        activity = "Issue"

    client_key = str(body.get("clientRequestId") or body.get("idempotencyKey") or "").strip()
    if client_key:
        existing = _get_row(db, actor.campus_id, MOVEMENTS, client_key)
        if existing is not None:
            return {"success": True, "idempotent": True, "movement": _as_item(existing)}

    lines = body.get("lines")
    if not isinstance(lines, list) or not lines:
        # Single-line shorthand
        lines = [
            {
                "itemId": body.get("itemId"),
                "itemName": body.get("itemName") or body.get("item"),
                "quantity": body.get("quantity"),
            }
        ]

    department = str(body.get("department") or "").strip()
    requested_by = str(body.get("requestedBy") or body.get("employeeName") or "").strip()
    if not department or not requested_by:
        fail(422, "invalid_body", "department and requestedBy are required.")

    condition = str(body.get("condition") or "Good").strip() or "Good"
    original_ref = str(body.get("originalIssueRef") or "").strip()
    if activity == "Return" and not original_ref:
        fail(422, "invalid_body", "originalIssueRef is required for returns.")
    # Receiving does not require an original issue reference (inbound from audit/dept).

    request_id = str(body.get("requestId") or "").strip()
    material_pass_id = str(body.get("materialGatePassId") or "").strip()
    batch_id = client_key or f"IR-{uuid.uuid4().hex[:12]}"
    movements: list[dict] = []
    inventory_out: list[dict] = []

    for index, raw in enumerate(lines):
        if not isinstance(raw, dict):
            fail(422, "invalid_body", "Each line must be an object.")
        qty = raw.get("quantity")
        try:
            quantity = float(qty)
        except (TypeError, ValueError):
            fail(422, "invalid_body", "quantity must be a number.")
        if quantity <= 0 or int(quantity) != quantity:
            fail(422, "invalid_body", "quantity must be a positive whole number.")
        quantity = int(quantity)

        inv = _find_inventory(
            db,
            actor.campus_id,
            item_id=str(raw.get("itemId") or ""),
            item_name=str(raw.get("itemName") or raw.get("item") or ""),
        )
        if inv is None:
            fail(404, "not_found", f"Inventory item not found: {raw.get('itemName') or raw.get('itemId')}")

        inv_body = dict(inv.body or {})
        available = inv_body.get("availableQuantity")
        try:
            available_qty = int(float(available))
        except (TypeError, ValueError):
            available_qty = 0

        if activity == "Issue":
            if quantity > available_qty:
                fail(
                    409,
                    "insufficient_stock",
                    f"Cannot issue {quantity} of {inv_body.get('itemName')}; only {available_qty} available. Raise a purchase requirement instead.",
                )
            next_qty = available_qty - quantity
        else:
            # Lost/Damaged returns do not restock.
            if condition in {"Lost", "Damaged"}:
                next_qty = available_qty
            else:
                next_qty = available_qty + quantity

        inv_body["availableQuantity"] = next_qty
        inv_body["status"] = _derive_status(next_qty, inv_body.get("reorderLevel"))
        unit_raw = str(inv_body.get("unitCost") or "").replace("₹", "").replace(",", "").strip()
        try:
            unit = float(unit_raw) if unit_raw else 0.0
        except ValueError:
            unit = 0.0
        inv_body["stockValue"] = f"₹{int(next_qty * unit):,}"
        _put_body(db, actor, INV, inv.public_id, inv_body)
        inventory_out.append(_as_item(inv))

        movement_id = batch_id if len(lines) == 1 else f"{batch_id}-{index + 1}"
        movement = {
            "id": movement_id,
            "batchId": batch_id,
            "activityType": activity,
            "requestedBy": requested_by,
            "employeeId": str(body.get("employeeId") or ""),
            "department": department,
            "itemName": inv_body.get("itemName"),
            "itemId": inv_body.get("itemId") or inv.public_id,
            "quantity": quantity,
            "remarks": str(body.get("remarks") or ""),
            "purpose": str(body.get("purpose") or ""),
            "status": (
                "Returned" if activity == "Return"
                else "Received" if activity == "Receiving"
                else "Issued"
            ),
            "issueDate": body.get("issueDate") or (_now().date().isoformat() if activity == "Issue" else "—"),
            "returnDate": body.get("returnDate") or (
                _now().date().isoformat() if activity in {"Return", "Receiving"} else "—"
            ),
            "availableStock": next_qty,
            "originalIssueRef": original_ref if activity == "Return" else None,
            "condition": condition if activity in {"Return", "Receiving"} else None,
            "returnable": bool(body.get("returnable")),
            "expectedReturnDate": body.get("expectedReturnDate") or "",
            "requestId": request_id or None,
            "materialGatePassId": material_pass_id or None,
            "recordedByUserId": str(actor.id),
            "recordedByEmail": actor.email or "",
            "recordedAt": _now().isoformat(),
            "clientRequestId": client_key or movement_id,
        }
        _put_body(db, actor, MOVEMENTS, movement_id, movement)
        movements.append(movement)

        # Keep Stock Issue mirror in sync when issuing (single authoritative path).
        if activity == "Issue":
            issue_id = f"SSI-{movement_id}"
            _put_body(
                db,
                actor,
                STOCK_ISSUES,
                issue_id,
                {
                    "id": issue_id,
                    "item": inv_body.get("itemName"),
                    "itemId": inv_body.get("itemId") or inv.public_id,
                    "quantity": quantity,
                    "from": "Stores",
                    "to": department,
                    "issuedBy": actor.email or "Stores",
                    "receivedBy": requested_by,
                    "date": _now().date().isoformat(),
                    "status": "Issued",
                    "movementId": movement_id,
                    "requestId": request_id or None,
                    "materialGatePassId": material_pass_id or None,
                },
            )

    if request_id:
        req = _get_row(db, actor.campus_id, REQUESTS, request_id)
        if req is not None:
            req_body = dict(req.body or {})
            status = str(req_body.get("status") or "")
            if status in {"Approved", "Ready to Issue", "Partially Issued", "Pending"}:
                issued_qty = int(req_body.get("quantityIssued") or 0) + sum(
                    int(m["quantity"]) for m in movements if m["activityType"] == "Issue"
                )
                requested_qty = int(req_body.get("quantityRequested") or req_body.get("quantity") or issued_qty)
                req_body["quantityIssued"] = issued_qty
                if issued_qty >= requested_qty and requested_qty > 0:
                    req_body["status"] = "Issued"
                    req_body["currentStage"] = "Issued"
                else:
                    req_body["status"] = "Partially Issued"
                    req_body["currentStage"] = "Partially Issued"
                _put_body(db, actor, REQUESTS, request_id, req_body)

    write_audit(
        db,
        action="STATIONERY_ISSUE_RETURN",
        entity_type="stationery_movement",
        entity_id=batch_id,
        actor_id=actor.id,
        campus_id=actor.campus_id,
        details=f"{activity} x{len(movements)}",
    )
    db.commit()
    return {
        "success": True,
        "batchId": batch_id,
        "movements": movements,
        "inventory": inventory_out,
    }


def decide_request(db: Session, actor: User, request_id: str, body: dict) -> dict:
    code = _code(db, actor)
    if code not in _REQUEST_DECIDERS:
        fail(403, "forbidden", "You are not allowed to approve or reject store requests.")
    if not isinstance(body, dict):
        fail(422, "invalid_body", "Body must be a JSON object.")
    decision = str(body.get("decision") or "").strip().lower()
    if decision not in {"approve", "reject"}:
        fail(422, "invalid_body", "decision must be approve or reject.")
    comment = str(body.get("comment") or "").strip()

    row = _get_row(db, actor.campus_id, REQUESTS, request_id)
    if row is None:
        fail(404, "not_found", "Store request not found.")
    payload = dict(row.body or {})
    status = str(payload.get("status") or "Pending").strip()
    if status not in {"Pending", "Submitted", "Pending Approval", "Draft"}:
        fail(409, "invalid_state", f"Request is already {status}.")

    requester = str(payload.get("requestedByEmail") or payload.get("requesterEmail") or "").strip().lower()
    if requester and requester == (actor.email or "").strip().lower() and code not in {
        "admin",
        "superadmin",
        "managing_director",
    }:
        fail(403, "forbidden", "Self-approval is not allowed for store requests.")

    now = _now().isoformat()
    if decision == "approve":
        payload["status"] = "Approved"
        payload["currentStage"] = "Ready to Issue"
    else:
        payload["status"] = "Rejected"
        payload["currentStage"] = "Rejected"
    history = list(payload.get("decisionHistory") or [])
    history.append(
        {
            "decision": decision,
            "comment": comment,
            "decidedByUserId": str(actor.id),
            "decidedByEmail": actor.email or "",
            "decidedByRole": code,
            "decidedAt": now,
        }
    )
    payload["decisionHistory"] = history
    payload["decidedBy"] = actor.email or ""
    payload["decidedAt"] = now
    payload["decisionComment"] = comment
    _put_body(db, actor, REQUESTS, request_id, payload)
    write_audit(
        db,
        action="STATIONERY_REQUEST_DECIDE",
        entity_type="stationery_request",
        entity_id=request_id,
        actor_id=actor.id,
        campus_id=actor.campus_id,
        details=decision,
    )
    db.commit()
    db.refresh(row)
    return _as_item(row)


def decide_procurement(db: Session, actor: User, procurement_id: str, body: dict) -> dict:
    """Role-gated stage transitions for purchase workflow (§4.3)."""
    if not isinstance(body, dict):
        fail(422, "invalid_body", "Body must be a JSON object.")
    action = str(body.get("action") or body.get("decision") or "").strip().lower()
    comment = str(body.get("comment") or "").strip()
    code = _code(db, actor)

    row = _get_row(db, actor.campus_id, PROCUREMENT, procurement_id)
    if row is None:
        fail(404, "not_found", "Procurement request not found.")
    payload = dict(row.body or {})
    status = str(payload.get("status") or "DRAFT").strip().upper()
    if status in {"REJECTED", "COMPLETED", "PAID"}:
        fail(409, "invalid_state", f"Procurement is already {status}.")

    now = _now().isoformat()
    next_status = None

    if action in {"advance", "submit_quotation", "ready_for_jd"}:
        if code not in _STORE:
            fail(403, "forbidden", "Only store staff may prepare purchase stages.")
        next_status = STORE_ADVANCE.get(status)
        if not next_status:
            fail(409, "invalid_state", f"Store cannot advance from {status}.")
        if next_status == "PO_RAISED" and not payload.get("poNumber"):
            payload["poNumber"] = f"PO-ST-{uuid.uuid4().hex[:8].upper()}"
            payload["poDate"] = _now().date().isoformat()
            payload["poRaisedBy"] = actor.email or ""
    elif action in JD_DECISIONS:
        if code not in _JD:
            fail(403, "forbidden", "Only Joint Director roles may decide at this stage.")
        if status != "DEPARTMENT_REVIEW":
            fail(409, "invalid_state", "JD decisions require DEPARTMENT_REVIEW status.")
        next_status = JD_DECISIONS[action]
        if action == "approve" and not payload.get("minorPurchase", True):
            next_status = "ESCALATED"
    elif action in FINANCE_DECISIONS or action == "approve":
        # Finance budget gate before PO.
        if code not in _FINANCE:
            fail(403, "forbidden", "Only Finance may approve budget / reject at this stage.")
        if status not in {"ESCALATED", "QUOTATION_APPROVED", "MINOR_APPROVED"}:
            fail(409, "invalid_state", "Finance decisions require a JD-approved / escalated request.")
        mapped = FINANCE_DECISIONS.get(action if action in FINANCE_DECISIONS else "approve_budget")
        next_status = mapped
        if action in {"approve", "approve_budget"}:
            next_status = "PO_REQUIRED"
            payload["budgetApproved"] = True
            payload["budgetApprovedBy"] = actor.email or ""
            payload["budgetApprovedAt"] = now
    elif action == "mark_po_approved":
        if code not in _STORE | _JD | _FINANCE:
            fail(403, "forbidden", "Not allowed to mark PO approved.")
        if status != "PO_RAISED":
            fail(409, "invalid_state", "PO must be raised before approval.")
        next_status = "PO_APPROVED"
    elif action == "complete":
        if code not in _STORE:
            fail(403, "forbidden", "Only store staff may complete after goods receipt.")
        if not payload.get("grnId") and status != "PO_APPROVED":
            fail(409, "invalid_state", "Record goods receipt before completing, or start from PO_APPROVED.")
        next_status = "COMPLETED"
    elif action == "mark_paid":
        fail(
            400,
            "not_supported",
            "Payment must be recorded by Finance against a payment reference; store cannot mark paid from this screen.",
        )
    else:
        fail(422, "invalid_body", f"Unknown action: {action}")

    payload["status"] = next_status
    history = list(payload.get("decisionHistory") or [])
    history.append(
        {
            "action": action,
            "fromStatus": status,
            "toStatus": next_status,
            "comment": comment,
            "decidedByUserId": str(actor.id),
            "decidedByEmail": actor.email or "",
            "decidedByRole": code,
            "decidedAt": now,
        }
    )
    payload["decisionHistory"] = history
    _put_body(db, actor, PROCUREMENT, procurement_id, payload)
    write_audit(
        db,
        action="STATIONERY_PROCUREMENT_DECIDE",
        entity_type="stationery_procurement",
        entity_id=procurement_id,
        actor_id=actor.id,
        campus_id=actor.campus_id,
        details=f"{status}->{next_status}",
    )
    db.commit()
    db.refresh(row)
    return _as_item(row)


def receive_goods(db: Session, actor: User, procurement_id: str, body: dict) -> dict:
    """GRN: idempotent stock increase linked to a PO-approved procurement."""
    _require_store(db, actor)
    if not isinstance(body, dict):
        fail(422, "invalid_body", "Body must be a JSON object.")

    row = _get_row(db, actor.campus_id, PROCUREMENT, procurement_id)
    if row is None:
        fail(404, "not_found", "Procurement request not found.")
    payload = dict(row.body or {})
    status = str(payload.get("status") or "").upper()
    if status not in {"PO_APPROVED", "PO_RAISED", "COMPLETED"}:
        fail(409, "invalid_state", "Goods receipt requires an approved / raised purchase order.")

    grn_id = str(body.get("grnId") or payload.get("grnId") or f"GRN-{procurement_id}").strip()
    if payload.get("grnId") == grn_id and payload.get("grnReceived"):
        return {"success": True, "idempotent": True, "procurement": _as_item(row)}

    lines = body.get("lines")
    if not isinstance(lines, list) or not lines:
        # Fallback: single quantity against title item if provided
        lines = [
            {
                "itemId": body.get("itemId"),
                "itemName": body.get("itemName") or payload.get("title"),
                "quantity": body.get("quantity") or payload.get("quantity") or 0,
            }
        ]

    received = []
    for raw in lines:
        if not isinstance(raw, dict):
            fail(422, "invalid_body", "Each GRN line must be an object.")
        try:
            quantity = int(float(raw.get("quantity")))
        except (TypeError, ValueError):
            fail(422, "invalid_body", "GRN quantity must be a number.")
        if quantity <= 0:
            fail(422, "invalid_body", "GRN quantity must be positive.")
        inv = _find_inventory(
            db,
            actor.campus_id,
            item_id=str(raw.get("itemId") or ""),
            item_name=str(raw.get("itemName") or raw.get("item") or ""),
        )
        if inv is None:
            fail(404, "not_found", f"Inventory item not found for GRN line: {raw.get('itemName') or raw.get('itemId')}")
        inv_body = dict(inv.body or {})
        try:
            available = int(float(inv_body.get("availableQuantity") or 0))
        except (TypeError, ValueError):
            available = 0
        next_qty = available + quantity
        inv_body["availableQuantity"] = next_qty
        inv_body["status"] = _derive_status(next_qty, inv_body.get("reorderLevel"))
        _put_body(db, actor, INV, inv.public_id, inv_body)
        movement_id = f"{grn_id}-{inv.public_id}"
        _put_body(
            db,
            actor,
            MOVEMENTS,
            movement_id,
            {
                "id": movement_id,
                "activityType": "GRN",
                "status": "Received",
                "itemName": inv_body.get("itemName"),
                "itemId": inv_body.get("itemId") or inv.public_id,
                "quantity": quantity,
                "procurementId": procurement_id,
                "grnId": grn_id,
                "poNumber": payload.get("poNumber") or "",
                "department": "Stores",
                "requestedBy": actor.email or "Stores",
                "recordedByUserId": str(actor.id),
                "recordedAt": _now().isoformat(),
            },
        )
        received.append({"itemId": inv.public_id, "quantity": quantity, "availableQuantity": next_qty})

    payload["grnId"] = grn_id
    payload["grnReceived"] = True
    payload["grnReceivedAt"] = _now().isoformat()
    payload["grnReceivedBy"] = actor.email or ""
    payload["financePaymentRef"] = str(body.get("financePaymentRef") or payload.get("financePaymentRef") or "")
    if status != "COMPLETED":
        payload["status"] = "COMPLETED"
    _put_body(db, actor, PROCUREMENT, procurement_id, payload)
    write_audit(
        db,
        action="STATIONERY_GRN",
        entity_type="stationery_procurement",
        entity_id=procurement_id,
        actor_id=actor.id,
        campus_id=actor.campus_id,
        details=grn_id,
    )
    db.commit()
    db.refresh(row)
    return {"success": True, "grnId": grn_id, "received": received, "procurement": _as_item(row)}
