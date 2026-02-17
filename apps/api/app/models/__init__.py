# Ensure SQLAlchemy models are importable for Alembic autogenerate.
# (This project uses explicit migrations, but keeping a central import is useful.)

from app.models.day import Day  # noqa: F401
from app.models.food import Food  # noqa: F401
from app.models.meal_entry import MealEntry  # noqa: F401
from app.models.recipe import Recipe, RecipeItem  # noqa: F401
from app.models.refresh_session import RefreshSession  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.user_target import UserTarget  # noqa: F401
from app.models.weight_entry import WeightEntry  # noqa: F401
