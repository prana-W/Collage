
import asyncio
import logging
import sys
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup
from langchain_core.documents import Document
from langchain_text_splitters import MarkdownTextSplitter

from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig
from config.settings import settings
from vectorstore.chroma_client import add_documents_to_college

logger = logging.getLogger(__name__)


DEFAULT_MAX_PAGES  = 10
DEFAULT_COLLEGE_SLUG = "default-college"

_EXCLUDED_TAGS = ["nav", "footer", "script", "style", "head", "aside"]


def _extract_internal_links(html: str, base_url: str) -> list[str]:
    """
    Parse the rendered HTML and return deduplicated internal links.
    Filters anchors, mailto, javascript:, and external domains.
    """
    base_domain = urlparse(base_url).netloc
    soup = BeautifulSoup(html, "html.parser")
    links: set[str] = set()

    for tag in soup.find_all("a", href=True):
        href = tag["href"].strip()
        if href.startswith(("#", "javascript:", "mailto:", "tel:")):
            continue
        full_url = urljoin(base_url, href)
        parsed = urlparse(full_url)
        if parsed.netloc == base_domain and parsed.scheme in ("http", "https"):
            # Drop fragment for deduplication
            clean = parsed._replace(fragment="").geturl()
            links.add(clean)

    return sorted(links)


def _chunk_web_page(markdown: str, url: str, title: str, college_slug: str, root_url: str = None) -> list[Document]:
    """
    Split a single page's markdown into chunks using MarkdownTextSplitter
    and inject standard metadata so the RAG retriever can cite the source.

    Metadata schema:
        - college_slug  : institute identifier (used for ChromaDB collection routing)
        - root_url      : the official college root URL added by admin
        - source_url    : the specific crawled page URL (used for citations)
        - source_file   : set to root_url for source-based purge compatibility
        - source_type   : "web"  (distinguishes from PDF chunks in the collection)
        - title         : page <title>
    """
    splitter = MarkdownTextSplitter(
        chunk_size=settings.CHUNK_SIZE,
        chunk_overlap=settings.CHUNK_OVERLAP,
    )
    raw_chunks = splitter.create_documents([markdown])

    effective_root = root_url or url
    enriched: list[Document] = []
    for chunk in raw_chunks:
        chunk.metadata.update({
            "college_slug":  college_slug,
            "root_url":      effective_root,
            "source_url":    url,
            "source_file":   effective_root,
            "source_type":   "web",
            "title":         title or "",
        })
        enriched.append(chunk)

    return enriched



async def ingest_website(
    start_url: str,
    college_slug: str = DEFAULT_COLLEGE_SLUG,
    max_pages: int = DEFAULT_MAX_PAGES,
) -> dict:
    """
    Main entry point for web ingestion.

    1. Crawls `start_url` using Crawl4AI (JS-rendered, stealth mode).
    2. Follows internal links up to `max_pages`.
    3. Splits each page's markdown via MarkdownTextSplitter.
    4. Injects college metadata into every chunk.
    5. Stores all chunks in ChromaDB under `college_{college_slug}`.

    Returns:
        {
            "pages_crawled": int,
            "pages_failed":  int,
            "chunks_stored": int,
        }
    """
    browser_cfg = BrowserConfig(
        enable_stealth=True,
        headless=True,
        verbose=False,
    )
    run_cfg = CrawlerRunConfig(
        magic=True,
        word_count_threshold=0,
        excluded_tags=_EXCLUDED_TAGS,
        wait_until="domcontentloaded",
        delay_before_return_html=1.5,
        verbose=False,
    )

    all_chunks: list[Document] = []
    visited: set[str] = set()
    queue: list[str] = [start_url]
    pages_crawled = 0
    pages_failed  = 0

    logger.info(
        f"[WebIngestion] Starting crawl → url='{start_url}' "
        f"| college_slug='{college_slug}' | max_pages={max_pages}"
    )
    print(f"\n{'═' * 62}")
    print(f"  COLLAGE Web Ingestion Pipeline")
    print(f"  URL          : {start_url}")
    print(f"  College Slug : {college_slug}")
    print(f"  Max Pages    : {max_pages}")
    print(f"{'═' * 62}\n")

    async with AsyncWebCrawler(config=browser_cfg) as crawler:
        while queue and (pages_crawled + pages_failed) < max_pages:
            url = queue.pop(0)
            if url in visited:
                continue
            visited.add(url)

            page_num = pages_crawled + pages_failed + 1
            print(f"[{page_num}/{max_pages}] Fetching: {url}")

            try:
                res = await crawler.arun(url, config=run_cfg)

                if not res.success:
                    err = res.error_message or "crawl4ai returned failure"
                    logger.warning(f"[WebIngestion] Failed to crawl '{url}': {err}")
                    print(f"  ✗ Failed — {err}")
                    pages_failed += 1
                    continue

                markdown = (
                    res.markdown.raw_markdown
                    if hasattr(res.markdown, "raw_markdown")
                    else str(res.markdown)
                ).strip()

                if not markdown:
                    print(f"  ⚠  Empty content — skipping")
                    pages_failed += 1
                    continue

                title = res.metadata.get("title", "") if res.metadata else ""

                # ── Discover + enqueue new internal links ──────────
                internal_links = _extract_internal_links(res.html, start_url)
                new_links = 0
                for link in internal_links:
                    if link not in visited and link not in queue:
                        queue.append(link)
                        new_links += 1

                # ── Split into chunks ──────────────────────────────
                chunks = _chunk_web_page(markdown, url, title, college_slug, root_url=start_url)
                all_chunks.extend(chunks)

                pages_crawled += 1

                print(
                    f"  ✓ '{title or url}'\n"
                    f"    {len(markdown):,} chars → {len(chunks)} chunks | "
                    f"+{new_links} new links queued"
                )
                logger.info(
                    f"[WebIngestion] Crawled '{url}' → {len(chunks)} chunks | "
                    f"queue size: {len(queue)}"
                )

            except Exception as exc:
                logger.error(f"[WebIngestion] Exception crawling '{url}': {exc}")
                print(f"  ✗ Exception: {exc}")
                pages_failed += 1

    chunks_stored = 0
    if all_chunks:
        print(f"\n{'─' * 62}")
        print(f"  Storing {len(all_chunks)} chunks → ChromaDB 'college_{college_slug}' …")
        add_documents_to_college(college_slug, all_chunks)
        chunks_stored = len(all_chunks)
    else:
        print("\n  ⚠  No content extracted — nothing stored.")
        logger.warning("[WebIngestion] No chunks generated — ChromaDB not updated.")

    print(f"\n{'═' * 62}")
    print(f"  Web Ingestion Complete")
    print(f"  Pages crawled  : {pages_crawled}")
    print(f"  Pages failed   : {pages_failed}")
    print(f"  Chunks stored  : {chunks_stored}")
    print(f"{'═' * 62}\n")

    logger.info(
        f"[WebIngestion] Complete — pages_crawled={pages_crawled}, "
        f"pages_failed={pages_failed}, chunks_stored={chunks_stored}"
    )

    return {
        "pages_crawled": pages_crawled,
        "pages_failed":  pages_failed,
        "chunks_stored": chunks_stored,
    }


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: uv run python ingestion/web_ingestion.py <URL> <college_slug> [max_pages]")
        print("Example:")
        print("  uv run python ingestion/web_ingestion.py https://nitjsr.ac.in nit-jamshedpur 15")
        sys.exit(1)

    _url          = sys.argv[1]
    _college_slug = sys.argv[2]
    _max_pages    = int(sys.argv[3]) if len(sys.argv) > 3 else DEFAULT_MAX_PAGES

    asyncio.run(ingest_website(_url, _college_slug, _max_pages))
