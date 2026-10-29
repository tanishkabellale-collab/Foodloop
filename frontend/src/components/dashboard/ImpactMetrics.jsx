import React from 'react';
import { Package, Clock, CheckCircle, Award, Database } from 'lucide-react';

const MetricCard = ({ label, value, subtext, icon: Icon, color = 'var(--color-primary)' }) => {
  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
          {label}
        </span>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          backgroundColor: 'var(--color-bg-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color
        }}>
          <Icon size={18} />
        </div>
      </div>
      <div className="tabular-nums" style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-primary)', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-subtle)', marginTop: '0.4rem' }}>
        {subtext}
      </div>
    </div>
  );
};

const ImpactMetrics = ({ donations = [] }) => {
  const total = donations.length;
  const active = donations.filter(d => (d.status || 'available') === 'available' || (d.status || '') === 'submitted').length;
  const accepted = donations.filter(d => (d.status || '') === 'accepted').length;
  const collected = donations.filter(d => (d.status || '') === 'collected').length;

  return (
    <div className="mb-6">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', marginBottom: '0.15rem' }}>Platform Activity Overview</h2>
          <p style={{ fontSize: '0.85rem', margin: 0 }}>Operational intake, claim, and collection totals.</p>
        </div>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.25rem 0.65rem',
          backgroundColor: 'var(--color-bg-subtle)',
          borderRadius: '9999px',
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'var(--color-text-muted)',
          border: '1px solid var(--color-border)'
        }}>
          <Database size={12} />
          <span>Application &amp; Demo Data</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4">
        <MetricCard 
          label="Total Registered"
          value={total}
          subtext="Cumulative listings"
          icon={Package}
          color="var(--color-primary)"
        />
        <MetricCard 
          label="Active / Available"
          value={active}
          subtext="Awaiting NGO claim"
          icon={Clock}
          color="var(--color-accent)"
        />
        <MetricCard 
          label="Accepted"
          value={accepted}
          subtext="Claimed for dispatch"
          icon={CheckCircle}
          color="var(--color-secondary)"
        />
        <MetricCard 
          label="Collected"
          value={collected}
          subtext="Delivered &amp; completed"
          icon={Award}
          color="#5D2A9E"
        />
      </div>
    </div>
  );
};

export default ImpactMetrics;

