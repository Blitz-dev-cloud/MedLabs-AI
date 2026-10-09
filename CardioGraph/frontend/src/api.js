const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');

export const isApiConfigured = Boolean(API_BASE);

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.error?.message || body?.detail?.[0]?.msg || `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.requestId = body?.error?.request_id;
    throw error;
  }
  return body;
}

export async function createPrediction(patient, selectedModel = 'graphsage') {
  if (!isApiConfigured) {
    // Deliberately simulated preview: never present this as an actual model inference.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return {
      mode: 'demo',
      prediction_id: 'preview-8f24c1',
      created_at: new Date().toISOString(),
      status: 'completed',
      selected_model: selectedModel,
      predictions: [
        {
          model: 'graphsage',
          probability: 0.72,
          predicted_class: 1,
          threshold: 0.5,
          model_version: 'demo-preview',
          note: 'Illustrative payload only — no trained model was called.',
        },
        {
          model: 'logistic_regression',
          probability: 0.61,
          predicted_class: 1,
          threshold: 0.5,
          model_version: 'demo-preview',
          note: 'Illustrative payload only — no trained model was called.',
        },
      ].filter((item) => selectedModel === 'compare' || item.model === selectedModel),
      explanation: null,
      dataset_label_note: 'Class 1 means disease recorded in the selected dataset; this is not a diagnosis.',
      warnings: ['Preview mode: this result is simulated and not calculated from your input.'],
      disclaimer: 'Educational research prototype only. Not clinically validated and not for medical decisions.',
    };
  }

  return request('/predictions', {
    method: 'POST',
    body: JSON.stringify({ patient, selected_model: selectedModel, include_explanation: false }),
  });
}

export async function createExplanation(predictionId, question = 'Explain this research-model output and its limitations.') {
  if (!isApiConfigured) {
    await new Promise((resolve) => setTimeout(resolve, 650));
    return {
      mode: 'demo',
      explanation_id: 'preview-explanation',
      prediction_id: predictionId,
      summary: 'This is a preview explanation. Connect the FastAPI service and an approved retrieval index to generate an evidence-grounded explanation for a real prediction.',
      key_factors: [],
      evidence: [],
      limitations: ['The backend is not connected.', 'No knowledge retrieval or LLM call was made.'],
      grounding_status: 'no_evidence',
      disclaimer: 'Not a diagnosis. Consult a qualified healthcare professional for health concerns.',
    };
  }

  return request('/explanations', {
    method: 'POST',
    body: JSON.stringify({ prediction_id: predictionId, audience: 'student', question, evidence_limit: 4, include_sources: true }),
  });
}

export async function getKnowledgeSources() {
  if (!isApiConfigured) {
    return {
      mode: 'demo',
      sources: [
        { source_id: 'uci-heart-disease-doc', title: 'UCI Heart Disease dataset documentation', source_type: 'public_dataset', url: 'https://archive.ics.uci.edu/dataset/45/heart+disease', status: 'reference' },
        { source_id: 'project-model-card', title: 'CardioGraph model card', source_type: 'project_document', url: null, status: 'local' },
        { source_id: 'evidence-index', title: 'Approved clinical evidence index', source_type: 'knowledge_index', url: null, status: 'not-connected' },
      ],
    };
  }
  return request('/knowledge/sources');
}
