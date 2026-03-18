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


def _load_config_module():
    root = Path(__file__).resolve().parent.parent
    config_path = root / "app" / "config.py"
    spec = importlib.util.spec_from_file_location("fittrack_config_module", config_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load config module from {config_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


_config_module = _load_config_module()
Config = _config_module.Config
is_production_env = _config_module.is_production_env
validate_startup_config = _config_module.validate_startup_config


def _is_truthy(value):
    return str(value or "").strip().lower() in ("1", "true", "yes", "on")


def main():
    is_prod = is_production_env(os.environ)
    allow_gemini_fallback = _is_truthy(os.environ.get("ALLOW_GEMINI_FALLBACK_IN_PRODUCTION"))

    warnings = []
    errors = validate_startup_config(Config, environ=os.environ)

    if not Config.GEMINI_API_KEY:
        warnings.append("GEMINI_API_KEY not set: AI chat will use local fallback.")
        if is_prod and not allow_gemini_fallback:
            # validate_startup_config already adds this as an error.
            pass

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
