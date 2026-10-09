
from pathlib import Path

import chromadb
from sentence_transformers import SentenceTransformer


BASE_DIR = Path(__file__).resolve().parent.parent
DB_DIR = BASE_DIR / "chroma_db"

model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
client = chromadb.PersistentClient(path=str(DB_DIR))

collection = client.get_collection("heart_disease_knowledge")

questions = [
    "What are the major modifiable risk factors for cardiovascular disease?",
    "What lifestyle changes can help prevent heart disease?",
    "What are common symptoms of a heart attack?",
]


for question in questions:
    print("\n" + "=" * 80)
    print("QUESTION:", question)
    print("=" * 80)

    query_embedding = model.encode(
        [question],
        normalize_embeddings=True,
    ).tolist()

    results = collection.query(
        query_embeddings=query_embedding,
        n_results=5,
        include=["documents", "metadatas", "distances"],
    )

    for rank, (document, metadata, distance) in enumerate(
        zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        ),
        start=1,
    ):
        print(f"\nResult {rank} | Distance: {distance:.4f}")
        print("Source:", metadata["source"])
        print("Page:", metadata["page"])
        print("Passage:", document[:1200])

