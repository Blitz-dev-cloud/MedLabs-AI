
import os
from pathlib import Path

import chromadb
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
from google import genai

import json
from groq import Groq


BASE_DIR = Path(__file__).resolve().parent.parent
DB_DIR = BASE_DIR / "chroma_db"

load_dotenv(BASE_DIR / ".env")

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise RuntimeError(
        "GEMINI_API_KEY is missing. Add it to the backend .env file."
    )

client = genai.Client(api_key=api_key)

groq_api_key = os.getenv("GROQ_API_KEY")

if not groq_api_key:
    raise RuntimeError(
        "GROQ_API_KEY is missing. Add it to the backend .env file."
    )

reviewer_client = Groq(api_key=groq_api_key)
REVIEWER_MODEL = "openai/gpt-oss-20b"

# Use the same embedding model used when building the database.
embedding_model = SentenceTransformer(
    "sentence-transformers/all-MiniLM-L6-v2"
)

db_client = chromadb.PersistentClient(path=str(DB_DIR))
collection = db_client.get_collection("heart_disease_knowledge")


def retrieve_passages(question: str, n_results: int = 5):
    query_embedding = embedding_model.encode(
        [question],
        normalize_embeddings=True,
    ).tolist()

    results = collection.query(
        query_embeddings=query_embedding,
        n_results=n_results,
        include=["documents", "metadatas", "distances"],
    )

    passages = []

    for document, metadata in zip(
        results["documents"][0],
        results["metadatas"][0],
    ):
        passages.append(
            {
                "text": document,
                "source": metadata["source"],
                "page": metadata["page"],
            }
        )

    return passages


def generate_answer(question: str):
    passages = retrieve_passages(question)

    evidence = "\n\n".join(
        f"[Source: {p['source']}, page {p['page']}]\n{p['text']}"
        for p in passages
    )

    prompt = f"""
You are an educational assistant explaining general heart-health
information using the supplied reference passages.

Rules:
- Answer the question using the supplied passages.
- Do not invent facts or claim the sources say something they do not.
- If the evidence is insufficient, say so clearly.
- Cite claims using the source filename and page number, for example
  [riskfactors.pdf, page 15].
- Do not diagnose a person or estimate an individual's clinical risk.
- If the question describes possible current heart-attack symptoms,
  advise seeking emergency medical help immediately.
- Distinguish general educational information from medical advice.

QUESTION:
{question}

REFERENCE PASSAGES:
{evidence}
"""

    # Gemini model availability and free-tier access can change.
    # If this model is unavailable to your account, we'll troubleshoot it.
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )

    return response.text, passages


def review_answer(question: str, answer: str, passages: list):
    """Check an answer against retrieved evidence using a second provider."""

    evidence = "\n\n".join(
        f"[Source: {p['source']}, page {p['page']}]\n{p['text']}"
        for p in passages
    )

    prompt = f"""
You are an independent evidence reviewer for a medical education prototype.

Review the draft answer against ONLY the supplied reference passages.

Check:
1. Whether its factual medical claims are supported by the evidence.
2. Whether every cited filename and page corresponds to a supplied passage.
3. Whether any important claims are unsupported or misleading.
4. Whether urgent heart-attack symptoms receive appropriate emergency guidance.

Do not diagnose anyone. Do not introduce new medical facts.
A citation matching a source/page is not enough by itself: check whether
the cited passage supports the associated claim.

Return ONLY a valid JSON object with this structure:
{{
  "status": "pass" or "needs_revision",
  "citation_check": "pass" or "needs_revision",
  "unsupported_claims": ["specific issue, if any"],
  "citation_issues": ["specific issue, if any"],
  "safety_issues": ["specific issue, if any"],
  "summary": "brief explanation of the review"
}}

Use "needs_revision" if a material factual, citation, or safety issue exists.
Do not mark an answer as passed merely because it contains citations.

QUESTION:
{question}

DRAFT ANSWER:
{answer}

RETRIEVED REFERENCE PASSAGES:
{evidence}
"""

    response = reviewer_client.chat.completions.create(
        model=REVIEWER_MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a strict evidence auditor. "
                    "Return valid JSON only."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content

    try:
        review = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return {
            "status": "review_error",
            "citation_check": "not_verified",
            "unsupported_claims": [],
            "citation_issues": [],
            "safety_issues": [],
            "summary": "Reviewer returned an unreadable response.",
        }

    # Fail closed if the reviewer response doesn't follow the expected schema.
    if (
        review.get("status") not in {"pass", "needs_revision"}
        or review.get("citation_check") not in {"pass", "needs_revision"}
    ):
        return {
            "status": "review_error",
            "citation_check": "not_verified",
            "unsupported_claims": [],
            "citation_issues": [],
            "safety_issues": [],
            "summary": "Reviewer response did not match the expected schema.",
        }

    for key in (
        "unsupported_claims",
        "citation_issues",
        "safety_issues",
    ):
        if not isinstance(review.get(key), list):
            review[key] = []

    if not isinstance(review.get("summary"), str):
        review["summary"] = "No review summary was provided."

    return review

if __name__ == "__main__":
    question = (
        "What are common symptoms of a heart attack, "
        "and when should someone seek emergency help?"
    )

    answer, passages = generate_answer(question)

    print("\n" + "=" * 70)
    print("GENERATED ANSWER")
    print("=" * 70)
    print(answer)

    print("\n" + "=" * 70)
    print("RETRIEVED SOURCES")
    print("=" * 70)

    for passage in passages:
        print(f"- {passage['source']}, page {passage['page']}")
