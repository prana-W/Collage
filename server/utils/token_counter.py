import logging
from dataclasses import dataclass, asdict

logger = logging.getLogger(__name__)

try:
    import tiktoken
    _encoder = tiktoken.get_encoding("cl100k_base")
except Exception as e:
    logger.warning(f"Could not initialize tiktoken encoder: {e}. Falling back to 4-char estimation.")
    _encoder = None


def count_tokens(text: str) -> int:
    """
    Counts the number of tokens in a text string.
    Uses tiktoken cl100k_base encoder if available, otherwise falls back to character ratio.
    """
    if not text:
        return 0
    if _encoder:
        try:
            return len(_encoder.encode(text))
        except Exception:
            pass
    # Fallback: ~4 characters per token
    return max(1, len(text) // 4)


@dataclass
class TokenAudit:
    enhancer_prompt_tokens: int = 0
    enhancer_completion_tokens: int = 0
    embedding_tokens: int = 0
    rag_prompt_tokens: int = 0
    rag_completion_tokens: int = 0

    @property
    def total_tokens(self) -> int:
        return (
            self.enhancer_prompt_tokens +
            self.enhancer_completion_tokens +
            self.embedding_tokens +
            self.rag_prompt_tokens +
            self.rag_completion_tokens
        )

    def to_dict(self) -> dict:
        return {
            "enhancer_tokens": self.enhancer_prompt_tokens + self.enhancer_completion_tokens,
            "embedding_tokens": self.embedding_tokens,
            "rag_prompt_tokens": self.rag_prompt_tokens,
            "rag_completion_tokens": self.rag_completion_tokens,
            "total_tokens": self.total_tokens
        }
