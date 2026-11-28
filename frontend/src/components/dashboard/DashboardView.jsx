import React, { useMemo, useState, useEffect } from 'react';
import {
  Package, CheckCircle, Plus, GitFork, BarChart3, ArrowRight,
  Clock, MapPin, Info
} from 'lucide-react';
import StatusBadge from '../common/StatusBadge';
import CategoryPill from '../common/CategoryPill';

const UNIT_TO_MEALS = { servings: 1, plates: 1, trays: 8, boxes: 4 };

const timeAgo = (dateStr, nowMs) => {
  if (!dateStr) return '';
  const diff = nowMs - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

const remainingTime = (dateStr, nowMs) => {
  if (!dateStr) return 'N/A';
  const diff = new Date(dateStr).getTime() - nowMs;
  if (diff <= 0) return 'Expired';
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const rm = mins % 60;
  return hours > 0 ? `${hours}h ${rm}m left` : `${rm}m left`;
};

const parseQty = (d) => (typeof d.quantity === 'number' ? d.quantity : (parseFloat(d.quantity) || 0));

const StatCard = ({ label, value, context }) => (
  <div className="dash-stat-card">
    <span className="dash-stat-label">{label}</span>
    <span className="dash-stat-value">{value}</span>
    <span className="dash-stat-subtitle">{context}</span>
  </div>
);

const DashboardView = ({ donations = [], loading, onTabChange, onSelectDonation }) => {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const stats = useMemo(() => {
    const available = donations.filter((d) => d.status === 'available' || d.status === 'submitted').length;
    const accepted = donations.filter((d) => d.status === 'accepted').length;
    const collected = donations.filter((d) => d.status === 'collected').length;

    let totalQty = 0;
    let estimatedMeals = 0;
    donations.filter((d) => d.status === 'collected').forEach((d) => {
      const q = parseQty(d);
      totalQty += q;
      estimatedMeals += q * (UNIT_TO_MEALS[d.quantity_unit] || 1);
    });

    const threeH = 3 * 60 * 60 * 1000;
    const urgent = donations.filter((d) => {
      if (d.status !== 'available' && d.status !== 'submitted') return false;
      const dl = d.pickup_available_until || d.expiryTime;
      if (!dl) return false;
      const t = new Date(dl).getTime();
      return t > nowMs && (t - nowMs) <= threeH;
    });

    return {
      total: donations.length,
      available,
      accepted,
      collected,
      totalQty: Math.round(totalQty),
      estimatedMeals: Math.round(estimatedMeals),
      urgent,
    };
  }, [donations, nowMs]);

  const categoryData = useMemo(() => {
    const c = {};
    donations.forEach((d) => {
      const k = d.food_category || 'other';
      c[k] = (c[k] || 0) + 1;
    });
    return [
      { label: 'Cooked meals', count: c.cooked_meals || 0, color: '#111110' },
      { label: 'Fresh produce', count: c.fresh_produce || 0, color: '#7BB875' },
      { label: 'Bakery', count: c.bakery || 0, color: '#EA5D1A' },
      { label: 'Packaged', count: c.packaged_sealed || 0, color: '#8F8A80' },
    ];
  }, [donations]);

  const recent = donations.slice(0, 5);
  const dateLabel = new Date(nowMs).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });

  if (loading && donations.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', flexDirection: 'column', gap: '12px' }}>
        <div className="spinner" style={{ width: 28, height: 28 }} />
        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Loading operations data</p>
      </div>
    );
  }

  const totalFlow = stats.available + stats.accepted + stats.collected;
  const pctAvail = totalFlow > 0 ? (stats.available / totalFlow) * 100 : 0;
  const pctClaimed = totalFlow > 0 ? (stats.accepted / totalFlow) * 100 : 0;
  const pctDone = totalFlow > 0 ? (stats.collected / totalFlow) * 100 : 0;

  return (
    <div className="dashboard page-enter">
      {/* Header Row — Concrete Context, Zero Greeting Emoji */}
      <div className="dash-welcome">
        <div>
          <h2 className="dash-welcome-title">Rescue dispatch ledger</h2>
          <p className="dash-welcome-sub">Network summary as of {dateLabel}</p>
        </div>
        <button type="button" className="btn btn-orange" onClick={() => onTabChange('create')}>
          <Plus size={16} strokeWidth={1.75} />
          <span>Register surplus</span>
        </button>
      </div>

      {/* 4 Compact Number-First KPI Cards */}
      <div className="dash-stats-grid">
        <StatCard
          label="Total listings"
          value={stats.total}
          context="Cumulative records in network"
        />
        <StatCard
          label="Available for claim"
          value={stats.available}
          context="Active pickup windows"
        />
        <StatCard
          label="In dispatch"
          value={stats.accepted}
          context="Claimed and awaiting drop-off"
        />
        <StatCard
          label="Est. meals rescued"
          value={stats.estimatedMeals}
          context={`${stats.collected} completed (${stats.totalQty} units)`}
        />
      </div>

      {/* Asymmetric Primary Row: Wide Status/Category Breakdown + Recent Activity */}
      <div className="dash-main-grid">
        <div className="dash-card">
          <div className="dash-card-header">
            <div className="dash-card-title">
              <BarChart3 size={16} strokeWidth={1.65} style={{ color: 'var(--color-text-muted)' }} />
              <span>Intake status and category distribution</span>
            </div>
            <span className="mono" style={{ fontSize: '12px', color: 'var(--color-text-subtle)' }}>
              {stats.total} records
            </span>
          </div>

          <div className="stacked-flow-bar" role="img" aria-label="Donation status split">
            {pctAvail > 0 && <div style={{ width: `${pctAvail}%`, backgroundColor: '#9FD09A' }} />}
            {pctClaimed > 0 && <div style={{ width: `${pctClaimed}%`, backgroundColor: 'var(--color-accent)' }} />}
            {pctDone > 0 && <div style={{ width: `${pctDone}%`, backgroundColor: 'var(--color-ink)' }} />}
          </div>

          <div className="stacked-flow-legend">
            <div className="flow-legend-item">
              <span className="flow-legend-dot" style={{ backgroundColor: '#9FD09A' }} />
              <span>Available</span>
              <span className="flow-legend-num">{stats.available}</span>
            </div>
            <div className="flow-legend-item">
              <span className="flow-legend-dot" style={{ backgroundColor: 'var(--color-accent)' }} />
              <span>Claimed</span>
              <span className="flow-legend-num">{stats.accepted}</span>
            </div>
            <div className="flow-legend-item">
              <span className="flow-legend-dot" style={{ backgroundColor: 'var(--color-ink)' }} />
              <span>Collected</span>
              <span className="flow-legend-num">{stats.collected}</span>
            </div>
          </div>

          <div style={{ marginTop: '20px' }}>
            {categoryData.map((cat) => {
              const pct = stats.total > 0 ? Math.round((cat.count / stats.total) * 100) : 0;
              return (
                <div key={cat.label} className="cat-bar-row">
                  <div className="cat-bar-header">
                    <span className="cat-bar-label">{cat.label}</span>
                    <span className="cat-bar-value">{cat.count} ({pct}%)</span>
                  </div>
                  <div className="cat-bar-track">
                    <div className="cat-bar-fill" style={{ width: `${pct}%`, backgroundColor: cat.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Activity Ledger */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div className="dash-card-title">
              <span>Recent batches</span>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onTabChange('donations')}
            >
              <span>View all</span>
              <ArrowRight size={14} strokeWidth={1.65} />
            </button>
          </div>

          {recent.length === 0 ? (
            <div className="dash-empty">No donation activity recorded yet</div>
          ) : (
            <div className="activity-feed">
              {recent.map((d) => {
                const title = d.title || d.foodName || 'Surplus food';
                const loc = d.address_text || d.location || '';
                return (
                  <div
                    key={d.id}
                    className="activity-row"
                    onClick={() => onSelectDonation && onSelectDonation(d)}
                  >
                    <div className="activity-left">
                      <StatusBadge status={d.status} size="small" />
                      <div className="activity-info">
                        <span className="activity-name">{title}</span>
                        <span className="activity-meta">
                          {loc && (
                            <>
                              <MapPin size={11} strokeWidth={1.65} /> {loc}
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="activity-right">
                      <CategoryPill category={d.food_category} />
                      <span className="activity-time">{timeAgo(d.created_at || d.createdAt, nowMs)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Expiring Pickup Rail + Quick Navigation */}
      <div className="dash-row-2col">
        <div className="dash-card">
          <div className="dash-card-header">
            <div className="dash-card-title">
              <Clock size={16} strokeWidth={1.65} style={{ color: 'var(--color-accent-ink)' }} />
              <span>Closing pickup windows</span>
            </div>
            {stats.urgent.length > 0 && (
              <span className="dash-urgent-badge">{stats.urgent.length} under 3h</span>
            )}
          </div>

          {stats.urgent.length === 0 ? (
            <div className="dash-empty">
              <CheckCircle size={16} strokeWidth={1.65} style={{ color: 'var(--color-pastel-green-ink)' }} />
              <span>No active listings expiring in the next 3 hours</span>
            </div>
          ) : (
            <div className="urgent-list">
              {stats.urgent.map((d) => (
                <div
                  key={d.id}
                  className="urgent-row"
                  onClick={() => onSelectDonation && onSelectDonation(d)}
                >
                  <span className="route-anchor-dot" />
                  <div className="urgent-info">
                    <span className="urgent-name">{d.title || d.foodName}</span>
                    <span className="urgent-detail">
                      <MapPin size={12} strokeWidth={1.65} /> {d.address_text || d.location || 'Address on file'}
                    </span>
                  </div>
                  <div className="urgent-timer">
                    <Clock size={13} strokeWidth={1.65} />
                    <span>{remainingTime(d.pickup_available_until || d.expiryTime, nowMs)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dash-card">
          <div className="dash-card-header">
            <div className="dash-card-title"><span>Workflow actions</span></div>
          </div>

          <div className="quick-actions">
            <button type="button" className="quick-action-btn" onClick={() => onTabChange('create')}>
              <span className="quick-action-icon"><Plus size={18} strokeWidth={1.65} /></span>
              <div className="quick-action-text">
                <span className="quick-action-label">Add donation</span>
                <span className="quick-action-desc">Register surplus batch</span>
              </div>
              <ArrowRight size={15} strokeWidth={1.65} className="quick-action-arrow" />
            </button>

            <button type="button" className="quick-action-btn" onClick={() => onTabChange('donations')}>
              <span className="quick-action-icon"><Package size={18} strokeWidth={1.65} /></span>
              <div className="quick-action-text">
                <span className="quick-action-label">Browse listings</span>
                <span className="quick-action-desc">Filter active surplus</span>
              </div>
              <ArrowRight size={15} strokeWidth={1.65} className="quick-action-arrow" />
            </button>

            <button type="button" className="quick-action-btn" onClick={() => onTabChange('matches')}>
              <span className="quick-action-icon"><GitFork size={18} strokeWidth={1.65} /></span>
              <div className="quick-action-text">
                <span className="quick-action-label">Match NGOs</span>
                <span className="quick-action-desc">Score recipient fit</span>
              </div>
              <ArrowRight size={15} strokeWidth={1.65} className="quick-action-arrow" />
            </button>

            <button type="button" className="quick-action-btn" onClick={() => onTabChange('pickup')}>
              <span className="quick-action-icon"><BarChart3 size={18} strokeWidth={1.65} /></span>
              <div className="quick-action-text">
                <span className="quick-action-label">Track dispatch</span>
                <span className="quick-action-desc">Verify pickup OTPs</span>
              </div>
              <ArrowRight size={15} strokeWidth={1.65} className="quick-action-arrow" />
            </button>
          </div>

          <div className="dash-info-note">
            <Info size={14} strokeWidth={1.65} />
            <span>
              Meal counts approximate collected servings (1 plate = 1 meal, 1 tray ≈ 8 meals, 1 box ≈ 4 meals).
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
