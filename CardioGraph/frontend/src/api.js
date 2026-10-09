const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').trim().replace(/\/$/, '');

export const isApiConfigured = Boolean(API_BASE);

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      const detail = Array.isArray(body?.detail)
        ? body.detail.map((item) => `${item.loc?.slice(-1)[0] || 'field'}: ${item.msg}`).join('; ')
        : body?.detail || body?.message;
      const error = new Error(detail || `Request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    if (!body || typeof body !== 'object') {
      throw new Error('The backend returned an invalid response.');
    }
    return body;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The backend request timed out.');
    if (error instanceof TypeError) throw new Error('The backend is offline or unavailable.');
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function normalizePrediction(result, model) {
  return {
    model: model === 'graphsage' ? 'graphsage' : 'logistic_regression',
    predicted_class: result.predicted_class,
    probability: result.estimated_probability,
    threshold: result.threshold,
    disclaimer: result.disclaimer,
  };
}

export async function createPrediction(patient, selectedModel = 'graphsage') {
  const requests = selectedModel === 'compare'
    ? [
      request('/predict', { method: 'POST', body: JSON.stringify(patient) }).then((result) => normalizePrediction(result, 'logistic_regression')),
      request('/predict/graphsage', { method: 'POST', body: JSON.stringify(patient) }).then((result) => normalizePrediction(result, 'graphsage')),
    ]
    : [
      request(selectedModel === 'graphsage' ? '/predict/graphsage' : '/predict', {
        method: 'POST',
        body: JSON.stringify(patient),
      }).then((result) => normalizePrediction(result, selectedModel)),
    ];

  const predictions = await Promise.all(requests);
  return {
    predictions,
    disclaimer: predictions.map((item) => item.disclaimer).filter(Boolean)[0],
  };
}

export function createExplanation(patient) {
  return request('/explain', {
    method: 'POST',
    body: JSON.stringify(patient),
  });
}

export function askQuestion(question) {
  return request('/ask', {
    method: 'POST',
    body: JSON.stringify({ question }),
  });
}
