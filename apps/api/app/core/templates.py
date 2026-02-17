from __future__ import annotations

# MVP: hardcoded template day definitions in code.
# Later phases can promote to DB seed tables or admin-managed templates.

RECOMPOSITION_2200 = {
    "key": "recomp_2200",
    "name": "Recomposition 2200 kcal",
    "targets": {
        "kcal": 2200,
        "protein_g": 170.0,
        "carbs_g": 230.0,
        "fat_g": 60.0,
    },
}


def list_templates() -> list[dict]:
    return [RECOMPOSITION_2200]


def get_template_or_none(*, key: str) -> dict | None:
    for t in list_templates():
        if t["key"] == key:
            return t
    return None
