"""
Deployment preflight checks for runtime config safety.

Usage:
  python scripts/release_preflight.py

Notes:
  - In non-production mode, this reports warnings only.
  - In production mode (RENDER/RAILWAY_ENVIRONMENT/PRODUCTION set),
    strict checks fail unless explicit override env vars are set.
"""

import os
import importlib.util
from pathlib import Path


def _load_config_class():
    root = Path(__file__).resolve().parent.parent
    config_path = root / "app" / "config.py"
    spec = importlib.util.spec_from_file_location("fittrack_config_module", config_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load config module from {config_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.Config


Config = _load_config_class()


def _is_truthy(value):
    return str(value or "").strip().lower() in ("1", "true", "yes", "on")


def _is_production():
    return bool(
        os.environ.get("RENDER")
        or os.environ.get("RAILWAY_ENVIRONMENT")
        or os.environ.get("PRODUCTION")
    )


def main():
    is_prod = _is_production()
    allow_gemini_fallback = _is_truthy(os.environ.get("ALLOW_GEMINI_FALLBACK_IN_PRODUCTION"))
    allow_demo_usda = _is_truthy(os.environ.get("ALLOW_DEMO_USDA_IN_PRODUCTION"))

    warnings = []
    errors = []

    if is_prod and Config.SECRET_KEY == "dev-secret-change-in-production":
        errors.append("SECRET_KEY must be set in production.")

    if not Config.GEMINI_API_KEY:
        warnings.append("GEMINI_API_KEY not set: AI chat will use local fallback.")
        if is_prod and not allow_gemini_fallback:
            errors.append(
                "GEMINI_API_KEY missing in production. "
                "Set GEMINI_API_KEY or ALLOW_GEMINI_FALLBACK_IN_PRODUCTION=1."
            )

    if Config.USDA_API_KEY == "DEMO_KEY":
        warnings.append("USDA_API_KEY is DEMO_KEY: nutrition search may be rate-limited.")
        if is_prod and not allow_demo_usda:
            errors.append(
                "USDA_API_KEY is DEMO_KEY in production. "
                "Set USDA_API_KEY or ALLOW_DEMO_USDA_IN_PRODUCTION=1."
            )

    mode = "production" if is_prod else "development"
    print(f"[preflight] mode={mode}")

    for item in warnings:
        print(f"[preflight][warn] {item}")

    if errors:
        for item in errors:
            print(f"[preflight][error] {item}")
        return 2

    print("[preflight] OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
