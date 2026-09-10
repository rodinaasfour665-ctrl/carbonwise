import { useCallback, useEffect, useState } from "react";

import AppShell from "./components/layout/AppShell";
import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import Dashboard from "./pages/Dashboard";
import DataEntry from "./pages/DataEntry";
import WhatIfSimulator from "./components/WhatIfSimulator";
import ExportButton from "./components/ExportButton";
import CostsAndRecommendations from "./pages/CostsAndRecommendations";
import ActionPlan from "./pages/ActionPlan";
import FileUploadZone from "./components/upload/FileUploadZone";
import Assistant from "./pages/Assistant";

import {
  getRecommendations,
  getResults,
} from "./api/client";

const COMPANY_ID = 1;

export default function App() {
  const [page, setPage] = useState("dashboard");

  const [results, setResults] = useState(null);
  const [recommendations, setRecommendations] =
    useState([]);

  const [loading, setLoading] = useState(true);
  const [
    recommendationsLoading,
    setRecommendationsLoading,
  ] = useState(true);

  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    setLoading(true);
    setRecommendationsLoading(true);

    try {
      const [
        resultData,
        recommendationData,
      ] = await Promise.all([
        getResults(COMPANY_ID),
        getRecommendations(COMPANY_ID),
      ]);

      setResults(resultData);

      setRecommendations(
        Array.isArray(
          recommendationData?.recommendations
        )
          ? recommendationData.recommendations
          : []
      );
    } catch (err) {
      setError(
        (err?.message ||
          "Unable to connect to backend") +
          ". Make sure the CarbonWise backend is running on http://localhost:4000."
      );
    } finally {
      setLoading(false);
      setRecommendationsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AppShell
      page={page}
      onNavigate={setPage}
      connected={!error}
    >
      {/* Backend Error */}
      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      {/* Executive Dashboard */}
      {page === "executive-dashboard" && (
        <ExecutiveDashboard companyId={COMPANY_ID} />
      )}

      {/* Dashboard */}
      {page === "dashboard" && (
        <Dashboard
          results={results}
          recommendations={recommendations}
          loading={loading}
          recommendationsLoading={
            recommendationsLoading
          }
          onNavigate={setPage}
        />
      )}

      {/* Data Entry */}
      {page === "data-entry" && (
        <DataEntry
          companyId={COMPANY_ID}
          onSubmitted={refresh}
        />
      )}

      {/* Smart File Upload + Data Ingestion */}
      {page === "upload" && (
        <FileUploadZone
          companyId={COMPANY_ID}
          onImported={refresh}
        />
      )}

      {/* What-If Simulator */}
      {page === "whatif" && (
        <WhatIfSimulator
          companyId={COMPANY_ID}
        />
      )}

      {/* Costs & Recommendations */}
      {(page === "costs" || page === "recommendations") && (
        <CostsAndRecommendations companyId={COMPANY_ID} />
      )}

      {/* Dynamic Action Plan + Recommendation Personalization */}
      {page === "action-plan" && (
        <ActionPlan companyId={COMPANY_ID} />
      )}

      {/* Grounded Sustainability Chatbot */}
      {page === "assistant" && (
        <Assistant companyId={COMPANY_ID} />
      )}

      {/* Reports */}
      {page === "reports" && (
        <div
          style={{
            padding: "24px",
          }}
        >
          <h2>Reports</h2>

          <p>
            Generate and download your CarbonWise
            sustainability report.
          </p>

          <ExportButton
            companyId={COMPANY_ID}
          />
        </div>
      )}

      {/* Coming Soon */}
      {page !== "executive-dashboard" &&
        page !== "dashboard" &&
        page !== "data-entry" &&
        page !== "upload" &&
        page !== "whatif" &&
        page !== "reports" &&
        page !== "costs" &&
        page !== "recommendations" &&
        page !== "action-plan" &&
        page !== "assistant" && (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
            }}
          >
            <h2>Coming Soon</h2>

            <p>
              This CarbonWise feature is
              currently under development.
            </p>
          </div>
        )}
    </AppShell>
  );
}
