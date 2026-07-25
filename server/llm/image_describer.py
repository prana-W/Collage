import re
import base64
import logging
from pathlib import Path
from langchain_core.documents.base import Document
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.runnables import RunnableLambda
from config.settings import settings
from prompts.image_description import IMAGE_TEXT_EXTRACTION_SYSTEM_PROMPT

logger = logging.getLogger(__name__)

# Regex to find markdown image references: ![](<images/imageFile80.jpeg>)
_IMAGE_TAG_PATTERN = re.compile(r'!\[\]\(<(images/[^>]+)>\)')


def _build_vision_chain():
    """
    Builds the LangChain vision chain using a RunnableLambda.
    This is necessary because ChatPromptTemplate cannot interpolate variables
    inside nested dicts within a pre-built HumanMessage's content list.
    Instead, we build the HumanMessage dynamically at invocation time.
    """
    def _build_messages(inputs: dict) -> list:
        image_base64 = inputs["image_base64"]
        mime_type = inputs.get("mime_type", "image/jpeg")
        return [
            SystemMessage(content=IMAGE_TEXT_EXTRACTION_SYSTEM_PROMPT),
            HumanMessage(content=[
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{mime_type};base64,{image_base64}"}
                }
            ])
        ]

    return RunnableLambda(_build_messages) | settings.vision_model


def _describe_image(image_path: str) -> str | None:
    """
    Loads an image from disk, encodes it to base64,
    sends it to the vision LLM, and returns the text description.
    Returns None if the image cannot be found or LLM call fails.
    """
    abs_path = Path(settings.IMAGE_OUTPUT_DIR) / Path(image_path).name

    if not abs_path.exists():
        logger.warning(f"Image not found at '{abs_path}', skipping.")
        return None

    try:
        suffix = abs_path.suffix.lower().lstrip(".")
        mime_type = f"image/{'jpeg' if suffix in ('jpg', 'jpeg') else suffix}"

        with open(abs_path, "rb") as f:
            image_base64 = base64.b64encode(f.read()).decode("utf-8")

        chain = _build_vision_chain()
        response = chain.invoke({"image_base64": image_base64, "mime_type": mime_type})
        return response.content.strip()

    except Exception as e:
        logger.error(f"Failed to describe image '{image_path}': {e}")
        return None


def describe_images_in_docs(docs: list[Document]) -> list[Document]:
    """
    Scans each Document for image references, sends them to the vision LLM,
    and appends 'image content: <description>' after the original image tag.

    This should be called AFTER loading PDFs and BEFORE chunking.
    """
    enriched_docs = []

    for doc in docs:
        content = doc.page_content

        def _replace_image_tag(match: re.Match) -> str:
            original_tag = match.group(0)   # e.g. ![](<images/imageFile80.jpeg>)
            image_path = match.group(1)     # e.g. images/imageFile80.jpeg

            description = _describe_image(image_path)

            if description:
                return f"{original_tag}\nimage content: {description}"
            else:
                return original_tag

        enriched_content = _IMAGE_TAG_PATTERN.sub(_replace_image_tag, content)

        enriched_docs.append(Document(
            page_content=enriched_content,
            metadata=doc.metadata
        ))

    return enriched_docs
