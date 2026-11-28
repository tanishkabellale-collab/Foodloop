import React from 'react';
import { BarChart3, Database, PieChart, Layers } from 'lucide-react';

const CATEGORY_NAMES = {
  cooked_meals: 'Cooked meals',
  fresh_produce: 'Fresh produce',
  bakery: 'Bakery',
  packaged_sealed: 'Packaged / sealed',
};

const AnalyticsView = ({ donations = [] }) => {
  const total = donations.length;
  const active = donations.filter((d) => (d.status || 'available') === 'available' || d.status === 'submitted').length;
  const accepted = donations.filter((d) => d.status === 'accepted').length;
  const collected = donations.filter((d) => d.status === 'collected').length;

  const categoryCounts = donations.reduce((acc, d) => {
    const cat = d.food_category || 'cooked_meals';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  const dietaryCounts = donations.reduce((acc, d) => {
    const dt = d.dietary_type || 'vegetarian';
    acc[dt] = (acc[dt] || 0) + 1;
    return acc;
  }, {});

  const vegPct = total > 0 ? Math.round(((dietaryCounts.vegetarian || 0) / total) * 100) : 0;
  const nonVegPct = total > 0 ? Math.round(((dietaryCounts.non_vegetarian || 0) / total) * 100) : 0;

  return (
    <div className="page-enter" style={{ maxWidth: '1120px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-ink)', marginBottom: '4px' }}>
            <BarChart3 size={20} strokeWidth={1.65} />
            <h2 style={{ fontSize: '24px', margin: 0 }}>Platform telemetry</h2>
          </div>
          <p style={{ fontSize: '14px', margin: 0 }}>
            Real-time status breakdowns and category shares computed from SQLite records
          </p>
        </div>

        <div className="category-pill mono">
          <Database size={13} strokeWidth={1.65} />
          <span>SQLite live records</span>
        </div>
      </div>

      {/* 4 Compact Stat Cards */}
      <div className="dash-stats-grid mb-6">
        <div className="dash-stat-card">
          <span className="dash-stat-label">Total registered</span>
          <span className="dash-stat-value">{total}</span>
          <span className="dash-stat-subtitle">Cumulative batches</span>
        </div>

        <div className="dash-stat-card">
          <span className="dash-stat-label">Available surplus</span>
          <span className="dash-stat-value" style={{ color: 'var(--color-pastel-green-ink)' }}>{active}</span>
          <span className="dash-stat-subtitle">Open for NGO claim</span>
        </div>

        <div className="dash-stat-card">
          <span className="dash-stat-label">Claimed pickups</span>
          <span className="dash-stat-value" style={{ color: 'var(--color-accent-ink)' }}>{accepted}</span>
          <span className="dash-stat-subtitle">Scheduled or en route</span>
        </div>

        <div className="dash-stat-card">
          <span className="dash-stat-label">Rescues completed</span>
          <span className="dash-stat-value">{collected}</span>
          <span className="dash-stat-subtitle">Verified delivered</span>
        </div>
      </div>

      {/* Asymmetric Breakdown Row */}
      <div className="dash-main-grid">
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <Layers size={16} strokeWidth={1.65} style={{ color: 'var(--color-text-muted)' }} />
            <h3 style={{ fontSize: '16px', margin: 0 }}>Category distribution</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {['cooked_meals', 'fresh_produce', 'bakery', 'packaged_sealed'].map((cat) => {
              const count = categoryCounts[cat] || 0;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              const barColor =
                cat === 'cooked_meals'
                  ? 'var(--color-ink)'
                  : cat === 'fresh_produce'
                  ? '#82C27C'
                  : cat === 'bakery'
                  ? 'var(--color-accent)'
                  : '#9A948A';

              return (
                <div key={cat}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 500, color: 'var(--color-ink)' }}>{CATEGORY_NAMES[cat]}</span>
                    <span className="mono" style={{ color: 'var(--color-text-muted)' }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: 'var(--color-bg-base)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        backgroundColor: barColor,
                        borderRadius: '4px',
                        transition: 'width 320ms var(--ease-out)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <PieChart size={16} strokeWidth={1.65} style={{ color: 'var(--color-text-muted)' }} />
            <h3 style={{ fontSize: '16px', margin: 0 }}>Dietary classification</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 500, color: 'var(--color-ink)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#56A450' }} />
                  <span>Vegetarian</span>
                </span>
                <span className="mono" style={{ color: 'var(--color-text-muted)' }}>
                  {dietaryCounts.vegetarian || 0} ({vegPct}%)
                </span>
              </div>
              <div style={{ height: '8px', backgroundColor: 'var(--color-bg-base)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${vegPct}%`, height: '100%', backgroundColor: '#82C27C', borderRadius: '4px' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 500, color: 'var(--color-ink)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--color-accent)' }} />
                  <span>Non-vegetarian</span>
                </span>
                <span className="mono" style={{ color: 'var(--color-text-muted)' }}>
                  {dietaryCounts.non_vegetarian || 0} ({nonVegPct}%)
                </span>
              </div>
              <div style={{ height: '8px', backgroundColor: 'var(--color-bg-base)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${nonVegPct}%`, height: '100%', backgroundColor: 'var(--color-accent)', borderRadius: '4px' }} />
              </div>
            </div>

            <div className="dash-info-note" style={{ marginTop: '4px' }}>
              <span>
                Telemetry is computed from persisted donation batches in SQLite, including historical legacy records.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsView;
