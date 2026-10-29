import React from 'react';
import { BarChart3, Database, PieChart, Layers, Clock, CheckCircle } from 'lucide-react';

const CATEGORY_NAMES = {
  cooked_meals: 'Cooked Meals',
  fresh_produce: 'Fresh Produce',
  bakery: 'Bakery',
  packaged_sealed: 'Packaged / Sealed'
};

const AnalyticsView = ({ donations = [] }) => {
  const total = donations.length;
  const active = donations.filter(d => (d.status || 'available') === 'available' || d.status === 'submitted').length;
  const accepted = donations.filter(d => d.status === 'accepted').length;
  const collected = donations.filter(d => d.status === 'collected').length;

  // Compute category distribution directly from donations array
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

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)', marginBottom: '0.25rem' }}>
            <BarChart3 size={24} />
            <h1 style={{ fontSize: '1.85rem', marginBottom: 0 }}>Platform Activity Telemetry</h1>
          </div>
          <p style={{ fontSize: '0.95rem', margin: 0 }}>
            Real-time status breakdowns and category distributions computed from registered records.
          </p>
        </div>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.35rem 0.8rem',
          backgroundColor: 'var(--color-bg-subtle)',
          borderRadius: '9999px',
          fontSize: '0.8rem',
          fontWeight: 600,
          color: 'var(--color-text-muted)',
          border: '1px solid var(--color-border)'
        }}>
          <Database size={14} />
          <span>Application &amp; Demo Data</span>
        </div>
      </div>

      {/* Top Level Numerical Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Total Registered</div>
          <div className="tabular-nums" style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: '0.35rem' }}>
            {total}
          </div>
          <div style={{ fontSize: '0.785rem', color: 'var(--color-text-subtle)', marginTop: '0.25rem' }}>Active database records</div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Available Surplus</div>
          <div className="tabular-nums" style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-accent)', marginTop: '0.35rem' }}>
            {active}
          </div>
          <div style={{ fontSize: '0.785rem', color: 'var(--color-text-subtle)', marginTop: '0.25rem' }}>Ready for NGO claim</div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Claimed Pickups</div>
          <div className="tabular-nums" style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-secondary)', marginTop: '0.35rem' }}>
            {accepted}
          </div>
          <div style={{ fontSize: '0.785rem', color: 'var(--color-text-subtle)', marginTop: '0.25rem' }}>En route / scheduled</div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Rescues Completed</div>
          <div className="tabular-nums" style={{ fontSize: '2rem', fontWeight: 800, color: '#5D2A9E', marginTop: '0.35rem' }}>
            {collected}
          </div>
          <div style={{ fontSize: '0.785rem', color: 'var(--color-text-subtle)', marginTop: '0.25rem' }}>Confirmed by recipient</div>
        </div>
      </div>

      {/* Breakdown Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Category Breakdown */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <Layers size={18} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{ fontSize: '1.15rem', marginBottom: 0 }}>Category Distribution</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {['cooked_meals', 'fresh_produce', 'bakery', 'packaged_sealed'].map(cat => {
              const count = categoryCounts[cat] || 0;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              const label = CATEGORY_NAMES[cat];

              return (
                <div key={cat}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.35rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>{label}</span>
                    <span className="tabular-nums" style={{ color: 'var(--color-text-muted)' }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: 'var(--color-bg-subtle)', borderRadius: '9999px', overflow: 'hidden' }}>
                    <div style={{ 
                      width: `${pct}%`, 
                      height: '100%', 
                      backgroundColor: cat === 'cooked_meals' ? 'var(--color-primary)' : cat === 'fresh_produce' ? 'var(--color-secondary)' : cat === 'bakery' ? 'var(--color-warning)' : 'var(--color-accent)',
                      borderRadius: '9999px',
                      transition: 'width 0.5s ease'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dietary Distribution */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <PieChart size={18} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{ fontSize: '1.15rem', marginBottom: 0 }}>Dietary Classification</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.35rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>🟢 Vegetarian</span>
                <span className="tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                  {dietaryCounts.vegetarian || 0} ({total > 0 ? Math.round(((dietaryCounts.vegetarian || 0) / total) * 100) : 0}%)
                </span>
              </div>
              <div style={{ height: '8px', backgroundColor: 'var(--color-bg-subtle)', borderRadius: '9999px', overflow: 'hidden' }}>
                <div style={{ 
                  width: `${total > 0 ? Math.round(((dietaryCounts.vegetarian || 0) / total) * 100) : 0}%`, 
                  height: '100%', 
                  backgroundColor: '#2F6126',
                  borderRadius: '9999px'
                }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.35rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>🔴 Non-Vegetarian</span>
                <span className="tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                  {dietaryCounts.non_vegetarian || 0} ({total > 0 ? Math.round(((dietaryCounts.non_vegetarian || 0) / total) * 100) : 0}%)
                </span>
              </div>
              <div style={{ height: '8px', backgroundColor: 'var(--color-bg-subtle)', borderRadius: '9999px', overflow: 'hidden' }}>
                <div style={{ 
                  width: `${total > 0 ? Math.round(((dietaryCounts.non_vegetarian || 0) / total) * 100) : 0}%`, 
                  height: '100%', 
                  backgroundColor: '#A32A2A',
                  borderRadius: '9999px'
                }} />
              </div>
            </div>

            <div style={{
              padding: '0.85rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-bg-base)',
              fontSize: '0.8rem',
              color: 'var(--color-text-muted)',
              lineHeight: 1.5,
              marginTop: '0.5rem'
            }}>
              Telemetry is computed strictly from active local donations in <code>backend/data.json</code>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsView;

