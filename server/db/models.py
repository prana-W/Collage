import datetime
from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey
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

