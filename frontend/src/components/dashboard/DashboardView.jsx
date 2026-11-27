import React, { useMemo } from 'react';
import {
  Package, Clock, Truck, CheckCircle, Heart, Scale,
  PlusCircle, GitFork, BarChart3, ArrowRight,
  AlertTriangle, MapPin, Eye, Info, Sparkles
} from 'lucide-react';
import StatusBadge from '../common/StatusBadge';
import CategoryPill from '../common/CategoryPill';

/* ── Helpers ────────────────────────────────────────── */
const UNIT_TO_MEALS = { servings: 1, plates: 1, trays: 8, boxes: 4 };

const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

const remainingTime = (dateStr) => {
  if (!dateStr) return 'N/A';
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const rm = mins % 60;
  return hours > 0 ? `${hours}h ${rm}m left` : `${rm}m left`;
};

const parseQty = (d) => typeof d.quantity === 'number' ? d.quantity : (parseFloat(d.quantity) || 0);

/* ── Stat Card ──────────────────────────────────────── */
const StatCard = ({ icon: Icon, label, value, subtitle, color, bgColor }) => (
  <div className="dash-stat-card">
    <div className="dash-stat-top">
      <div className="dash-stat-icon" style={{ backgroundColor: bgColor, color }}>
        <Icon size={20} />
      </div>
    </div>
    <div className="dash-stat-value">{value}</div>
    <div className="dash-stat-label">{label}</div>
    {subtitle && <div className="dash-stat-subtitle">{subtitle}</div>}
  </div>
);

/* ── Donut Chart ────────────────────────────────────── */
const DonutChart = ({ segments, size = 148 }) => {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  let angle = 0;
  const parts = total > 0
    ? segments.filter(s => s.value > 0).map(seg => {
        const start = angle;
        const sweep = (seg.value / total) * 360;
        angle += sweep;
        return `${seg.color} ${start}deg ${start + sweep}deg`;
      })
    : ['var(--color-border) 0deg 360deg'];

  return (
    <div className="donut-wrapper">
      <div className="donut-ring" style={{
        width: size, height: size,
        background: `conic-gradient(${parts.join(', ')})`
      }}>
        <div className="donut-center">
          <span className="donut-total">{total}</span>
          <span className="donut-label">Total</span>
        </div>
      </div>
      <div className="donut-legend">
        {segments.map(seg => (
          <div key={seg.label} className="donut-legend-item">
            <span className="donut-legend-dot" style={{ backgroundColor: seg.color }} />
            <span className="donut-legend-text">{seg.label}</span>
            <span className="donut-legend-count">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── Main Dashboard ─────────────────────────────────── */
const DashboardView = ({ donations = [], loading, onTabChange, onSelectDonation }) => {
  const stats = useMemo(() => {
    const available = donations.filter(d => d.status === 'available' || d.status === 'submitted').length;
    const accepted  = donations.filter(d => d.status === 'accepted').length;
    const collected = donations.filter(d => d.status === 'collected').length;

    let totalQty = 0, estimatedMeals = 0;
    donations.filter(d => d.status === 'collected').forEach(d => {
      const q = parseQty(d);
      totalQty += q;
      estimatedMeals += q * (UNIT_TO_MEALS[d.quantity_unit] || 1);
    });

    const now = Date.now();
    const threeH = 3 * 60 * 60 * 1000;
    const urgent = donations.filter(d => {
      if (d.status !== 'available' && d.status !== 'submitted') return false;
      const dl = d.pickup_available_until || d.expiryTime;
      if (!dl) return false;
      const t = new Date(dl).getTime();
      return t > now && (t - now) <= threeH;
    });

    return { total: donations.length, available, accepted, collected,
             totalQty: Math.round(totalQty), estimatedMeals: Math.round(estimatedMeals), urgent };
  }, [donations]);

  const categoryData = useMemo(() => {
    const c = {};
    donations.forEach(d => { const k = d.food_category || 'other'; c[k] = (c[k] || 0) + 1; });
    return [
      { label: 'Cooked Meals', count: c.cooked_meals || 0, color: '#12352A' },
      { label: 'Fresh Produce', count: c.fresh_produce || 0, color: '#5B8C51' },
      { label: 'Bakery Goods', count: c.bakery || 0, color: '#E7A52B' },
      { label: 'Packaged / Sealed', count: c.packaged_sealed || 0, color: '#F47A20' },
    ];
  }, [donations]);

  const recent = donations.slice(0, 5);
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';

  if (loading && donations.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6rem 2rem', flexDirection: 'column', gap: '1rem' }}>
        <div className="spinner" style={{ width: 36, height: 36 }} />
        <p style={{ color: 'var(--color-text-muted)' }}>Loading dashboard data…</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Welcome */}
      <div className="dash-welcome">
        <div>
          <h2 className="dash-welcome-title">{greeting}! 👋</h2>
          <p className="dash-welcome-sub">Here's what's happening on the FoodLoop rescue network today.</p>
        </div>
        <button className="btn btn-primary" onClick={() => onTabChange('create')}>
          <PlusCircle size={18} /> <span>Create Donation</span>
        </button>
      </div>

      {/* ── Stat Cards ────────────────────────────── */}
      <div className="dash-stats-grid">
        <StatCard icon={Package} label="Total Listings" value={stats.total}
          subtitle="Cumulative records" color="#12352A" bgColor="rgba(18,53,42,0.08)" />
        <StatCard icon={Clock} label="Available Now" value={stats.available}
          subtitle="Awaiting NGO claim" color="#5B8C51" bgColor="rgba(91,140,81,0.1)" />
        <StatCard icon={Truck} label="Pending Pickup" value={stats.accepted}
          subtitle="Claimed, en-route" color="#3B82F6" bgColor="rgba(59,130,246,0.08)" />
        <StatCard icon={CheckCircle} label="Rescues Complete" value={stats.collected}
          subtitle="Successfully collected" color="#8B5CF6" bgColor="rgba(139,92,246,0.08)" />
        <StatCard icon={Heart} label="Est. Meals Saved" value={`~${stats.estimatedMeals}`}
          subtitle="1 srv/plate = 1 meal, tray ≈ 8, box ≈ 4" color="#F47A20" bgColor="rgba(244,122,32,0.08)" />
        <StatCard icon={Scale} label="Food Quantity" value={stats.totalQty}
          subtitle="Units collected total" color="#E7A52B" bgColor="rgba(231,165,43,0.1)" />
      </div>

      {/* ── Row 2: Status + Recent Activity ───────── */}
      <div className="dash-row-2col">
        {/* Status Breakdown */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div className="dash-card-title">
              <BarChart3 size={18} className="dash-card-title-icon" />
              <span>Donation Status Overview</span>
            </div>
          </div>
          <DonutChart segments={[
            { label: 'Available', value: stats.available, color: '#5B8C51' },
            { label: 'Pending Pickup', value: stats.accepted, color: '#3B82F6' },
            { label: 'Collected', value: stats.collected, color: '#8B5CF6' },
          ]} />

          {/* Category Breakdown */}
          <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--color-border)' }}>
            <div className="dash-card-title" style={{ marginBottom: '0.85rem' }}>
              <span>Category Distribution</span>
            </div>
            {categoryData.map(cat => {
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

        {/* Recent Activity */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div className="dash-card-title">
              <Sparkles size={18} className="dash-card-title-icon" />
              <span>Recent Activity</span>
            </div>
            <button className="btn btn-ghost" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
              onClick={() => onTabChange('donations')}>
              View All <ArrowRight size={14} />
            </button>
          </div>
          {recent.length === 0 ? (
            <div className="dash-empty">No donation activity recorded yet.</div>
          ) : (
            <div className="activity-feed">
              {recent.map(d => {
                const title = d.title || d.foodName || 'Surplus Food';
                const loc = d.address_text || d.location || '';
                return (
                  <div key={d.id} className="activity-row" onClick={() => onSelectDonation && onSelectDonation(d)}>
                    <div className="activity-left">
                      <StatusBadge status={d.status} size="small" />
                      <div className="activity-info">
                        <span className="activity-name">{title}</span>
                        <span className="activity-meta">
                          {loc && <><MapPin size={11} /> {loc}</>}
                        </span>
                      </div>
                    </div>
                    <div className="activity-right">
                      <CategoryPill category={d.food_category} />
                      <span className="activity-time">{timeAgo(d.created_at || d.createdAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 3: Urgent + Quick Actions ─────────── */}
      <div className="dash-row-2col">
        {/* Urgent Pickups */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div className="dash-card-title">
              <AlertTriangle size={18} style={{ color: '#E7A52B' }} />
              <span>Urgent Pickups</span>
            </div>
            {stats.urgent.length > 0 && (
              <span className="dash-urgent-badge">{stats.urgent.length} urgent</span>
            )}
          </div>
          {stats.urgent.length === 0 ? (
            <div className="dash-empty">
              <CheckCircle size={20} style={{ color: 'var(--color-secondary)' }} />
              <span>No urgent pickups at this time. All deadlines are comfortable.</span>
            </div>
          ) : (
            <div className="urgent-list">
              {stats.urgent.map(d => (
                <div key={d.id} className="urgent-row" onClick={() => onSelectDonation && onSelectDonation(d)}>
                  <div className="urgent-indicator" />
                  <div className="urgent-info">
                    <span className="urgent-name">{d.title || d.foodName}</span>
                    <span className="urgent-detail">
                      <MapPin size={12} /> {d.address_text || d.location || 'Location specified'}
                    </span>
                  </div>
                  <div className="urgent-timer">
                    <Clock size={14} />
                    <span>{remainingTime(d.pickup_available_until || d.expiryTime)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div className="dash-card-title"><span>Quick Actions</span></div>
          </div>
          <div className="quick-actions">
            <button className="quick-action-btn" onClick={() => onTabChange('create')}>
              <div className="quick-action-icon" style={{ backgroundColor: 'rgba(244,122,32,0.1)', color: '#F47A20' }}>
                <PlusCircle size={22} />
              </div>
              <div className="quick-action-text">
                <span className="quick-action-label">Add Donation</span>
                <span className="quick-action-desc">Register surplus food</span>
              </div>
              <ArrowRight size={16} className="quick-action-arrow" />
            </button>
            <button className="quick-action-btn" onClick={() => onTabChange('donations')}>
              <div className="quick-action-icon" style={{ backgroundColor: 'rgba(91,140,81,0.1)', color: '#5B8C51' }}>
                <Package size={22} />
              </div>
              <div className="quick-action-text">
                <span className="quick-action-label">Browse Donations</span>
                <span className="quick-action-desc">View available surplus</span>
              </div>
              <ArrowRight size={16} className="quick-action-arrow" />
            </button>
            <button className="quick-action-btn" onClick={() => onTabChange('matches')}>
              <div className="quick-action-icon" style={{ backgroundColor: 'rgba(59,130,246,0.1)', color: '#3B82F6' }}>
                <GitFork size={22} />
              </div>
              <div className="quick-action-text">
                <span className="quick-action-label">Find NGO</span>
                <span className="quick-action-desc">Intelligent matching</span>
              </div>
              <ArrowRight size={16} className="quick-action-arrow" />
            </button>
            <button className="quick-action-btn" onClick={() => onTabChange('analytics')}>
              <div className="quick-action-icon" style={{ backgroundColor: 'rgba(139,92,246,0.1)', color: '#8B5CF6' }}>
                <BarChart3 size={22} />
              </div>
              <div className="quick-action-text">
                <span className="quick-action-label">View Impact</span>
                <span className="quick-action-desc">Rescue analytics</span>
              </div>
              <ArrowRight size={16} className="quick-action-arrow" />
            </button>
          </div>

          {/* Meals assumption note */}
          <div className="dash-info-note">
            <Info size={14} />
            <span>Meals estimated from collected quantities: 1 serving/plate = 1 meal, 1 tray ≈ 8 meals, 1 box ≈ 4 meals. Actual impact may vary.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;

