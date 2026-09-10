import { useCallback, useRef, useState } from "react";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { uploadActivityFile, commitActivityUpload } from "../../api/client";

const ACTIVITY_TYPE_LABELS = {
  date: "Date",
  electricity: "Electricity",
  fuel_diesel: "Diesel",
  fuel_petrol: "Petrol",
  waste_landfill: "Waste (landfill)",
  waste_recycled: "Waste (recycled)",
};

const MAPPABLE_TARGETS = ["date", "electricity", "fuel_diesel", "fuel_petrol", "waste_landfill", "waste_recycled"];

function confidenceTone(confidence) {
  if (confidence >= 0.9) return "good";
  if (confidence >= 0.75) return "ok";
  return "review";
}

function ConfidenceBadge({ confidence }) {
  const tone = confidenceTone(confidence);
  return (
    <span className={`confidence-badge tone-${tone}`}>
      {Math.round(confidence * 100)}%
    </span>
  );
}

export default function FileUploadZone({ companyId = 1, onImported }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const [stage, setStage] = useState("idle"); // idle | parsing | review | committing | done
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null); // full response from POST /api/upload
  const [mappingOverrides, setMappingOverrides] = useState({}); // { header: target|"ignore" }
  const [commitResult, setCommitResult] = useState(null);

  const reset = useCallback(() => {
    setStage("idle");
    setError("");
    setPreview(null);
    setMappingOverrides({});
    setCommitResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const handleFile = useCallback(
    async (file) => {
      if (!file) return;
      setError("");
      setCommitResult(null);
      setStage("parsing");
      try {
        const result = await uploadActivityFile(file, companyId);
        setPreview(result);
        setMappingOverrides({});
        setStage("review");
      } catch (err) {
        setError(err.message || "Could not process this file.");
        setStage("idle");
      }
    },
    [companyId]
  );

  function onDrop(event) {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function onPickFile(event) {
    const file = event.target.files?.[0];
    if (file) handleFile(file);
  }

  function setHeaderTarget(header, target) {
    setMappingOverrides((prev) => ({ ...prev, [header]: target }));
  }

  function resolvedTarget(header) {
    const override = mappingOverrides[header];
    if (override !== undefined) return override;
    return preview.mapping[header]?.target ?? "ignore";
  }

  async function handleConfirm() {
    if (!preview) return;
    setError("");
    setStage("committing");
    try {
      const mapping = {};
      for (const header of preview.headers) {
        mapping[header] = resolvedTarget(header);
      }
      const result = await commitActivityUpload(preview.uploadId, companyId, mapping);
      setCommitResult(result);
      setStage("done");
      if (onImported) await onImported(result);
    } catch (err) {
      setError(err.message || "Import failed.");
      setStage("review");
    }
  }

  return (
    <div>
      <div className="page-header">
        <span className="kicker">Data ingestion</span>
        <h1>Upload activity data</h1>
        <p>
          Upload a CSV or Excel file of electricity, fuel, or waste records. CarbonWise detects the
          columns automatically, shows you the mapping before anything is saved, and runs the same
          validation and emissions calculation as manual entry.
        </p>
      </div>

      {stage === "idle" && (
        <div
          className={`upload-dropzone ${dragOver ? "drag-over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <UploadCloud size={30} />
          <div className="upload-dropzone-title">Drop a CSV or Excel file here, or click to browse</div>
          <div className="upload-dropzone-sub">.csv, .xlsx — up to 10 MB</div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            style={{ display: "none" }}
            onChange={onPickFile}
          />
        </div>
      )}

      {stage === "parsing" && (
        <div className="section-card upload-status-panel">
          <Loader2 className="spin" size={24} />
          <div>
            <div className="upload-status-title">Parsing file…</div>
            <div className="upload-status-sub">Detecting columns, units, and validating rows.</div>
          </div>
        </div>
      )}

      {error && (
        <div className="error-message" style={{ marginTop: 14 }}>
          {error}
        </div>
      )}

      {(stage === "review" || stage === "committing") && preview && (
        <>
          <div className="section-card" style={{ marginTop: 16 }}>
            <div className="upload-summary-row">
              <div className="upload-file-chip">
                <FileSpreadsheet size={16} />
                {preview.filename}
              </div>
              <div className="upload-summary-counts">
                <span className="count-ok">
                  <CheckCircle2 size={14} /> {preview.rowsValid} ready
                </span>
                {preview.rowsFlagged > 0 && (
                  <span className="count-warning">
                    <AlertTriangle size={14} /> {preview.rowsFlagged} need review
                  </span>
                )}
                {preview.rowsError > 0 && (
                  <span className="count-error">
                    <XCircle size={14} /> {preview.rowsError} invalid
                  </span>
                )}
              </div>
            </div>

            {preview.possibleDuplicate && (
              <div className="error-message" style={{ marginTop: 10, background: "var(--amber-tint)", color: "var(--amber)" }}>
                This file may have already been imported (upload #{preview.duplicateOfUploadId} matched by content).
                You can still import it if this is intentional.
              </div>
            )}

            <h3 style={{ marginTop: 18, marginBottom: 10, fontSize: 15 }}>Column mapping</h3>
            <table className="upload-table">
              <thead>
                <tr>
                  <th>Detected column</th>
                  <th>Maps to</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {preview.headers.map((header) => {
                  const info = preview.mapping[header];
                  const current = resolvedTarget(header);
                  return (
                    <tr key={header}>
                      <td>{header}</td>
                      <td>
                        <select value={current} onChange={(e) => setHeaderTarget(header, e.target.value)}>
                          <option value="ignore">Ignore column</option>
                          {MAPPABLE_TARGETS.map((t) => (
                            <option key={t} value={t}>
                              {ACTIVITY_TYPE_LABELS[t]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {info?.confidence > 0 ? <ConfidenceBadge confidence={info.confidence} /> : <span className="confidence-badge tone-review">—</span>}
                        {info?.requiresReview && <span className="review-tag">review</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <h3 style={{ marginTop: 22, marginBottom: 10, fontSize: 15 }}>
              Preview {preview.preview.length < preview.rowsTotal ? `(first ${preview.preview.length} of ${preview.rowsTotal} rows)` : ""}
            </h3>
            <table className="upload-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Quantity</th>
                  <th>Unit</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.preview.map((row, i) => (
                  <tr key={i}>
                    <td>{row.date || "—"}</td>
                    <td>{ACTIVITY_TYPE_LABELS[row.type] || row.type}</td>
                    <td>{row.quantity}</td>
                    <td>{row.unit}</td>
                    <td>
                      {row.status === "ok" && <span className="row-status status-ok"><CheckCircle2 size={13} /> Ready</span>}
                      {row.status === "warning" && <span className="row-status status-warning"><AlertTriangle size={13} /> Review</span>}
                      {row.status === "error" && <span className="row-status status-error"><XCircle size={13} /> Error</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="upload-actions">
              <button className="btn btn-ghost" onClick={reset} disabled={stage === "committing"}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleConfirm} disabled={stage === "committing"}>
                {stage === "committing" ? "Importing…" : "Confirm & import"}
              </button>
            </div>
          </div>
        </>
      )}

      {stage === "done" && commitResult && (
        <div className="section-card success-panel" style={{ marginTop: 16, maxWidth: 460 }}>
          <CheckCircle2 className="success-icon" size={34} />
          <div className="headline">Import complete</div>
          <h3>
            {commitResult.rowsImported} activit{commitResult.rowsImported === 1 ? "y" : "ies"} imported
          </h3>
          {commitResult.rowsSkipped > 0 && (
            <p style={{ color: "var(--amber)", fontSize: 12.5, marginTop: 6 }}>
              {commitResult.rowsSkipped} row{commitResult.rowsSkipped > 1 ? "s" : ""} skipped due to validation errors.
            </p>
          )}
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 14 }}>
            Carbon footprint, cost, and recommendations have all been refreshed with the new data.
          </p>
          <button className="btn btn-ghost" style={{ marginTop: 20 }} onClick={reset}>
            Upload another file <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
