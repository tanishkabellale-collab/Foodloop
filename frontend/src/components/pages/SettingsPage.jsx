import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  User,
  Building2,
  Database,
  Shield,
  Info,
  MapPin,
  Save,
  CheckCircle2,
  AlertCircle,
  Cpu,
} from 'lucide-react';
import { API_URL } from '../../config';
import { useAuth } from '../../context/useAuth';

const ALL_CATEGORIES = [
  { id: 'cooked_meals', label: 'Cooked Meals' },
  { id: 'fresh_produce', label: 'Fresh Produce' },
  { id: 'bakery', label: 'Bakery Goods' },
  { id: 'packaged_sealed', label: 'Packaged / Sealed' },
];

const SettingsSection = ({ icon: Icon, title, children }) => (
  <div className="settings-section">
    <div className="settings-section-header">
      <Icon size={18} />
      <h3>{title}</h3>
    </div>
    <div className="settings-section-body">{children}</div>
  </div>
);

const SettingsRow = ({ label, value, muted }) => (
  <div className="settings-row">
    <span className="settings-row-label">{label}</span>
    <span className={`settings-row-value ${muted ? 'muted' : ''}`}>{value}</span>
  </div>
);

const SettingsPage = () => {
  const { user } = useAuth();
  const [health, setHealth] = useState(null);
  const [ngoProfile, setNgoProfile] = useState(null);
  const [ngoForm, setNgoForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveErr, setSaveErr] = useState('');

  useEffect(() => {
    let active = true;
    axios.get(`${API_URL}/health`).then((res) => {
      if (active) setHealth(res.data);
    }).catch(() => {});

    if (user?.role === 'NGO' && user?.ngo_id) {
      axios.get(`${API_URL}/ngos/me`).then((res) => {
        if (active && res.data?.ngo) {
          const n = res.data.ngo;
          setNgoProfile(n);
          setNgoForm({
            name: n.name || '',
            available_capacity_servings: n.available_capacity_servings ?? '',
            accepted_categories: n.accepted_categories || [],
            location_text: n.location_text || '',
            service_areas_text: (n.service_areas || []).join(', '),
            latitude: n.latitude ?? '',
            longitude: n.longitude ?? '',
            pickup_capable: Boolean(n.pickup_capable),
            operational_status: n.operational_status || 'active',
            response_time_minutes: n.response_time_minutes ?? 45,
            contact_note: n.contact_note || '',
          });
        }
      }).catch(() => {});
    }

    return () => {
      active = false;
    };
  }, [user]);

  const toggleCategory = (catId) => {
    setNgoForm((prev) => {
      const exists = prev.accepted_categories.includes(catId);
      const next = exists
        ? prev.accepted_categories.filter((c) => c !== catId)
        : [...prev.accepted_categories, catId];
      return { ...prev, accepted_categories: next };
    });
  };

  const handleCaptureNgoGps = () => {
    if (!navigator.geolocation) {
      setSaveErr('Geolocation is not supported in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNgoForm((p) => ({
          ...p,
          latitude: String(Math.round(pos.coords.latitude * 100000) / 100000),
          longitude: String(Math.round(pos.coords.longitude * 100000) / 100000),
        }));
        setSaveErr('');
      },
      (err) => setSaveErr(`Could not read GPS: ${err.message}`)
    );
  };

  const handleSaveNgoProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg('');
    setSaveErr('');
    try {
      const payload = {
        name: ngoForm.name,
        available_capacity_servings:
          ngoForm.available_capacity_servings === '' ? null : Number(ngoForm.available_capacity_servings),
        accepted_categories: ngoForm.accepted_categories,
        location_text: ngoForm.location_text,
        service_areas: ngoForm.service_areas_text
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        latitude: ngoForm.latitude === '' ? null : Number(ngoForm.latitude),
        longitude: ngoForm.longitude === '' ? null : Number(ngoForm.longitude),
        pickup_capable: ngoForm.pickup_capable,
        operational_status: ngoForm.operational_status,
        response_time_minutes: Number(ngoForm.response_time_minutes) || 45,
        contact_note: ngoForm.contact_note,
      };
      const res = await axios.put(`${API_URL}/ngos/me`, payload);
      setNgoProfile(res.data.ngo);
      setSaveMsg('NGO matching profile saved. Rankings now reflect your updated capacity and coordinates.');
    } catch (err) {
      setSaveErr(err.response?.data?.error || 'Failed to update NGO profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-page page-enter">
      <div style={{ maxWidth: 780, margin: '0 auto' }}>

        <SettingsSection icon={User} title="Authenticated account">
          <SettingsRow label="Display name" value={user?.name || 'Unknown user'} />
          <SettingsRow label="Role" value={user?.role || 'DONOR'} />
          <SettingsRow label="Email" value={user?.email || '—'} />
          <SettingsRow label="Organization" value={user?.organization || 'Individual / independent'} muted={!user?.organization} />
          <SettingsRow label="Account type" value={user?.is_demo ? 'Local demo profile' : 'Registered user'} />
        </SettingsSection>

        {user?.role === 'NGO' && ngoForm && (
          <SettingsSection icon={Building2} title={`NGO matching profile (${ngoProfile?.is_demo ? 'Demo' : 'Live DB'})`}>
            <form onSubmit={handleSaveNgoProfile} className="settings-ngo-form">
              {saveMsg && (
                <div className="matches-alert-success" style={{ marginBottom: '12px' }}>
                  <CheckCircle2 size={16} /> <span>{saveMsg}</span>
                </div>
              )}
              {saveErr && (
                <div className="matches-alert-error" style={{ marginBottom: '12px' }}>
                  <AlertCircle size={16} /> <span>{saveErr}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Organization Name</label>
                  <input
                    className="form-input"
                    value={ngoForm.name}
                    onChange={(e) => setNgoForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Available Capacity (Servings)</label>
                  <input
                    type="number"
                    min="0"
                    className="form-input"
                    value={ngoForm.available_capacity_servings}
                    onChange={(e) => setNgoForm((p) => ({ ...p, available_capacity_servings: e.target.value }))}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Operational Status</label>
                  <select
                    className="form-select"
                    value={ngoForm.operational_status}
                    onChange={(e) => setNgoForm((p) => ({ ...p, operational_status: e.target.value }))}
                  >
                    <option value="active">Active (Accepting Pickups)</option>
                    <option value="limited">Limited Capacity</option>
                    <option value="paused">Paused</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Response Time (Minutes)</label>
                  <input
                    type="number"
                    min="5"
                    className="form-input"
                    value={ngoForm.response_time_minutes}
                    onChange={(e) => setNgoForm((p) => ({ ...p, response_time_minutes: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group" style={{ margin: '16px 0' }}>
                <label className="form-label">Accepted food categories</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {ALL_CATEGORIES.map((c) => {
                    const active = ngoForm.accepted_categories.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={`btn btn-sm ${active ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => toggleCategory(c.id)}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Base location</label>
                  <input
                    className="form-input"
                    value={ngoForm.location_text}
                    onChange={(e) => setNgoForm((p) => ({ ...p, location_text: e.target.value }))}
                    placeholder="e.g. Wakad, Pune"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Service areas (comma separated)</label>
                  <input
                    className="form-input"
                    value={ngoForm.service_areas_text}
                    onChange={(e) => setNgoForm((p) => ({ ...p, service_areas_text: e.target.value }))}
                    placeholder="Wakad, Tathwade, Baner"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 8px', flexWrap: 'wrap', gap: '8px' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Facility GPS coordinates (for distance scoring)</label>
                <button type="button" className="btn btn-outline btn-sm" onClick={handleCaptureNgoGps}>
                  <MapPin size={13} /> Use current GPS
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ marginBottom: '16px' }}>
                <input
                  type="number"
                  step="any"
                  className="form-input mono"
                  placeholder="Latitude"
                  value={ngoForm.latitude}
                  onChange={(e) => setNgoForm((p) => ({ ...p, latitude: e.target.value }))}
                />
                <input
                  type="number"
                  step="any"
                  className="form-input mono"
                  placeholder="Longitude"
                  value={ngoForm.longitude}
                  onChange={(e) => setNgoForm((p) => ({ ...p, longitude: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <label className="matches-checkbox-label">
                  <input
                    type="checkbox"
                    checked={ngoForm.pickup_capable}
                    onChange={(e) => setNgoForm((p) => ({ ...p, pickup_capable: e.target.checked }))}
                  />
                  <span>NGO has pickup transport capability</span>
                </label>

                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <Save size={15} />
                  <span>{saving ? 'Saving...' : 'Save Matching Profile'}</span>
                </button>
              </div>
            </form>
          </SettingsSection>
        )}

        <SettingsSection icon={Cpu} title="Hybrid AI Engine Status">
          <SettingsRow
            label="Active AI Pipeline"
            value={health?.ai?.active_mode_summary || 'Checking backend...'}
          />
          <SettingsRow
            label="Gemini Vision API"
            value={health?.ai?.gemini_vision_configured ? `Configured (${health.ai.gemini_model})` : 'Not set (Fallback active)'}
            muted={!health?.ai?.gemini_vision_configured}
          />
          <SettingsRow
            label="Groq Vision Fallback"
            value={health?.ai?.groq_vision_configured ? `Configured (${health.ai.groq_model})` : 'Not set'}
            muted={!health?.ai?.groq_vision_configured}
          />
          <SettingsRow
            label="Local Produce ONNX Model"
            value={health?.ai?.local_onnx_available ? `Loaded (${health.ai.local_onnx_model})` : 'Not available'}
          />
        </SettingsSection>

        <SettingsSection icon={Database} title="Data & Storage">
          <SettingsRow label="Database Engine" value={health?.storage || 'SQLite (ACID WAL)'} />
          <SettingsRow
            label="NGO Pool"
            value={health ? `${health.ngos_count} total (${health.real_ngos_count} registered + demo)` : '—'}
          />
          <SettingsRow label="Image Storage & Hygiene" value="Local uploads/ with EXIF metadata stripping" />
        </SettingsSection>

        <SettingsSection icon={Shield} title="Security & Real-Time Architecture">
          <SettingsRow label="Authentication" value="HMAC-SHA256 JWT + scrypt hashing" />
          <SettingsRow label="Token Revocation" value="Persisted in SQLite revoked_tokens" />
          <SettingsRow label="Rate Limiting & Headers" value="Sliding-window limiter + X-Frame-Options / nosniff" />
          <SettingsRow label="Live Sync Clients" value={health ? `${health.realtime_clients} SSE stream(s)` : 'SSE Active'} />
        </SettingsSection>

        <SettingsSection icon={Info} title="About FoodLoop">
          <SettingsRow label="Version" value={health?.version ? `FoodLoop v${health.version}` : 'FoodLoop v2.0'} />
          <SettingsRow label="Frontend" value="React 19.2 + Vite 8.0" />
          <SettingsRow label="Backend" value="Node.js 24 + Express 5 + node:sqlite" />
        </SettingsSection>
      </div>
    </div>
  );
};

export default SettingsPage;
