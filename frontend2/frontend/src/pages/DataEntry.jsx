import { useState } from "react";
import { Zap, Fuel, Car, Recycle, CheckCircle2, ArrowRight, Gauge, CalendarDays } from "lucide-react";
import { submitActivity } from "../api/client";
import CustomSelect from "../components/ui/CustomSelect";

const GROUPS = [
  { id: "electricity", label: "Electricity", icon: Zap, types: [{ type: "electricity", label: "Electricity", unit: "kWh" }, { type: "natural_gas", label: "Natural gas", unit: "kWh" }] },
  { id: "fuel", label: "Fuel", icon: Fuel, types: [{ type: "fuel_diesel", label: "Diesel fuel", unit: "litre" }, { type: "fuel_petrol", label: "Petrol fuel", unit: "litre" }] },
  { id: "travel", label: "Travel", icon: Car, types: [
    { type: "business_travel_car", label: "Business travel — car", unit: "km" },
    { type: "business_travel_rail", label: "Business travel — rail", unit: "km" },
    { type: "business_travel_flight", label: "Business travel — flight", unit: "km" },
  ] },
  { id: "waste", label: "Waste", icon: Recycle, types: [{ type: "waste_landfill", label: "Waste — landfill", unit: "kg" }, { type: "waste_recycled", label: "Waste — recycled", unit: "kg" }] },
];

const today = new Date().toISOString().slice(0, 10);

export default function DataEntry({ companyId = 1, onSubmitted }) {
  const [groupId, setGroupId] = useState("electricity");
  const group = GROUPS.find((g) => g.id === groupId);

  const [type, setType] = useState(group.types[0].type);
  const [unit, setUnit] = useState(group.types[0].unit);
  const [quantity, setQuantity] = useState("");
  const [date, setDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);

  function selectGroup(g) {
    setGroupId(g.id);
    setType(g.types[0].type);
    setUnit(g.types[0].unit);
    setSuccess(null);
    setError("");
  }

  function handleTypeChange(nextType) {
    const option = group.types.find((t) => t.type === nextType);
    setType(nextType);
    setUnit(option?.unit || "");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (quantity === "" || Number.isNaN(Number(quantity))) {
      setError("Please enter a valid quantity.");
      return;
    }

    setLoading(true);
    try {
      const result = await submitActivity({
        company_id: companyId,
        date,
        type,
        quantity: Number(quantity),
        unit,
      });
      setSuccess({
        quantity: Number(quantity),
        unit,
        typeLabel: group.types.find((t) => t.type === type)?.label,
        co2eKg: result.calculation?.co2e_kg,
        scope: result.calculation?.scope,
        flags: result.activity?.flags || [],
      });
      setQuantity("");
      if (onSubmitted) await onSubmitted(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const typeOptions = group.types.map((t) => ({ value: t.type, label: t.label }));

  return (
    <div>
      <div className="page-header">
        <span className="kicker">Data input</span>
        <h1>Add activity</h1>
        <p>Record your company's operational activity. CarbonWise validates it before calculating emissions.</p>
      </div>

      <div className="type-select-grid">
        {GROUPS.map((g) => {
          const Icon = g.icon;
          return (
            <button
              key={g.id}
              type="button"
              className={`type-select-card ${groupId === g.id ? "active" : ""}`}
              onClick={() => selectGroup(g)}
            >
              <Icon size={28} />
              {g.label}
            </button>
          );
        })}
      </div>

      <div className="data-entry-card">
        {success ? (
          <div className="success-panel">
            <CheckCircle2 className="success-icon" size={34} />
            <div className="headline">Activity recorded</div>
            <h3>
              {success.quantity.toLocaleString()} {success.unit} {success.typeLabel?.toLowerCase()}
            </h3>
            <div className="figure">
              {Number(success.co2eKg || 0).toFixed(2)} kg CO₂e
            </div>
            <div className="figure-label">Estimated emissions · {success.scope}</div>
            {success.flags.length > 0 && (
              <p style={{ color: "var(--amber)", fontSize: 12.5, marginTop: 14 }}>
                {success.flags.length} data-quality warning{success.flags.length > 1 ? "s" : ""} — review before reporting.
              </p>
            )}
            <button className="btn btn-ghost" style={{ marginTop: 20 }} onClick={() => setSuccess(null)}>
              Add another <ArrowRight size={14} />
            </button>
          </div>
        ) : (
          <>
            <div className="data-entry-card-head">
              <span className="data-entry-card-icon">
                <Gauge size={16} />
              </span>
              <div>
                <h3>New activity record</h3>
                <p>Fill in the fields below, then calculate its emissions</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="field-grid">
              <CustomSelect
                id="activity-type"
                label="Activity type"
                value={type}
                options={typeOptions}
                onChange={handleTypeChange}
              />

              <div className="field-row">
                <div className="field">
                  <label htmlFor="quantity">Amount</label>
                  <input
                    id="quantity"
                    type="number"
                    min="0"
                    step="any"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="e.g. 1450"
                  />
                </div>
                <div className="field">
                  <label htmlFor="unit">Unit</label>
                  <input id="unit" value={unit} readOnly />
                </div>
              </div>

              <div className="field">
                <label htmlFor="date">Date</label>
                <div className="input-with-icon">
                  <CalendarDays size={15} />
                  <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
              </div>

              <button className="btn btn-primary" disabled={loading}>
                {loading ? "Calculating…" : "Calculate emissions"}
              </button>

              {error && <div className="error-message">{error}</div>}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
