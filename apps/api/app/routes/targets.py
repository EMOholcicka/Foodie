from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.scaling import MacroTotals as CoreMacroTotals
from app.core.scaling import scale_macros_to_kcal
from app.core.templates import get_template_or_none, list_templates
from app.crud.targets import get_active_user_target, upsert_user_target
from app.db.session import get_db_session
from app.models.user import User
from app.routes.deps import get_current_user
from app.schemas.targets import TargetsOut, TargetsSetRequest

router = APIRouter(prefix="/targets", tags=["targets"])


@router.get("", response_model=TargetsOut)
async def get_targets(
    at_date: date | None = Query(default=None, description="Optional effective date (YYYY-MM-DD)"),
    session: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
) -> TargetsOut:
    row = await get_active_user_target(session=session, user_id=user.id, at_date=at_date)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Targets not set")

    return TargetsOut(
        id=str(row.id),
        effective_date=row.effective_date,
        kcal_target=int(row.kcal_target),
        protein_g=float(row.protein_g),
        carbs_g=float(row.carbs_g),
        fat_g=float(row.fat_g),
    )


@router.put("", response_model=TargetsOut)
async def set_targets(
    payload: TargetsSetRequest,
    session: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
) -> TargetsOut:
    row = await upsert_user_target(
        session=session,
        user_id=user.id,
        effective_date=payload.effective_date,
        kcal_target=payload.kcal_target,
        protein_g=payload.protein_g,
        carbs_g=payload.carbs_g,
        fat_g=payload.fat_g,
    )
    await session.commit()

    return TargetsOut(
        id=str(row.id),
        effective_date=row.effective_date,
        kcal_target=int(row.kcal_target),
        protein_g=float(row.protein_g),
        carbs_g=float(row.carbs_g),
        fat_g=float(row.fat_g),
    )


@router.get("/templates")
async def get_templates(user: User = Depends(get_current_user)) -> dict:
    return {"templates": list_templates()}


@router.get("/templates/{template_key}/scaled")
async def get_scaled_template(
    template_key: str,
    kcal_target: int = Query(..., ge=0),
    user: User = Depends(get_current_user),
) -> dict:
    tpl = get_template_or_none(key=template_key)
    if tpl is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    base = tpl["targets"]
    base_totals = CoreMacroTotals(
        kcal=float(base["kcal"]),
        protein_g=float(base["protein_g"]),
        carbs_g=float(base["carbs_g"]),
        fat_g=float(base["fat_g"]),
    )
    scaled = scale_macros_to_kcal(base=base_totals, kcal_target=float(kcal_target))

    return {
        "template": {"key": tpl["key"], "name": tpl["name"]},
        "targets": {
            "kcal_target": int(round(scaled.kcal)),
            "protein_g": round(scaled.protein_g, 1),
            "carbs_g": round(scaled.carbs_g, 1),
            "fat_g": round(scaled.fat_g, 1),
        },
    }
