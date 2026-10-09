
from pathlib import Path

from pypdf import PdfReader
from sentence_transformers import SentenceTransformer
import chromadb


# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
SOURCE_DIR = BASE_DIR / "knowledge_base"
DB_DIR = BASE_DIR / "chroma_db"

# Local embedding model (free to use; downloads on first run)
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

# Chunk settings
CHUNK_SIZE = 1200
CHUNK_OVERLAP = 200


def load_sources():
    """Read text files and PDFs, retaining source and page metadata."""
    documents = []

    for file_path in sorted(SOURCE_DIR.iterdir()):
        if not file_path.is_file():
            continue

        if file_path.suffix.lower() == ".txt":
            text = file_path.read_text(encoding="utf-8", errors="ignore")
            if text.strip():
                documents.append({
                    "text": text,
                    "source": file_path.name,
                    "page": 0,
                })

        elif file_path.suffix.lower() == ".pdf":
            reader = PdfReader(str(file_path))

            for page_number, page in enumerate(reader.pages, start=1):
                text = page.extract_text() or ""

                if text.strip():
                    documents.append({
                        "text": text,
                        "source": file_path.name,
                        "page": page_number,
                    })

    return documents


def split_into_chunks(text):
    """Split text into overlapping chunks to preserve context."""
    text = " ".join(text.split())
    chunks = []
    start = 0

    while start < len(text):
        end = min(start + CHUNK_SIZE, len(text))
        chunk = text[start:end].strip()

        if chunk:
            chunks.append(chunk)

        if end == len(text):
            break

        start = end - CHUNK_OVERLAP

    return chunks


def main():
    if not SOURCE_DIR.exists():
        raise FileNotFoundError(
            f"Knowledge-base folder not found: {SOURCE_DIR}"
        )

    source_pages = load_sources()

    if not source_pages:
        raise ValueError(
            "No readable text found. Check the files in knowledge_base."
        )

    chunks = []
    metadatas = []

    for item in source_pages:
        for chunk_number, chunk in enumerate(
            split_into_chunks(item["text"])
        ):
            chunks.append(chunk)
            metadatas.append({
                "source": item["source"],
                "page": item["page"],
                "chunk": chunk_number,
            })

    print(f"Loaded {len(source_pages)} text sections/pages.")
    print(f"Created {len(chunks)} chunks.")
    print(f"Loading embedding model: {EMBEDDING_MODEL}")

    model = SentenceTransformer(EMBEDDING_MODEL)

    client = chromadb.PersistentClient(path=str(DB_DIR))

    # Rebuild this collection each time the script runs, preventing
    # duplicate chunks after repeated ingestion.
    try:
        client.delete_collection("heart_disease_knowledge")
    except Exception:
        pass

    collection = client.create_collection(
        name="heart_disease_knowledge",
        metadata={"description": "Heart disease reference documents"},
    )

    batch_size = 64

    for start in range(0, len(chunks), batch_size):
        batch_chunks = chunks[start:start + batch_size]
        batch_metadata = metadatas[start:start + batch_size]

        embeddings = model.encode(
            batch_chunks,
            normalize_embeddings=True,
            show_progress_bar=False,
        ).tolist()

        ids = [
            f"chunk_{i}"
            for i in range(start, start + len(batch_chunks))
        ]

        collection.add(
            ids=ids,
            documents=batch_chunks,
            metadatas=batch_metadata,
            embeddings=embeddings,
        )

        print(f"Stored {min(start + batch_size, len(chunks))}/{len(chunks)} chunks.")

    print("\nKnowledge-base ingestion complete.")
    print(f"Stored chunks: {collection.count()}")
    print(f"Database folder: {DB_DIR}")


if __name__ == "__main__":
    main()
