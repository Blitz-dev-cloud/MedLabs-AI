# CardioGraph frontend

A polished React/Vite starter for the CardioGraph course project: graph-based heart-disease classification with a retrieval-augmented explanation layer.

## Stack

- React + Vite
- Plain CSS (no Tailwind)
- Motion for React (`motion/react`) for page transitions and micro-interactions
- Three.js for the animated patient-similarity network
- Lucide icons

The aesthetic takes broad inspiration from modern component-gallery hero patterns (layered depth, restrained glass-like cards, motion, and strong typography). It does not copy a specific 21st.dev component.

## Run locally

Requires Node.js 20.19+ or 22.12+ for the selected Vite generation.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`).

## Connect the FastAPI backend

Copy `.env.example` to `.env.local` and set:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

Then restart the Vite dev server. The frontend calls:

- `POST /predictions`
- `POST /explanations`
- `GET /knowledge/sources`

Expected request for an assessment:

```json
{
  "patient": {
    "age": 54,
    "sex": 1,
    "cp": 4,
    "trestbps": 130,
    "chol": 239,
    "fbs": 0,
    "restecg": 0,
    "thalach": 150,
    "exang": 0,
    "oldpeak": 0.8,
    "slope": 2
  },
  "selected_model": "compare",
  "include_explanation": false
}
```

The request uses the current 11-feature model schema. `ca` and `thal` are intentionally excluded from the current experiment. Never send a patient name, phone number, national ID, or other direct identifier.

If `VITE_API_BASE_URL` is blank, the UI uses a **clearly labelled simulated preview payload**. It does not run the trained model and must not be represented as a real prediction. When the API URL is configured, API errors are shown rather than being replaced with mock output.

## Important research notes

- Class 1 means disease recorded in the dataset, not a clinical diagnosis.
- The displayed metrics are the values reported during project development; the frontend does not recompute them.
- The current experiment uses 1,280 rows with complete profile keys, split into 814 training, 203 validation, and 263 test rows (149 unique test profiles).
- The reported GraphSAGE evaluation is transductive-style: held-out feature rows participate in graph inference, although held-out labels are not used in the loss. State this protocol and its limitations in the report.
- The dataset is multi-source, contains repeated feature profiles, and has source-dependent missingness. This is a course-project research prototype, not a clinically validated system.

## Build

```bash
npm run build
npm run preview
```

## Design references

- 21st.dev React hero patterns: https://21st.dev/community/components/explore/hero-design
- Motion for React: https://motion.dev/docs/react
- Three.js / React Three Fiber concepts: https://github.com/pmndrs/react-three-fiber/blob/master/docs/getting-started/installation.mdx
