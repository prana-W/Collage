import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from api.v1.auth import get_current_user
from db.database import get_db
from db.models import User
from db.crud import (
    create_chat_session,
    get_user_chat_sessions,
    get_chat_session,
    delete_chat_session,
    get_chat_messages,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/chats", tags=["Chats"])


class CreateChatRequest(BaseModel):
    college_slug: str = Field(..., description="Target institute slug", example="nitjsr")
    session_id: Optional[str] = Field(None, description="Optional pre-generated UUID for the chat session")
    title: Optional[str] = Field(None, description="Optional title (defaults to current datetime)")


@router.get("", summary="List user's chat sessions")
async def list_chats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns all chat sessions belonging to the current user."""
    sessions = get_user_chat_sessions(db, current_user.id)
    return [s.to_dict() for s in sessions]


@router.post("", summary="Create a new chat session")
async def create_chat(
    request: CreateChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Creates a new chat session record in the database."""
    session = create_chat_session(
        db=db,
        user_id=current_user.id,
        college_slug=request.college_slug.strip(),
        title=request.title,
        session_id=request.session_id
    )
    return session.to_dict()


@router.get("/{chat_id}", summary="Get a chat session and its full message history")
async def get_chat(
    chat_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves session details and chronologically sorted messages for a given chat_id."""
    session = get_chat_session(db, chat_id, current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found.")

    messages = get_chat_messages(db, chat_id)
    return {
        "session": session.to_dict(),
        "messages": [m.to_dict() for m in messages]
    }


@router.delete("/{chat_id}", summary="Delete a chat session")
async def delete_chat(
    chat_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Permanently deletes a chat session and all its messages from the database."""
    success = delete_chat_session(db, chat_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Chat session not found or permission denied.")
    return {"status": "success", "message": f"Chat session '{chat_id}' deleted successfully."}
