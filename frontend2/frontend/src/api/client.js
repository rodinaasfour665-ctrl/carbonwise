const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || "Unexpected server response" };
  }

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
}

export function submitActivity(activity) {
  return request("/activities", {
    method: "POST",
    body: JSON.stringify(activity),
  });
}

export function getResults(companyId = 1) {
  return request(`/results?companyId=${encodeURIComponent(companyId)}`);
}

export function getRecommendations(companyId = 1) {
  return request(`/recommendations?companyId=${encodeURIComponent(companyId)}`);
}

// --- Dynamic Action Plan + Recommendation Personalization ---
// Reuses the same recommendations/costs computed for getRecommendations()/
// getCosts() on the backend; this just fetches the already-grouped,
// already-personalized result.
export function getActionPlan(companyId = 1) {
  return request(`/action-plan?companyId=${encodeURIComponent(companyId)}`);
}

// --- Executive Dashboard ---
// Reuses the same footprint/costs/recommendations/action-plan computed for
// the other endpoints - the backend does no separate calculation for this.
export function getDashboard(companyId = 1) {
  return request(`/dashboard?companyId=${encodeURIComponent(companyId)}`);
}

export function runWhatIf(companyId, modifications) {
  return request("/whatif", {
    method: "POST",
    body: JSON.stringify({ companyId, modifications }),
  });
}

export function getExport(companyId = 1) {
  return request(`/export?companyId=${encodeURIComponent(companyId)}`);
}

export function getCosts(companyId = 1) {
  return request(`/costs?companyId=${encodeURIComponent(companyId)}`);
}

export function updateCostPricing(companyId, pricing) {
  return request("/costs/pricing", {
    method: "POST",
    body: JSON.stringify({ companyId, ...pricing }),
  });
}

// --- Smart File Upload + Data Ingestion ---
// Multipart request, so it bypasses request()'s JSON content-type/body
// handling and lets the browser set the multipart boundary itself.
export async function uploadActivityFile(file, companyId = 1) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("company_id", String(companyId));

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: "POST",
    body: formData,
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || "Unexpected server response" };
  }

  if (!response.ok) {
    throw new Error(data.error || `Upload failed (${response.status})`);
  }
  return data;
}

export function commitActivityUpload(uploadId, companyId, mapping, includeFlagged = true) {
  return request(`/upload/${encodeURIComponent(uploadId)}/commit`, {
    method: "POST",
    body: JSON.stringify({ company_id: companyId, mapping, includeFlagged }),
  });
}

// --- Grounded Sustainability Chatbot ---
// Backend gathers context from the existing engines (emissions, costs,
// recommendations, action plan, what-if) and returns a grounded answer.
// No new calculations happen here or on the client - this just calls
// POST /api/chat and passes back whatever the backend returns.
export function sendChatMessage(companyId, message) {
  return request("/chat", {
    method: "POST",
    body: JSON.stringify({ companyId, message }),
  });
}

export { API_BASE_URL };
