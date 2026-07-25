from redis import Redis
from rq import Queue
from config.settings import settings

# Lazy-initialized singletons — created once on first access
_redis_conn: Redis | None = None
_queue: Queue | None = None


def get_redis() -> Redis:
    global _redis_conn
    if _redis_conn is None:
        _redis_conn = Redis.from_url(settings.REDIS_URL)
    return _redis_conn


def get_queue() -> Queue:
    global _queue
    if _queue is None:
        _queue = Queue(connection=get_redis())
    return _queue
