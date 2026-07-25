import logging
from sqlalchemy.orm import Session
from db.database import SessionLocal
from db.models import User, College

logger = logging.getLogger(__name__)


def record_token_usage(user_id: int, college_slug: str, tokens_count: int) -> int:
    """
    Increments total_tokens_used in the database for the given user and college.
    Returns the user's new cumulative total token count.
    """
    if tokens_count <= 0:
        return 0

    db: Session = SessionLocal()
    new_user_total = 0
    try:
        # Increment user total tokens
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user.total_tokens_used = (user.total_tokens_used or 0) + tokens_count
            new_user_total = user.total_tokens_used

        # Increment college total tokens
        if college_slug:
            college = db.query(College).filter(College.slug == college_slug).first()
            if college:
                college.total_tokens_used = (college.total_tokens_used or 0) + tokens_count

        db.commit()
        logger.info(
            f"[DB Token Usage] Incremented +{tokens_count} tokens for user_id={user_id} "
            f"('{user.email if user else 'unknown'}') | New User Total: {new_user_total}"
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to record token usage in database: {e}", exc_info=True)
    finally:
        db.close()

    return new_user_total
