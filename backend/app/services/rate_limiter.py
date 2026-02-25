import time
from collections import defaultdict

_request_log: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT = 10  # requests per window
WINDOW_SECONDS = 60


def check_rate_limit(client_ip: str) -> bool:
    """Returns True if request is allowed, False if rate limited."""
    now = time.time()
    window_start = now - WINDOW_SECONDS
    _request_log[client_ip] = [
        t for t in _request_log[client_ip] if t > window_start
    ]
    if len(_request_log[client_ip]) >= RATE_LIMIT:
        return False
    _request_log[client_ip].append(now)
    return True
