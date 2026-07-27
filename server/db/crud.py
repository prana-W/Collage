import json
import datetime
import logging
from sqlalchemy.orm import Session
from db.database import SessionLocal
from db.models import User, College, WebLink, ChatSession, ChatMessage

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


def create_web_link(db: Session, college_slug: str, url: str, max_pages: int = 10, user_id: int = None) -> WebLink:
    """Creates a new WebLink tracking record in MySQL."""
    web_link = WebLink(
        college_slug=college_slug,
        url=url,
        max_pages=max_pages,
        pages_crawled=0,
        chunks_stored=0,
        status="pending",
        user_id=user_id
    )
    db.add(web_link)
    db.commit()
    db.refresh(web_link)
    return web_link


def update_web_link_status(
    db: Session,
    link_id: int,
    status: str,
    pages_crawled: int = 0,
    chunks_stored: int = 0,
    error_message: str = None
) -> WebLink:
    """Updates the status and statistics of a WebLink record."""
    web_link = db.query(WebLink).filter(WebLink.id == link_id).first()
    if web_link:
        web_link.status = status
        web_link.pages_crawled = pages_crawled
        web_link.chunks_stored = chunks_stored
        if error_message:
            web_link.error_message = error_message
        db.commit()
        db.refresh(web_link)
    return web_link


def get_web_links_by_college(db: Session, college_slug: str) -> list:
    """Lists all WebLink records for a college slug."""
    return db.query(WebLink).filter(WebLink.college_slug == college_slug).order_by(WebLink.created_at.desc()).all()


def get_web_link_by_id(db: Session, link_id: int) -> WebLink:
    """Fetches a single WebLink record by ID."""
    return db.query(WebLink).filter(WebLink.id == link_id).first()


def delete_web_link_by_id(db: Session, link_id: int) -> bool:
    """Deletes a WebLink record from MySQL."""
    web_link = db.query(WebLink).filter(WebLink.id == link_id).first()
    if web_link:
        db.delete(web_link)
        db.commit()
        return True
    return False


# --- Chat Session & Messages CRUD ---

def create_chat_session(
    db: Session,
    user_id: int,
    college_slug: str,
    title: str = None,
    session_id: str = None
) -> ChatSession:
    """Creates a new chat session for a user."""
    if not title:
        title = datetime.datetime.now().strftime("%b %d, %Y, %I:%M %p")

    kwargs = {
        "user_id": user_id,
        "college_slug": college_slug,
        "title": title,
    }
    if session_id:
        kwargs["id"] = session_id

    session = ChatSession(**kwargs)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_user_chat_sessions(db: Session, user_id: int) -> list[ChatSession]:
    """Retrieves all chat sessions for a specific user ordered by last updated time."""
    return db.query(ChatSession).filter(ChatSession.user_id == user_id).order_by(ChatSession.updated_at.desc()).all()


def get_chat_session(db: Session, session_id: str, user_id: int) -> ChatSession:
    """Fetches a specific chat session belonging to a user."""
    return db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == user_id).first()


def delete_chat_session(db: Session, session_id: str, user_id: int) -> bool:
    """Deletes a chat session and all its messages for a user."""
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == user_id).first()
    if session:
        db.delete(session)
        db.commit()
        return True
    return False


def add_chat_message(
    db: Session,
    session_id: str,
    role: str,
    content: str,
    sources: list = None,
    token_stats: dict = None
) -> ChatMessage:
    """Appends a new message to a chat session and updates session timestamp."""
    msg = ChatMessage(
        session_id=session_id,
        role=role,
        content=content,
        sources=json.dumps(sources) if sources else None,
        token_stats=json.dumps(token_stats) if token_stats else None
    )
    db.add(msg)

    # Touch session updated_at
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if session:
        session.updated_at = datetime.datetime.utcnow()

    db.commit()
    db.refresh(msg)
    return msg


def get_chat_messages(db: Session, session_id: str) -> list[ChatMessage]:
    """Retrieves all messages for a given chat session ordered chronologically."""
    return db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at.asc()).all()



