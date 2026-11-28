import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Truck,
  MapPin,
  Clock,
  Navigation,
  CheckCircle2,
  KeyRound,
  RefreshCw,
  Thermometer,
  AlertTriangle,
  ExternalLink,
  PackageCheck,
} from 'lucide-react';
import { API_URL } from '../../config';
import { useAuth } from '../../context/useAuth';

const STEP_ORDER = ['pending_dispatch', 'assigned', 'en_route_pickup', 'picked_up', 'in_transit', 'delivered'];

const STEP_LABELS = {
  pending_dispatch: 'Awaiting Courier',
  assigned: 'Courier Assigned',
  en_route_pickup: 'En Route to Pickup',
  picked_up: 'Picked Up (OTP)',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const VEHICLE_OPTIONS = ['Two-Wheeler', 'Compact Van', 'Insulated Food Van', 'Car'];

const PickupDeliveryPage = ({ onTabChange, onDonationsRefresh }) => {
  const { user } = useAuth();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const [vehicleChoice, setVehicleChoice] = useState('Two-Wheeler');

  // Inline OTP / Temperature form per delivery card
  const [otpInputs, setOtpInputs] = useState({});
  const [tempInputs, setTempInputs] = useState({});
  const [noteInputs, setNoteInputs] = useState({});

  const loadDeliveries = useCallback(async () => {
    const res = await axios.get(`${API_URL}/deliveries`);
    return res.data?.deliveries || [];
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const items = await loadDeliveries();
      setDeliveries(items);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load deliveries.');
    } finally {
      setLoading(false);
    }
  }, [loadDeliveries]);

  useEffect(() => {
    let active = true;
    loadDeliveries()
      .then((items) => {
        if (active) {
          setDeliveries(items);
          setError('');
        }
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.error || 'Failed to load deliveries.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadDeliveries]);

  const handleClaim = async (deliveryId) => {
    setBusyId(deliveryId);
    setError('');
    try {
      await axios.post(`${API_URL}/deliveries/${deliveryId}/claim`, {
        vehicle_type: vehicleChoice,
      });
      await refresh();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to claim pickup dispatch.');
    } finally {
      setBusyId(null);
    }
  };

  const handleTransition = async (deliveryId, nextStatus, { useOtp = false, includeTemp = false } = {}) => {
    setBusyId(deliveryId);
    setError('');
    try {
      await axios.patch(`${API_URL}/deliveries/${deliveryId}/status`, {
        status: nextStatus,
        ...(useOtp ? { otp: otpInputs[deliveryId] || '' } : {}),
        ...(includeTemp && tempInputs[deliveryId] !== undefined && tempInputs[deliveryId] !== ''
          ? { pickup_temp_celsius: Number(tempInputs[deliveryId]) }
          : {}),
        ...(noteInputs[deliveryId] ? { note: noteInputs[deliveryId] } : {}),
      });
      setOtpInputs((prev) => ({ ...prev, [deliveryId]: '' }));
      await refresh();
      if (nextStatus === 'delivered' && onDonationsRefresh) {
        onDonationsRefresh(false);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update delivery status.');
    } finally {
      setBusyId(null);
    }
  };

  const role = user?.role || 'DONOR';
  const canDispatch = role === 'VOLUNTEER' || role === 'NGO' || role === 'ADMIN';

  const filtered = deliveries.filter((d) => {
    if (statusFilter === 'active') return !['delivered', 'cancelled'].includes(d.status);
    if (statusFilter === 'pending') return d.status === 'pending_dispatch';
    if (statusFilter === 'delivered') return d.status === 'delivered';
    return true;
  });

  const pendingCount = deliveries.filter((d) => d.status === 'pending_dispatch').length;
  const activeCount = deliveries.filter((d) =>
    ['assigned', 'en_route_pickup', 'picked_up', 'in_transit'].includes(d.status)
  ).length;
  const deliveredCount = deliveries.filter((d) => d.status === 'delivered').length;

  return (
    <div className="matches-page page-enter">
      {/* Header Banner */}
      <div className="matches-header-card">
        <div className="matches-header-top">
          <div>
            <div className="matches-badge">
              <Truck size={14} strokeWidth={1.65} />
              <span>Last-mile chain-of-custody logistics</span>
            </div>
            <h2 className="matches-title">Pickup &amp; delivery coordination</h2>
            <p className="matches-subtitle">
              Track volunteer courier dispatches, verify 4-digit pickup and delivery OTP handshakes,
              and log pickup temperatures from donor kitchen to NGO doorstep.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {canDispatch && (
              <select
                aria-label="Default courier vehicle"
                className="matches-control-select"
                value={vehicleChoice}
                onChange={(e) => setVehicleChoice(e.target.value)}
              >
                {VEHICLE_OPTIONS.map((v) => (
                  <option key={v} value={v}>Vehicle: {v}</option>
                ))}
              </select>
            )}
            <button type="button" className="btn btn-secondary" onClick={refresh} disabled={loading}>
              <RefreshCw size={15} className={loading ? 'spin-icon' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="admin-stats-row">
          <div className="admin-stat-box">
            <span>Total dispatches</span>
            <strong className="tabular-nums">{deliveries.length}</strong>
          </div>
          <div className="admin-stat-box">
            <span>Awaiting courier</span>
            <strong className="tabular-nums" style={{ color: 'var(--color-accent-ink)' }}>{pendingCount}</strong>
          </div>
          <div className="admin-stat-box">
            <span>Active / in transit</span>
            <strong className="tabular-nums" style={{ color: 'var(--color-ink)' }}>{activeCount}</strong>
          </div>
          <div className="admin-stat-box">
            <span>Verified delivered</span>
            <strong className="tabular-nums" style={{ color: 'var(--color-pastel-green-ink)' }}>{deliveredCount}</strong>
          </div>
        </div>
      </div>

      {error && (
        <div className="matches-alert-error">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="matches-toolbar">
        <div className="matches-toolbar-controls">
          {[
            { id: 'all', label: `All (${deliveries.length})` },
            { id: 'pending', label: `Open Dispatch (${pendingCount})` },
            { id: 'active', label: `In Progress (${activeCount + pendingCount})` },
            { id: 'delivered', label: `Delivered (${deliveredCount})` },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              className={`btn btn-sm ${statusFilter === f.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setStatusFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading && deliveries.length === 0 ? (
        <div className="matches-loading">
          <RefreshCw size={24} className="spin-icon" />
          <p>Loading pickup dispatches...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="matches-empty-card">
          <PackageCheck size={28} />
          <h4>No delivery dispatches in this view</h4>
          <p>
            Delivery dispatches are created automatically whenever an NGO accepts an active donation.
          </p>
          {onTabChange && (
            <button type="button" className="btn btn-primary" style={{ marginTop: '12px' }} onClick={() => onTabChange('donations')}>
              Browse donations
            </button>
          )}
        </div>
      ) : (
        <div className="matches-grid">
          {filtered.map((del) => {
            const stepIdx = STEP_ORDER.indexOf(del.status);
            const isAssignedToMe = del.volunteer_user_id === user?.id;
            const canActOnActive = isAssignedToMe || role === 'ADMIN';
            const canNgoOrAdminConfirmDropoff = role === 'NGO' || role === 'ADMIN';
            const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
              del.pickup_address || ''
            )}&destination=${encodeURIComponent(del.dropoff_address || '')}`;

            return (
              <div key={del.id} className="ngo-match-card">
                <div className="ngo-match-top">
                  <div>
                    <div className="ngo-name-row">
                      <h3 className="ngo-name">{del.donation_title || `Donation #${del.donation_id}`}</h3>
                      <span className="demo-profile-tag">{STEP_LABELS[del.status] || del.status}</span>
                      {del.distance_km !== null && (
                        <span className="assigned-ngo-tag">
                          <Navigation size={12} /> {del.distance_km} km • ~{del.estimated_duration_min || 20} min
                        </span>
                      )}
                    </div>
                    <p className="ngo-meta">
                      {del.quantityText || 'Surplus batch'}
                      {del.ngo_name ? ` • To: ${del.ngo_name}` : ''}
                      {del.volunteer_name ? ` • Courier: ${del.volunteer_name} (${del.vehicle_type || 'Standard'})` : ''}
                    </p>
                  </div>

                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline btn-sm"
                  >
                    <ExternalLink size={14} />
                    <span>Route Map</span>
                  </a>
                </div>

                {/* Route Strip */}
                <div className="delivery-route-strip">
                  <div>
                    <span className="delivery-route-label"><MapPin size={13} /> Pickup</span>
                    <strong>{del.pickup_address || 'Donor address on file'}</strong>
                  </div>
                  <div>
                    <span className="delivery-route-label"><BuildingPinLabel /> Drop-off NGO</span>
                    <strong>{del.dropoff_address || 'Assigned NGO center'}</strong>
                  </div>
                </div>

                {/* Chain-of-custody Progress Stepper */}
                <div className="delivery-stepper">
                  {STEP_ORDER.map((st, idx) => {
                    const done = stepIdx >= idx;
                    return (
                      <div key={st} className={`delivery-step ${done ? 'done' : ''}`}>
                        <span className="delivery-step-dot">{done ? <CheckCircle2 size={12} /> : idx + 1}</span>
                        <span className="delivery-step-text">{STEP_LABELS[st]}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Role-Scoped OTP & Temperature Strip */}
                {(del.pickup_otp || del.delivery_otp || del.pickup_temp_celsius !== null) && (
                  <div className="delivery-otp-row">
                    {del.pickup_otp && (
                      <div className="delivery-otp-pill">
                        <KeyRound size={14} />
                        <span>Pickup OTP (share with courier): <strong>{del.pickup_otp}</strong></span>
                      </div>
                    )}
                    {del.delivery_otp && (
                      <div className="delivery-otp-pill ngo">
                        <KeyRound size={14} />
                        <span>Delivery OTP (share at drop-off): <strong>{del.delivery_otp}</strong></span>
                      </div>
                    )}
                    {del.pickup_temp_celsius !== null && (
                      <div className="delivery-otp-pill">
                        <Thermometer size={14} />
                        <span>Logged Pickup Temp: <strong>{del.pickup_temp_celsius}°C</strong></span>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Bar */}
                <div className="delivery-actions-bar">
                  {del.status === 'pending_dispatch' && canDispatch && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={busyId === del.id}
                      onClick={() => handleClaim(del.id)}
                    >
                      <Truck size={14} />
                      <span>{busyId === del.id ? 'Claiming...' : 'Claim Pickup Dispatch'}</span>
                    </button>
                  )}

                  {del.status === 'assigned' && canActOnActive && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={busyId === del.id}
                      onClick={() => handleTransition(del.id, 'en_route_pickup')}
                    >
                      <Clock size={14} />
                      <span>Start En Route to Pickup</span>
                    </button>
                  )}

                  {del.status === 'en_route_pickup' && canActOnActive && (
                    <div className="delivery-inline-form">
                      {role !== 'ADMIN' && (
                        <input
                          type="text"
                          maxLength={4}
                          placeholder="4-digit Pickup OTP"
                          value={otpInputs[del.id] || ''}
                          onChange={(e) => setOtpInputs((p) => ({ ...p, [del.id]: e.target.value }))}
                          className="form-input delivery-mini-input"
                        />
                      )}
                      <input
                        type="number"
                        step="0.5"
                        placeholder="Temp °C (opt)"
                        value={tempInputs[del.id] ?? ''}
                        onChange={(e) => setTempInputs((p) => ({ ...p, [del.id]: e.target.value }))}
                        className="form-input delivery-mini-input"
                      />
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={busyId === del.id}
                        onClick={() =>
                          handleTransition(del.id, 'picked_up', {
                            useOtp: role !== 'ADMIN',
                            includeTemp: true,
                          })
                        }
                      >
                        Verify Pickup &amp; Load
                      </button>
                    </div>
                  )}

                  {del.status === 'picked_up' && canActOnActive && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={busyId === del.id}
                      onClick={() => handleTransition(del.id, 'in_transit')}
                    >
                      <Truck size={14} />
                      <span>Mark In Transit to NGO</span>
                    </button>
                  )}

                  {(del.status === 'picked_up' || del.status === 'in_transit') &&
                    (canActOnActive || canNgoOrAdminConfirmDropoff) && (
                      <div className="delivery-inline-form">
                        {!canNgoOrAdminConfirmDropoff && (
                          <input
                            type="text"
                            maxLength={4}
                            placeholder="4-digit Delivery OTP"
                            value={otpInputs[del.id] || ''}
                            onChange={(e) => setOtpInputs((p) => ({ ...p, [del.id]: e.target.value }))}
                            className="form-input delivery-mini-input"
                          />
                        )}
                        <input
                          type="text"
                          placeholder="Drop-off note (opt)"
                          value={noteInputs[del.id] || ''}
                          onChange={(e) => setNoteInputs((p) => ({ ...p, [del.id]: e.target.value }))}
                          className="form-input delivery-mini-input"
                        />
                        <button
                          type="button"
                          className="btn btn-pastel btn-sm"
                          disabled={busyId === del.id}
                          onClick={() =>
                            handleTransition(del.id, 'delivered', {
                              useOtp: !canNgoOrAdminConfirmDropoff,
                            })
                          }
                        >
                          <CheckCircle2 size={14} />
                          <span>Confirm delivered</span>
                        </button>
                      </div>
                    )}

                  {del.status === 'delivered' && (
                    <span className="btn-assigned-state">
                      <CheckCircle2 size={15} /> Delivered &amp; Rescue Verified
                      {del.delivered_at ? ` (${new Date(del.delivered_at).toLocaleTimeString()})` : ''}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const BuildingPinLabel = () => <MapPin size={13} />;

export default PickupDeliveryPage;
