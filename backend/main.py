
from pathlib import Path

import joblib
import pandas as pd

from fastapi import FastAPI
from pydantic import BaseModel, Field

from fastapi import HTTPException
import numpy as np

from rag.generate_answer import generate_answer, review_answer

from graphsage_inference import predict_graphsage

BASE_DIR = Path(__file__).resolve().parent
ARTIFACT_DIR = BASE_DIR / "artifacts"

preprocessor = joblib.load(
    ARTIFACT_DIR / "preprocessor.joblib"
)
model = joblib.load(
    ARTIFACT_DIR / "logistic_regression.joblib"
)

FEATURES = [
    "age", "sex", "cp", "trestbps", "chol",
    "fbs", "restecg", "thalach", "exang",
    "oldpeak", "slope",
]

app = FastAPI(
    title="Heart Disease Risk Prediction API",
    version="1.0.0",
)


class PatientInput(BaseModel):
    age: float = Field(ge=1, le=120)
    sex: int = Field(ge=0, le=1)
    cp: int = Field(ge=1, le=4)
    trestbps: float = Field(gt=0, le=300)
    chol: float = Field(gt=0, le=1000)
    fbs: int = Field(ge=0, le=1)
    restecg: int = Field(ge=0, le=2)
    thalach: float = Field(gt=0, le=300)
    exang: int = Field(ge=0, le=1)
    oldpeak: float = Field(ge=-10, le=15)
    slope: int = Field(ge=1, le=3)

class AskRequest(BaseModel):
    question: str = Field(
        ...,
        min_length=3,
        max_length=1000,
        description="A general heart-health question",
    )

@app.get("/")
def root():
    return {
        "message": "Heart Disease Prediction API is running"
    }


@app.get("/health")
def health():
    return {"status": "ok", "model": "logistic_regression"}


@app.post("/predict")
def predict(patient: PatientInput):
    patient_df = pd.DataFrame(
        [patient.model_dump()],
        columns=FEATURES,
    )

    transformed = preprocessor.transform(patient_df)
    probability = float(
        model.predict_proba(transformed)[0, 1]
    )
    prediction = int(probability >= 0.5)

    return {
        "predicted_class": prediction,
        "estimated_probability": round(probability, 4),
        "threshold": 0.5,
        "model": "Logistic Regression",
        "disclaimer": (
            "Research prototype only; this result is not "
            "a medical diagnosis."
        ),
    }

FEATURE_NAMES = [
    "age", "sex", "cp", "trestbps", "chol",
    "fbs", "restecg", "thalach", "exang",
    "oldpeak", "slope"
]

@app.post("/explain")
def explain_prediction(patient: PatientInput):
    patient_df = pd.DataFrame(
        [patient.model_dump()],
        columns=FEATURES,
    )

    transformed = preprocessor.transform(patient_df)

    if hasattr(transformed, "toarray"):
        transformed = transformed.toarray()

    # Use the existing model variable: model
    probability = float(
        model.predict_proba(transformed)[0, 1]
    )
    predicted_class = int(probability >= 0.5)

    coefficients = model.coef_[0]
    contributions = transformed[0] * coefficients

    feature_names = preprocessor.get_feature_names_out()

    ranked = sorted(
        [
            {
                "feature": str(name),
                "contribution": round(float(value), 4),
                "direction": (
                    "pushes prediction toward class 1"
                    if value > 0
                    else "pushes prediction toward class 0"
                    if value < 0
                    else "neutral"
                ),
            }
            for name, value in zip(feature_names, contributions)
        ],
        key=lambda item: abs(item["contribution"]),
        reverse=True,
    )

    return {
        "predicted_class": predicted_class,
        "estimated_probability": round(probability, 4),
        "explanation_method": (
            "Logistic Regression coefficient contributions"
        ),
        "top_contributions": ranked[:8],
        "disclaimer": (
            "Research prototype only. Contributions describe model "
            "behavior, not causal or clinical effects."
        ),
    }

@app.post("/ask")
def ask_question(request: AskRequest):
    try:
        answer, passages = generate_answer(request.question)

        review = review_answer(
            question=request.question,
            answer=answer,
            passages=passages,
        )

        sources = []
        seen = set()

        for passage in passages:
            key = (passage["source"], passage["page"])

            if key not in seen:
                seen.add(key)
                sources.append({
                    "source": passage["source"],
                    "page": passage["page"],
                })

        return {
            "question": request.question,
            "answer": answer,
            "sources": sources,
            "review": review,
            "disclaimer": (
                "Educational information only; not a medical diagnosis."
            ),
        }

    
    except Exception as exc:
        import traceback
        traceback.print_exc()

        raise HTTPException(
            status_code=502,
            detail=f"{type(exc).__name__}: {str(exc)}",
        ) from exc


@app.post("/predict/graphsage")
def predict_graphsage_endpoint(patient: PatientInput):
    patient_df = pd.DataFrame(
        [patient.model_dump()],
        columns=FEATURES,
    )

    transformed = preprocessor.transform(patient_df)

    if hasattr(transformed, "toarray"):
        transformed = transformed.toarray()

    try:
        result = predict_graphsage(transformed)

        return {
            **result,
            "estimated_probability": round(
                result["estimated_probability"], 4
            ),
            "threshold": 0.5,
            "disclaimer": (
                "Research prototype only; this result is not "
                "a medical diagnosis."
            ),
        }

    except Exception as exc:
        import traceback
        traceback.print_exc()

        raise HTTPException(
            status_code=500,
            detail="GraphSAGE prediction failed. Check backend logs.",
        ) from exc
