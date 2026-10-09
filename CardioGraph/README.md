# CardioGraph — Course Project Starter

This bundle contains a React/Vite frontend starter and a backend API contract document for the CardioGraph heart-disease research prototype.

## Deliverables

- `frontend/` — React 19 + Vite UI, plain CSS (no Tailwind), Motion for React transitions, Three.js animated patient network, Lucide icons, API client, and preview mode.
- `backend-docs/CardioGraph_Backend_API_Schemas.docx` — backend schema/design document: request and response schemas, endpoint inventory, validation, errors, persistence, inference artifacts, RAG/LLM explanation contract, safety and integration notes.
- `backend-docs/openapi.yaml` — OpenAPI 3.1 contract for the API endpoints and data models.
- `frontend/docs/openapi.yaml` — same API contract next to the frontend for reference.

## Run the frontend

Requires Node.js 20.19+ or 22.12+.

```bash
cd frontend
npm install
npm run dev
```

Vite prints a local URL, usually `http://localhost:5173`.

## Preview mode vs. live API

With no API URL configured, the UI runs in **SIMULATED PREVIEW** mode. It uses fixed illustrative values and does not run the trained model or make LLM calls. Do not present preview values as real model output.

To point the frontend to a running FastAPI service, copy `frontend/.env.example` to `frontend/.env.local`, then set:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

Restart Vite after changing the environment. The frontend expects these endpoints:

- `GET /health/live`
- `GET /health/ready`
- `GET /models`
- `POST /predictions`
- `GET /predictions/{prediction_id}`
- `POST /explanations`
- `GET /knowledge/sources`
- `POST /feedback`

The frontend actively calls prediction, explanation, and knowledge-source routes. The backend must implement the contract and return the schemas documented in OpenAPI before live mode will work.

## Current model feature contract

The request accepts 11 features:

`age`, `sex`, `cp`, `trestbps`, `chol`, `fbs`, `restecg`, `thalach`, `exang`, `oldpeak`, `slope`.

`ca` and `thal` are excluded from the current modelling experiment due to source/encoding/missingness concerns. The model label means a disease label recorded in the dataset; it is not a diagnosis or clinically calibrated risk estimate.

## Experimental results from the current notebook

Reported row-level test metrics from the current experiment:

| Model | Accuracy | Precision | Recall | F1 | ROC-AUC |
|---|---:|---:|---:|---:|---:|
| Logistic Regression | 0.8289 | 0.7450 | 0.9407 | 0.8315 | 0.9224 |
| GraphSAGE | 0.8669 | 0.7902 | 0.9576 | 0.8659 | 0.9238 |

Unique-profile test metrics were lower (GraphSAGE F1 0.8408; Logistic Regression F1 0.8176). The reported graph experiment is transductive-style: held-out feature rows participated in graph inference although held-out labels were not used in the training loss. The dataset is multi-source with repeated profiles and source-dependent missingness; treat all results as exploratory academic metrics, not clinical validation.

## Important implementation notes

- This bundle contains the frontend and API contract, **not a complete FastAPI implementation or the trained model artifacts**.
- Implement and test the deterministic prediction endpoint before enabling live inference; integrate retrieval/LLM explanation separately.
- Validate incoming numeric/category ranges in the backend and handle missing values using the fitted training preprocessor.
- Do not store direct patient identifiers. Add explicit retention/access policies before persistence is enabled.
- The system is an educational research prototype, not for diagnosis, triage, or medical decisions.

## Design references

- 21st.dev hero component gallery: https://21st.dev/community/components/explore/hero-design
- Motion for React: https://motion.dev/docs/react
- Three.js / React Three Fiber getting started: https://github.com/pmndrs/react-three-fiber/blob/master/docs/getting-started/installation.mdx
