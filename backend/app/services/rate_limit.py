"""In-memory sliding-window rate limiter with lockouts.

State lives in the API process, so limits are per-process: with several workers an attacker
gets up to ``workers x limit`` attempts. Move to Redis before running more than one worker.
"""

import threading
import time
from collections import defaultdict, deque
from collections.abc import Callable


class RateLimiter:
    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        self._clock = clock
        self._lock = threading.Lock()
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._locked_until: dict[str, float] = {}

    def reset(self) -> None:
        with self._lock:
            self._events.clear()
            self._locked_until.clear()

    def _prune(self, key: str, window: float, now: float) -> deque[float]:
        events = self._events[key]
        while events and events[0] <= now - window:
            events.popleft()
        if not events:
            self._events.pop(key, None)
            return deque()
        return events

    def hit(self, key: str, window_seconds: float) -> int:
        """Record one event and return how many events fall inside the window."""
        with self._lock:
            now = self._clock()
            self._prune(key, window_seconds, now)
            self._events[key].append(now)
            return len(self._events[key])

    def try_hit(self, key: str, limit: int, window_seconds: float) -> bool:
        """Record an event only while under ``limit``; blocked attempts are not recorded.

        Not recording blocked attempts means an attacker hammering a blocked key cannot keep
        extending the block for the legitimate owner of that key.
        """
        with self._lock:
            now = self._clock()
            events = self._prune(key, window_seconds, now)
            if len(events) >= limit:
                return False
            self._events[key].append(now)
            return True

    def count(self, key: str, window_seconds: float) -> int:
        with self._lock:
            return len(self._prune(key, window_seconds, self._clock()))

    def oldest_age(self, key: str) -> float | None:
        with self._lock:
            events = self._events.get(key)
            return None if not events else self._clock() - events[0]

    def lock(self, key: str, seconds: float) -> None:
        with self._lock:
            self._locked_until[key] = self._clock() + seconds

    def retry_after(self, key: str) -> int:
        """Seconds until the lock on ``key`` lifts (0 when not locked)."""
        with self._lock:
            until = self._locked_until.get(key)
            if until is None:
                return 0
            remaining = until - self._clock()
            if remaining <= 0:
                del self._locked_until[key]
                return 0
            return int(remaining) + 1

    def clear_events(self, key: str) -> None:
        """Forget recorded events but keep any lock."""
        with self._lock:
            self._events.pop(key, None)

    def clear(self, key: str) -> None:
        with self._lock:
            self._events.pop(key, None)
            self._locked_until.pop(key, None)


limiter = RateLimiter()
