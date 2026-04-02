/**
 * VCD Dashboard – Main Application
 * VMware Cloud Director Resource Management Dashboard
 *
 * Features:
 *  - Connect to any VCD instance
 *  - Browse all Organizations
 *  - View VDC resources (CPU / Memory / Storage) per Org
 *  - Edit resource limits (CPU in vCPUs, Memory in GB, Storage in GB)
 *  - 1 vCPU = 2 GHz (2000 MHz)
 */

import { useState, useEffect, useCallback } from "react";
import axios from "axios";

// ─────────────────────────────────────────────────────────────────────────────
// API layer
// ─────────────────────────────────────────────────────────────────────────────

const http = axios.create({ baseURL: "/api", timeout: 60_000 });

const api = {
  login: (data) => http.post("/login", data),
  logout: (sid) => http.post("/logout", null, { params: { session_id: sid } }),
  getOrgs: (sid) => http.get("/orgs", { params: { session_id: sid } }),
  getVDCs: (orgId, sid) =>
    http.get(`/orgs/${orgId}/vdcs`, { params: { session_id: sid } }),
  updateVDC: (vdcId, body, sid) =>
    http.put(`/vdcs/${vdcId}`, body, { params: { session_id: sid } }),
  updateStorage: (profileId, body, sid) =>
    http.put(`/storage-profiles/${profileId}`, body, {
      params: { session_id: sid },
    }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Utility: resource progress bar
// ─────────────────────────────────────────────────────────────────────────────

function ProgressBar({ used = 0, total = 0, unit = "", colorClass = "bg-blue-500" }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const barColor =
    pct >= 90
      ? "bg-red-500"
      : pct >= 75
      ? "bg-amber-500"
      : pct >= 50
      ? "bg-yellow-500"
      : colorClass;

  return (
    <div className="w-full space-y-1">
      <div className="flex justify-between text-xs text-slate-400">
        <span>
          {used} {unit} used
        </span>
        <span>
          {total} {unit} total
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-right text-xs text-slate-500">{pct.toFixed(1)}%</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Toast notification
// ─────────────────────────────────────────────────────────────────────────────

function Toast({ message, type = "success", onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const colors = {
    success: "bg-emerald-800 border-emerald-600 text-emerald-200",
    error: "bg-red-900 border-red-700 text-red-200",
    info: "bg-blue-900 border-blue-700 text-blue-200",
  };
  const icons = { success: "✅", error: "❌", info: "ℹ️" };

  return (
    <div
      className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl ${colors[type]} animate-pulse-slow`}
    >
      <span>{icons[type]}</span>
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100">
        ✕
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Spinner
// ─────────────────────────────────────────────────────────────────────────────

function Spinner({ size = "md" }) {
  const s = size === "sm" ? "w-4 h-4 border-2" : "w-8 h-8 border-3";
  return (
    <div
      className={`${s} rounded-full border-slate-600 border-t-blue-500 animate-spin`}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Login Form
// ─────────────────────────────────────────────────────────────────────────────

function LoginForm({ onLogin }) {
  const [form, setForm] = useState({
    host: "",
    username: "administrator",
    password: "",
    org: "System",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await api.login(form);
      onLogin(data.session_id, form.host, form.username);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Connection failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">☁️</div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            VCD Dashboard
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            VMware Cloud Director Resource Manager
          </p>
        </div>

        <div className="card p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Host */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                VCD Host URL
              </label>
              <input
                type="url"
                placeholder="https://vcd.example.com"
                value={form.host}
                onChange={(e) => set("host", e.target.value)}
                className="input-field"
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                Include https:// — e.g. https://vcd.mycompany.com
              </p>
            </div>

            {/* Org */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Organization (Org)
              </label>
              <input
                type="text"
                placeholder="System"
                value={form.org}
                onChange={(e) => set("org", e.target.value)}
                className="input-field"
              />
              <p className="text-xs text-slate-500 mt-1">
                Provider admin = System · Tenant admin = org name
              </p>
            </div>

            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Username
              </label>
              <input
                type="text"
                placeholder="administrator"
                value={form.username}
                onChange={(e) => set("username", e.target.value)}
                className="input-field"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                className="input-field"
                required
              />
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-950/60 border border-red-800/60 text-red-300 px-4 py-3 rounded-lg text-sm flex gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <Spinner size="sm" /> Connecting…
                </>
              ) : (
                "🔌 Connect to VCD"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          VCD Dashboard v1.0 · github.com/asakish55/vcd-dashboard
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit Resource Modal
// ─────────────────────────────────────────────────────────────────────────────

function EditModal({ vdc, sessionId, onClose, onSaved }) {
  const [cpuVcpu, setCpuVcpu] = useState(vdc.cpu?.vcpu_count ?? 0);
  const [memGb, setMemGb] = useState(vdc.memory?.limit_gb ?? 0);
  // storageEdits: { [profileId]: limitGb }
  const [storageEdits, setStorageEdits] = useState(() => {
    const init = {};
    (vdc.storage_profiles || []).forEach((sp) => {
      init[sp.id] = sp.limit_gb;
    });
    return init;
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      // 1. Update compute (CPU + Memory)
      await api.updateVDC(
        vdc.id,
        { cpu_vcpu: cpuVcpu, memory_gb: memGb },
        sessionId
      );

      // 2. Update each storage profile that changed
      const storagePromises = (vdc.storage_profiles || [])
        .filter((sp) => sp.id && storageEdits[sp.id] !== sp.limit_gb)
        .map((sp) =>
          api.updateStorage(sp.id, { limit_gb: storageEdits[sp.id] }, sessionId)
        );
      await Promise.all(storagePromises);

      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const Counter = ({ value, onChange, min = 1, step = 1, label }) => (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - step))}
        className="w-10 h-10 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-xl font-bold transition-colors"
      >
        −
      </button>
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(Math.max(min, parseInt(e.target.value) || min))}
        className="flex-1 input-field text-center text-lg font-semibold"
      />
      <button
        type="button"
        onClick={() => onChange(value + step)}
        className="w-10 h-10 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-xl font-bold transition-colors"
      >
        +
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="card w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-bold text-white">Edit VDC Resources</h2>
            <p className="text-sm text-slate-400 mt-0.5">{vdc.name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* CPU */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">⚡</span>
              <label className="text-sm font-semibold text-slate-200">
                CPU — vCPUs (1 vCPU = 2 GHz)
              </label>
            </div>
            <Counter value={cpuVcpu} onChange={setCpuVcpu} min={1} step={1} />
            <p className="text-xs text-slate-500 mt-2">
              = {cpuVcpu * 2} GHz · Current: {vdc.cpu?.vcpu_count} vCPUs
            </p>
          </div>

          <div className="border-t border-slate-700" />

          {/* Memory */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🧠</span>
              <label className="text-sm font-semibold text-slate-200">
                Memory — GB
              </label>
            </div>
            <Counter value={memGb} onChange={setMemGb} min={1} step={1} />
            <p className="text-xs text-slate-500 mt-2">
              = {(memGb * 1024).toLocaleString()} MB · Current:{" "}
              {vdc.memory?.limit_gb} GB
            </p>
          </div>

          {/* Storage Profiles */}
          {(vdc.storage_profiles || []).length > 0 && (
            <>
              <div className="border-t border-slate-700" />
              {(vdc.storage_profiles || []).map((sp) => (
                <div key={sp.id}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">💾</span>
                    <label className="text-sm font-semibold text-slate-200">
                      {sp.name}
                      {sp.default && (
                        <span className="ml-2 text-xs bg-blue-900/60 text-blue-300 px-1.5 py-0.5 rounded">
                          Default
                        </span>
                      )}
                    </label>
                  </div>
                  <Counter
                    value={storageEdits[sp.id] ?? sp.limit_gb}
                    onChange={(v) =>
                      setStorageEdits((prev) => ({ ...prev, [sp.id]: v }))
                    }
                    min={1}
                    step={100}
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    GB · Current: {sp.limit_gb} GB · Used: {sp.used_gb} GB
                  </p>
                </div>
              ))}
            </>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-950/60 border border-red-800/60 text-red-300 px-4 py-3 rounded-lg text-sm">
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-slate-700">
          <button
            onClick={onClose}
            className="btn-secondary flex-1"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            disabled={saving}
          >
            {saving ? (
              <>
                <Spinner size="sm" /> Saving…
              </>
            ) : (
              "💾 Save Changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VDC Resource Card
// ─────────────────────────────────────────────────────────────────────────────

function VDCCard({ vdc, onEdit }) {
  if (vdc.error) {
    return (
      <div className="card p-5 border-red-800/50">
        <h3 className="text-white font-semibold mb-1">{vdc.name}</h3>
        <p className="text-sm text-red-400">⚠️ {vdc.error}</p>
      </div>
    );
  }

  const { cpu = {}, memory = {}, storage_profiles = [] } = vdc;

  return (
    <div className="card p-5 hover:border-blue-500/40 transition-colors">
      {/* VDC header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-white font-semibold text-base leading-tight">
            {vdc.name}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">{vdc.allocation_model}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
              vdc.status === 1 ? "badge-active" : "badge-inactive"
            }`}
          >
            {vdc.status === 1 ? "● Active" : "○ Inactive"}
          </span>
          <button
            onClick={() => onEdit(vdc)}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg transition-colors font-medium"
          >
            ✏️ Edit
          </button>
        </div>
      </div>

      <div className="space-y-5">
        {/* CPU */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span>⚡</span>
            <span className="text-sm font-medium text-slate-200">
              CPU — {cpu.vcpu_count ?? 0} vCPUs{" "}
              <span className="text-slate-400 text-xs">
                ({cpu.limit_mhz?.toLocaleString() ?? 0} MHz)
              </span>
            </span>
          </div>
          <ProgressBar
            used={cpu.vcpu_used ?? 0}
            total={cpu.vcpu_count ?? 0}
            unit="vCPU"
            colorClass="bg-blue-500"
          />
        </div>

        {/* Memory */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span>🧠</span>
            <span className="text-sm font-medium text-slate-200">
              Memory — {memory.limit_gb ?? 0} GB
            </span>
          </div>
          <ProgressBar
            used={memory.used_gb ?? 0}
            total={memory.limit_gb ?? 0}
            unit="GB"
            colorClass="bg-violet-500"
          />
        </div>

        {/* Storage Profiles */}
        {storage_profiles.map((sp) => (
          <div key={sp.id || sp.name}>
            <div className="flex items-center gap-2 mb-2">
              <span>💾</span>
              <span className="text-sm font-medium text-slate-200">
                {sp.name} — {sp.limit_gb} GB
                {sp.default && (
                  <span className="ml-1.5 text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">
                    default
                  </span>
                )}
              </span>
            </div>
            <ProgressBar
              used={sp.used_gb}
              total={sp.limit_gb}
              unit="GB"
              colorClass="bg-emerald-500"
            />
          </div>
        ))}
      </div>

      {/* Footer stats */}
      <div className="mt-4 pt-4 border-t border-slate-700/60 flex gap-4 text-xs text-slate-500">
        <span>🖥️ {vdc.vapp_count ?? 0} vApps</span>
        <span className="text-slate-600">|</span>
        <span>ID: {vdc.id?.slice(0, 8)}…</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Org Sidebar Card
// ─────────────────────────────────────────────────────────────────────────────

function OrgCard({ org, selected, onClick }) {
  const name = org.displayName || org.name || "Unknown";
  const shortName = org.name || "";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
        selected
          ? "border-blue-500 bg-blue-900/30 text-white"
          : "border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-500 hover:bg-slate-800"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl shrink-0">🏢</span>
        <div className="overflow-hidden">
          <div className="font-semibold truncate">{name}</div>
          {name !== shortName && (
            <div className="text-xs text-slate-500 truncate">{shortName}</div>
          )}
        </div>
        {selected && <span className="ml-auto text-blue-400 shrink-0">▶</span>}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats Bar (top of dashboard)
// ─────────────────────────────────────────────────────────────────────────────

function StatsBar({ orgs, vdcs }) {
  const totalVcpu = vdcs.reduce((s, v) => s + (v.cpu?.vcpu_count ?? 0), 0);
  const totalMemGb = vdcs.reduce((s, v) => s + (v.memory?.limit_gb ?? 0), 0);
  const totalStorageGb = vdcs.reduce(
    (s, v) =>
      s + (v.storage_profiles || []).reduce((ss, sp) => ss + (sp.limit_gb ?? 0), 0),
    0
  );

  const stat = (icon, label, value) => (
    <div className="card px-5 py-3 flex items-center gap-3">
      <span className="text-2xl">{icon}</span>
      <div>
        <div className="text-xs text-slate-400">{label}</div>
        <div className="text-lg font-bold text-white">{value}</div>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {stat("🏢", "Organizations", orgs.length)}
      {stat("📦", "VDCs", vdcs.length)}
      {stat("⚡", "Total vCPUs", totalVcpu.toLocaleString())}
      {stat("🧠", "Total Memory", `${totalMemGb.toLocaleString()} GB`)}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────────────────────────────────

function Dashboard({ sessionId, vcdHost, vcdUser, onLogout }) {
  const [orgs, setOrgs] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [vdcs, setVdcs] = useState([]);
  const [editingVdc, setEditingVdc] = useState(null);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [vdcsLoading, setVdcsLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState("");

  const showToast = (message, type = "success") =>
    setToast({ message, type });

  const loadOrgs = useCallback(async () => {
    setOrgsLoading(true);
    try {
      const { data } = await api.getOrgs(sessionId);
      setOrgs(data);
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to load orgs", "error");
    } finally {
      setOrgsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  const selectOrg = useCallback(
    async (org) => {
      setSelectedOrg(org);
      setVdcs([]);
      setVdcsLoading(true);
      try {
        const { data } = await api.getVDCs(org.id, sessionId);
        setVdcs(data);
      } catch (err) {
        showToast(err.response?.data?.detail || "Failed to load VDCs", "error");
      } finally {
        setVdcsLoading(false);
      }
    },
    [sessionId]
  );

  const handleLogout = async () => {
    try {
      await api.logout(sessionId);
    } catch (_) {}
    onLogout();
  };

  const filteredOrgs = orgs.filter(
    (o) =>
      (o.displayName || o.name || "")
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      (o.name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Top Header ── */}
      <header className="bg-slate-800/90 border-b border-slate-700 px-6 py-3 sticky top-0 z-40 backdrop-blur">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">☁️</span>
            <div>
              <h1 className="text-lg font-bold text-white leading-none">
                VCD Dashboard
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {vcdHost} · {vcdUser}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:flex items-center gap-1.5 text-sm text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Connected
            </span>
            <button
              onClick={handleLogout}
              className="btn-secondary py-1.5 px-4 text-sm"
            >
              🚪 Logout
            </button>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 max-w-screen-2xl mx-auto w-full px-4 py-6 gap-6">
        {/* Sidebar – Org list */}
        <aside className="w-72 shrink-0">
          <div className="card p-4 sticky top-20">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-200 text-sm uppercase tracking-wide">
                Organizations
              </h2>
              <button
                onClick={loadOrgs}
                disabled={orgsLoading}
                title="Refresh"
                className="text-slate-400 hover:text-white text-lg transition-colors disabled:opacity-40"
              >
                ↻
              </button>
            </div>

            {/* Search */}
            <input
              type="text"
              placeholder="Search org…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field text-sm py-2 mb-3"
            />

            {orgsLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
                {filteredOrgs.length === 0 ? (
                  <p className="text-center text-sm text-slate-500 py-6">
                    No organizations found
                  </p>
                ) : (
                  filteredOrgs.map((org) => (
                    <OrgCard
                      key={org.id}
                      org={org}
                      selected={selectedOrg?.id === org.id}
                      onClick={() => selectOrg(org)}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {!selectedOrg ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-24">
              <span className="text-6xl mb-4">👈</span>
              <h3 className="text-xl font-semibold text-slate-300">
                Select an Organization
              </h3>
              <p className="text-slate-500 mt-2">
                Choose an org from the left to view and manage its VDC resources.
              </p>
            </div>
          ) : (
            <>
              {/* Stats bar (shown when org selected and vdcs loaded) */}
              {vdcs.length > 0 && (
                <StatsBar orgs={orgs} vdcs={vdcs} />
              )}

              {/* VDC header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {selectedOrg.displayName || selectedOrg.name}
                  </h2>
                  <p className="text-sm text-slate-400">
                    {vdcsLoading
                      ? "Loading VDCs…"
                      : `${vdcs.length} Virtual Data Center${vdcs.length !== 1 ? "s" : ""}`}
                  </p>
                </div>
                <button
                  onClick={() => selectOrg(selectedOrg)}
                  disabled={vdcsLoading}
                  className="btn-secondary py-1.5 px-4 text-sm disabled:opacity-40"
                >
                  ↻ Refresh
                </button>
              </div>

              {/* VDC Grid */}
              {vdcsLoading ? (
                <div className="flex justify-center py-20">
                  <Spinner />
                </div>
              ) : vdcs.length === 0 ? (
                <div className="card p-12 text-center">
                  <span className="text-5xl">📭</span>
                  <p className="text-slate-400 mt-4">
                    No VDCs found for this organization.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {vdcs.map((vdc) => (
                    <VDCCard
                      key={vdc.id}
                      vdc={vdc}
                      onEdit={setEditingVdc}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* ── Edit Modal ── */}
      {editingVdc && (
        <EditModal
          vdc={editingVdc}
          sessionId={sessionId}
          onClose={() => setEditingVdc(null)}
          onSaved={() => {
            showToast("Resources updated successfully! ✅");
            selectOrg(selectedOrg);
          }}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root App
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [session, setSession] = useState(null); // { id, host, user }

  if (!session) {
    return (
      <LoginForm
        onLogin={(id, host, user) => setSession({ id, host, user })}
      />
    );
  }

  return (
    <Dashboard
      sessionId={session.id}
      vcdHost={session.host}
      vcdUser={session.user}
      onLogout={() => setSession(null)}
    />
  );
}
