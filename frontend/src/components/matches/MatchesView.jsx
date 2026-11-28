import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import {
  GitFork,
  CheckCircle2,
  AlertTriangle,
  Info,
  MapPin,
  Package,
  Clock,
  Truck,
  Heart,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  ShieldAlert,
  RefreshCw,
  ArrowRight,
  HelpCircle,
  Eye,
} from 'lucide-react';
import { API_URL } from '../../config';

const TIER_STYLES = {
  excellent: {
    bg: 'var(--color-pastel-green)',
    color: 'var(--color-pastel-green-ink)',
    border: 'var(--color-pastel-green-strong)',
    bar: '#6FB468',
  },
  good: {
    bg: 'var(--color-bg-subtle)',
    color: 'var(--color-ink)',
    border: 'var(--color-border-strong)',
    bar: '#111110',
  },
  possible: {
    bg: 'var(--color-accent-subtle)',
    color: 'var(--color-accent-ink)',
    border: 'rgba(234, 93, 26, 0.3)',
    bar: '#EA5D1A',
  },
  low: {
    bg: 'var(--color-danger-subtle)',
    color: 'var(--color-danger)',
    border: 'rgba(194, 58, 43, 0.3)',
    bar: '#C23A2B',
  },
};

const formatCategory = (cat) =>
  cat ? cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Unspecified';

const MatchesView = ({ donations = [], onAccept, onTabChange, onSelectDonation }) => {
  const [selectedId, setSelectedId] = useState('');
  const [matchData, setMatchData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Controls
  const [sortBy, setSortBy] = useState('score');
  const [tierFilter, setTierFilter] = useState('all');
  const [hideInsufficientCapacity, setHideInsufficientCapacity] = useState(false);
  const [expandedNgoIds, setExpandedNgoIds] = useState({});
  const [confirmAssignNgo, setConfirmAssignNgo] = useState(null);
  const [assigningId, setAssigningId] = useState(null);
  const [assignSuccessMsg, setAssignSuccessMsg] = useState('');

  // Derive active donation selection without synchronous setState inside useEffect
  const effectiveSelectedId = useMemo(() => {
    if (donations.length === 0) return '';
    if (selectedId && donations.some((d) => d.id === selectedId)) return selectedId;
    const preferred =
      donations.find((d) => ['available', 'submitted'].includes((d.status || '').toLowerCase())) ||
      donations[0];
    return preferred.id;
  }, [donations, selectedId]);

  const fetchMatches = useCallback(async (donationId) => {
    if (!donationId) return;
    setLoading(true);
    setError('');
    setConfirmAssignNgo(null);
    try {
      const res = await axios.get(`${API_URL}/donations/${donationId}/matches`);
      setMatchData(res.data);
    } catch (err) {
      console.error('Failed to load NGO matches:', err);
      setError(err.response?.data?.error || 'Could not load NGO recommendations.');
      setMatchData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!effectiveSelectedId) return;
    let active = true;
    axios
      .get(`${API_URL}/donations/${effectiveSelectedId}/matches`)
      .then((res) => {
        if (active) {
          setMatchData(res.data);
          setError('');
        }
      })
      .catch((err) => {
        if (active) {
          console.error('Failed to load NGO matches:', err);
          setError(err.response?.data?.error || 'Could not load NGO recommendations.');
          setMatchData(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [effectiveSelectedId]);

  const selectedDonation = useMemo(
    () => donations.find((d) => d.id === effectiveSelectedId) || matchData?.donation || null,
    [donations, effectiveSelectedId, matchData]
  );

  const filteredMatches = useMemo(() => {
    if (!matchData?.matches) return [];
    let list = [...matchData.matches];

    if (tierFilter === 'excellent') {
      list = list.filter((m) => m.score >= 80);
    } else if (tierFilter === 'good') {
      list = list.filter((m) => m.score >= 60);
    } else if (tierFilter === 'possible') {
      list = list.filter((m) => m.score >= 40);
    }

    if (hideInsufficientCapacity) {
      list = list.filter((m) => !m.assessments?.exceeds_capacity);
    }

    list.sort((a, b) => {
      if (sortBy === 'completeness') {
        if (b.data_completeness !== a.data_completeness) {
          return b.data_completeness - a.data_completeness;
        }
        return b.score - a.score;
      }
      if (sortBy === 'capacity') {
        const capA = a.assessments?.available_capacity_servings ?? -1;
        const capB = b.assessments?.available_capacity_servings ?? -1;
        if (capB !== capA) return capB - capA;
        return b.score - a.score;
      }
      // Default: score desc, completeness desc
      if (b.score !== a.score) return b.score - a.score;
      return b.data_completeness - a.data_completeness;
    });

    return list;
  }, [matchData, sortBy, tierFilter, hideInsufficientCapacity]);

  const toggleExpand = (ngoId) => {
    setExpandedNgoIds((prev) => ({ ...prev, [ngoId]: !prev[ngoId] }));
  };

  const handleConfirmAssign = async (match) => {
    if (!selectedDonation || !onAccept) return;
    setAssigningId(match.ngo_id);
    setAssignSuccessMsg('');
    try {
      await onAccept(selectedDonation.id, {
        matched_ngo_id: match.ngo_id,
        matched_ngo_name: match.ngo_name,
      });
      setConfirmAssignNgo(null);
      setAssignSuccessMsg(
        `Donation "${selectedDonation.title || selectedDonation.foodName}" accepted and assigned to ${match.ngo_name}.`
      );
      fetchMatches(selectedDonation.id);
    } catch {
      setError('Failed to assign NGO to this donation.');
    } finally {
      setAssigningId(null);
    }
  };

  const isDonationAssignable =
    selectedDonation &&
    ['available', 'submitted'].includes((selectedDonation.status || 'available').toLowerCase());

  return (
    <div className="matches-page page-enter">
      {/* Header Banner */}
      <div className="matches-header-card">
        <div className="matches-header-top">
          <div>
            <div className="matches-badge">
              <GitFork size={13} strokeWidth={1.65} />
              <span>Weighted compatibility scoring</span>
            </div>
            <h2 className="matches-title">NGO matching</h2>
            <p className="matches-subtitle">
              Ranks registered NGOs and demo profiles using a 100-point compatibility model across category, distance, capacity, urgency, dietary fit, and pickup readiness.
            </p>
          </div>
          <div className="matches-weights-pill">
            <span className="weights-pill-title">Scoring weights (100 pts)</span>
            <div className="weights-pill-items">
              <span>Category 25</span>
              <span>Location 20</span>
              <span>Capacity 20</span>
              <span>Urgency 15</span>
              <span>Dietary 10</span>
              <span>Readiness 10</span>
            </div>
          </div>
        </div>

        <div className="matches-disclaimer">
          <Info size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>
            <strong>Transparency Notice:</strong> Scores indicate profile compatibility (0–100), not pickup probability or food safety certification.
            Missing data never awards full points. NGO profiles below are clearly labeled <strong>Demo Profiles</strong>.
          </span>
        </div>
      </div>

      {/* Donation Selector & Summary */}
      <div className="matches-selector-card">
        <div className="matches-selector-row">
          <div className="matches-selector-group">
            <label htmlFor="donation-match-select" className="matches-label">
              Select Donation to Match
            </label>
            {donations.length === 0 ? (
              <div className="matches-empty-inline">
                No donations found.{' '}
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => onTabChange?.('create')}
                >
                  Create a donation first
                </button>
              </div>
            ) : (
              <select
                id="donation-match-select"
                className="matches-select"
                value={effectiveSelectedId}
                onChange={(e) => {
                  setSelectedId(e.target.value);
                  setAssignSuccessMsg('');
                }}
              >
                {donations.map((d) => {
                  const status = (d.status || 'available').toUpperCase();
                  const label = d.title || d.foodName || 'Surplus Food';
                  const qty = d.quantityText || `${d.quantity} ${d.quantity_unit || ''}`;
                  return (
                    <option key={d.id} value={d.id}>
                      [{status}] {label} — {qty} ({d.address_text || d.location || 'No address'})
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            {onSelectDonation && selectedDonation && (
              <button
                type="button"
                className="btn btn-outline matches-refresh-btn"
                onClick={() => onSelectDonation(selectedDonation)}
              >
                <Eye size={15} />
                <span>View Details</span>
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary matches-refresh-btn"
              onClick={() => effectiveSelectedId && fetchMatches(effectiveSelectedId)}
              disabled={loading || !effectiveSelectedId}
            >
              <RefreshCw size={15} className={loading ? 'spin-icon' : ''} />
              <span>Re-evaluate</span>
            </button>
          </div>
        </div>

        {selectedDonation && (
          <div className="matches-donation-summary">
            <div className="summary-chip">
              <Package size={14} />
              <span>Category: <strong>{formatCategory(selectedDonation.food_category)}</strong></span>
            </div>
            <div className="summary-chip">
              <Heart size={14} />
              <span>Dietary: <strong>{formatCategory(selectedDonation.dietary_type)}</strong></span>
            </div>
            <div className="summary-chip">
              <Info size={14} />
              <span>Quantity: <strong>{selectedDonation.quantityText || `${selectedDonation.quantity} ${selectedDonation.quantity_unit || ''}`}</strong></span>
            </div>
            <div className="summary-chip">
              <MapPin size={14} />
              <span>Location: <strong>{selectedDonation.address_text || selectedDonation.location || 'Not provided'}</strong></span>
            </div>
            <div className="summary-chip">
              <Clock size={14} />
              <span>
                Status: <strong style={{ textTransform: 'capitalize' }}>{selectedDonation.status || 'available'}</strong>
                {selectedDonation.matched_ngo_name ? ` (Assigned: ${selectedDonation.matched_ngo_name})` : ''}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Feedback Alerts */}
      {assignSuccessMsg && (
        <div className="matches-alert-success">
          <CheckCircle2 size={18} />
          <span>{assignSuccessMsg}</span>
        </div>
      )}

      {error && (
        <div className="matches-alert-error">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Sort & Filter Toolbar */}
      {matchData && (
        <div className="matches-toolbar">
          <div className="matches-toolbar-left">
            <SlidersHorizontal size={16} />
            <span className="toolbar-count">
              Showing <strong>{filteredMatches.length}</strong> of {matchData.matches?.length || 0} NGOs
            </span>
          </div>

          <div className="matches-toolbar-controls">
            <select
              aria-label="Sort NGOs"
              className="matches-control-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="score">Sort: Compatibility Score</option>
              <option value="completeness">Sort: Data Completeness</option>
              <option value="capacity">Sort: Available Capacity</option>
            </select>

            <select
              aria-label="Filter by match tier"
              className="matches-control-select"
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
            >
              <option value="all">Tier: All Matches</option>
              <option value="excellent">Excellent Match (80+)</option>
              <option value="good">Good Match (60+)</option>
              <option value="possible">Possible+ (40+)</option>
            </select>

            <label className="matches-checkbox-label">
              <input
                type="checkbox"
                checked={hideInsufficientCapacity}
                onChange={(e) => setHideInsufficientCapacity(e.target.checked)}
              />
              <span>Hide capacity-exceeded</span>
            </label>
          </div>
        </div>
      )}

      {/* Ranked NGO Cards */}
      {loading ? (
        <div className="matches-loading">
          <RefreshCw size={24} className="spin-icon" />
          <p>Evaluating NGO compatibility profiles...</p>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="matches-empty-card">
          <HelpCircle size={28} />
          <h4>No NGOs match the current filters</h4>
          <p>Try clearing the tier or capacity filter to inspect all evaluated NGO profiles.</p>
        </div>
      ) : (
        <div className="matches-grid">
          {filteredMatches.map((match, idx) => {
            const tierStyle = TIER_STYLES[match.recommendation_tier] || TIER_STYLES.low;
            const isExpanded = Boolean(expandedNgoIds[match.ngo_id]);
            const isAssigned = selectedDonation?.matched_ngo_id === match.ngo_id;
            const isConfirming = confirmAssignNgo === match.ngo_id;

            return (
              <div
                key={match.ngo_id}
                className={`ngo-match-card ${isAssigned ? 'ngo-match-assigned' : ''}`}
              >
                {/* Card Top Row */}
                <div className="ngo-match-top">
                  <div className="ngo-match-identity">
                    <div className="ngo-rank-badge">#{idx + 1}</div>
                    <div>
                      <div className="ngo-name-row">
                        <h3 className="ngo-name">{match.ngo_name}</h3>
                        {match.is_demo && (
                          <span className="demo-profile-tag">{match.demo_label || 'Demo Profile'}</span>
                        )}
                        {isAssigned && (
                          <span className="assigned-ngo-tag">
                            <CheckCircle2 size={12} /> Assigned
                          </span>
                        )}
                      </div>
                      <p className="ngo-meta">
                        {match.organization_type} • {match.ngo_profile?.location_text || 'Location unspecified'}
                      </p>
                    </div>
                  </div>

                  {/* Score & Tier */}
                  <div className="ngo-score-box">
                    <div className="ngo-score-value">
                      <span className="score-num">{match.score}</span>
                      <span className="score-denom">/100</span>
                    </div>
                    <span
                      className="ngo-tier-badge"
                      style={{
                        backgroundColor: tierStyle.bg,
                        color: tierStyle.color,
                        borderColor: tierStyle.border,
                      }}
                    >
                      {match.recommendation_label}
                    </span>
                    <span className="ngo-confidence-text">
                      {match.data_completeness}% data • {match.confidence_level} confidence
                    </span>
                  </div>
                </div>

                {/* Score Bar */}
                <div className="ngo-score-bar-track">
                  <div
                    className="ngo-score-bar-fill"
                    style={{ width: `${match.score}%`, backgroundColor: tierStyle.bar }}
                  />
                </div>

                {/* Key Indicators */}
                <div className="ngo-indicators-grid">
                  <div className="ngo-indicator">
                    <Package size={14} />
                    <span>
                      Category:{' '}
                      <strong className={`ind-${match.assessments.category_compatibility}`}>
                        {match.assessments.category_compatibility === 'matched'
                          ? 'Compatible'
                          : match.assessments.category_compatibility === 'mismatch'
                          ? 'Mismatch'
                          : 'Unknown'}
                      </strong>
                    </span>
                  </div>

                  <div className="ngo-indicator">
                    <Info size={14} />
                    <span>
                      Capacity:{' '}
                      <strong className={`ind-${match.assessments.capacity_suitability}`}>
                        {match.assessments.available_capacity_servings !== null
                          ? `${match.assessments.capacity_suitability === 'insufficient' ? 'Exceeded' : 'Suitable'} (${match.assessments.available_capacity_servings} srv)`
                          : 'Unknown'}
                      </strong>
                    </span>
                  </div>

                  <div className="ngo-indicator">
                    <MapPin size={14} />
                    <span>
                      Location:{' '}
                      <strong>
                        {match.assessments.distance_km !== null
                          ? `${match.assessments.distance_km} km`
                          : match.assessments.location_mode === 'text_fallback'
                          ? match.assessments.location_assessment === 'area_match'
                            ? 'Area Match (Fallback)'
                            : match.assessments.location_assessment === 'city_match'
                            ? 'City Overlap (Fallback)'
                            : 'No Area Overlap'
                          : 'Unavailable'}
                      </strong>
                    </span>
                  </div>

                  <div className="ngo-indicator">
                    <Truck size={14} />
                    <span>
                      Readiness:{' '}
                      <strong>
                        {match.assessments.pickup_readiness === 'ready'
                          ? 'Active • Pickup Ready'
                          : match.assessments.pickup_readiness === 'limited'
                          ? 'Limited Pickup'
                          : match.assessments.pickup_readiness === 'dropoff_only'
                          ? 'Drop-off Only'
                          : match.assessments.pickup_readiness === 'paused'
                          ? 'Paused'
                          : 'Unknown'}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Positive Reasons & Warnings */}
                <div className="ngo-explanations">
                  {match.positive_reasons.length > 0 && (
                    <ul className="ngo-reasons-list">
                      {match.positive_reasons.map((reason, i) => (
                        <li key={i}>
                          <CheckCircle2 size={14} className="icon-pos" />
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {match.warnings.length > 0 && (
                    <ul className="ngo-warnings-list">
                      {match.warnings.map((warn, i) => (
                        <li key={i}>
                          <ShieldAlert size={14} className="icon-warn" />
                          <span>{warn}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {match.missing_factors.length > 0 && (
                    <div className="ngo-missing-banner">
                      <AlertTriangle size={13} />
                      <span>
                        Missing data ({match.missing_factors.join(', ')}) — normalized across{' '}
                        {match.known_max_points}/{match.total_weight} known weight points.
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions Row */}
                <div className="ngo-card-actions">
                  <button
                    type="button"
                    className="btn-why-ngo"
                    onClick={() => toggleExpand(match.ngo_id)}
                  >
                    <span>Why this NGO?</span>
                    {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>

                  <div className="ngo-assign-area">
                    {isAssigned ? (
                      <span className="btn-assigned-state">
                        <CheckCircle2 size={15} /> Assigned to this Donation
                      </span>
                    ) : !isDonationAssignable ? (
                      <span className="ngo-status-locked">
                        Donation already {selectedDonation?.status}
                      </span>
                    ) : !onAccept ? (
                      <span className="ngo-status-locked">
                        NGO / Admin role assigns pickup
                      </span>
                    ) : isConfirming ? (
                      <div className="ngo-confirm-box">
                        <span>Confirm assignment?</span>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={assigningId === match.ngo_id}
                          onClick={() => handleConfirmAssign(match)}
                        >
                          {assigningId === match.ngo_id ? 'Assigning...' : 'Confirm'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setConfirmAssignNgo(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setConfirmAssignNgo(match.ngo_id)}
                      >
                        <span>Select &amp; Assign NGO</span>
                        <ArrowRight size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Expandable "Why this NGO?" Factor Breakdown */}
                {isExpanded && (
                  <div className="ngo-breakdown-panel">
                    <div className="breakdown-header">
                      <strong>Factor-by-Factor Score Breakdown</strong>
                      <span>
                        Raw: {match.raw_score} / {match.known_max_points} known pts → Normalized: {match.score}/100
                      </span>
                    </div>
                    <div className="breakdown-grid">
                      {match.factor_breakdown.map((f) => {
                        const pct = f.max_points > 0 ? Math.round((f.points / f.max_points) * 100) : 0;
                        return (
                          <div key={f.key} className="breakdown-item">
                            <div className="breakdown-item-top">
                              <span>{f.label}</span>
                              <span>
                                {f.data_available ? `${f.points} / ${f.max_points} pts` : `Unknown (0 / ${f.max_points})`}
                              </span>
                            </div>
                            <div className="breakdown-bar-bg">
                              <div
                                className="breakdown-bar-fill"
                                style={{
                                  width: `${f.data_available ? pct : 0}%`,
                                  backgroundColor: !f.data_available
                                    ? 'var(--color-bg-subtle-hover)'
                                    : pct >= 70
                                    ? 'var(--color-pastel-green-strong)'
                                    : pct >= 40
                                    ? 'var(--color-accent)'
                                    : 'var(--color-danger)',
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {match.ngo_profile?.contact_note && (
                      <p className="breakdown-note">
                        <strong>Logistics Note:</strong> {match.ngo_profile.contact_note}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MatchesView;
