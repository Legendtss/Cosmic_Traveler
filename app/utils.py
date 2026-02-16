from datetime import datetime


def now_iso():
    return datetime.utcnow().isoformat()


def today_str():
    return datetime.now().strftime("%Y-%m-%d")


def safe_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def safe_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default

