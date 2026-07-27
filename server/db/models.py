import datetime
import json
import uuid
from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, Text
from sqlalchemy.orm import relationship
from db.database import Base


class College(Base):
    __tablename__ = "colleges"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, index=True, nullable=False)
    total_tokens_used = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "total_tokens_used": self.total_tokens_used or 0,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="user")  # "admin" or "user"
    college_slug = Column(String(255), nullable=False)
    total_tokens_used = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "college_slug": self.college_slug,
            "total_tokens_used": self.total_tokens_used or 0,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class WebLink(Base):
    __tablename__ = "web_links"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    college_slug = Column(String(255), nullable=False, index=True)
    url = Column(String(1024), nullable=False)
    max_pages = Column(Integer, default=10, nullable=False)
    pages_crawled = Column(Integer, default=0, nullable=False)
    chunks_stored = Column(Integer, default=0, nullable=False)
    status = Column(String(50), default="pending", nullable=False)  # pending, processing, completed, failed
    error_message = Column(String(1024), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "college_slug": self.college_slug,
            "url": self.url,
            "max_pages": self.max_pages,
            "pages_crawled": self.pages_crawled,
            "chunks_stored": self.chunks_stored,
            "status": self.status,
            "error_message": self.error_message,
            "user_id": self.user_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    college_slug = Column(String(255), nullable=False)
    title = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    messages = relationship(
        "ChatMessage",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "college_slug": self.college_slug,
            "title": self.title,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id = Column(String(36), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(50), nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    sources = Column(Text, nullable=True)  # JSON string
    token_stats = Column(Text, nullable=True)  # JSON string
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    session = relationship("ChatSession", back_populates="messages")

    def to_dict(self):
        parsed_sources = []
        if self.sources:
            try:
                parsed_sources = json.loads(self.sources)
            except Exception:
                parsed_sources = []

        parsed_token_stats = None
        if self.token_stats:
            try:
                parsed_token_stats = json.loads(self.token_stats)
            except Exception:
                parsed_token_stats = None

        return {
            "id": self.id,
            "session_id": self.session_id,
            "role": self.role,
            "content": self.content,
            "sources": parsed_sources,
            "tokenStats": parsed_token_stats,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


