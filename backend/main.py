
from pathlib import Path

import joblib
import pandas as pd

from fastapi import FastAPI
from pydantic import BaseModel, Field

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
