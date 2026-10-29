import React from 'react';
import { GitFork, Sparkles, Compass, ShieldCheck, Heart, Clock } from 'lucide-react';

const MatchesView = ({ onTabChange }) => {
  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.25rem 0.75rem',
          borderRadius: 'var(--radius-pill)',
          backgroundColor: 'var(--color-accent-subtle)',
          color: 'var(--color-accent)',
          fontSize: '0.8rem',
          fontWeight: 700,
          marginBottom: '1rem',
          border: '1px solid rgba(244, 122, 32, 0.2)'
        }}>
          <Sparkles size={14} />
          <span>Intelligent Matching Engine</span>
        </div>

        <h1 style={{ fontSize: '2.25rem', color: 'var(--color-primary)', marginBottom: '0.75rem' }}>
          Intelligent Matching
        </h1>

        <p style={{ fontSize: '1.05rem', color: 'var(--color-text-muted)', maxWidth: '640px', margin: '0 auto' }}>
          FoodLoop's algorithmic routing connects verified surplus food with receiving organizations based on operational capacity, dietary compatibility, and pickup urgency.
        </p>
      </div>

      {/* Empty / Foundation State Banner */}
      <div className="card mb-8" style={{
        textAlign: 'center',
        padding: '3rem 2rem',
        backgroundColor: 'var(--color-bg-surface)',
        border: '1.5px dashed var(--color-border)',
        boxShadow: 'none'
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: 'var(--color-bg-subtle)',
          color: 'var(--color-accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.25rem'
        }}>
          <Compass size={28} />
        </div>

        <h3 style={{ fontSize: '1.4rem', color: 'var(--color-primary)', marginBottom: '0.5rem' }}>
          Smart matching is coming online.
        </h3>

        <p style={{ maxWidth: '480px', margin: '0 auto 1.5rem', fontSize: '0.925rem' }}>
          In this sprint, NGOs can browse and claim all active community donations directly through the Donations directory or NGO Coordination hub.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={() => onTabChange('donations')}
          >
            Explore Active Donations
          </button>
        </div>
      </div>

      {/* Core Architectural Principles (No fake data or fake scores) */}
      <h3 style={{ fontSize: '1.25rem', color: 'var(--color-primary)', marginBottom: '1rem', textAlign: 'center' }}>
        How the FoodLoop Matching Architecture Operates
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-secondary-subtle)',
            color: 'var(--color-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem'
          }}>
            <Heart size={20} />
          </div>
          <h4 style={{ fontSize: '1.05rem', marginBottom: '0.35rem' }}>Dietary Alignment</h4>
          <p style={{ fontSize: '0.85rem', margin: 0 }}>
            Matches vegetarian-only shelters strictly with vegetarian listings to uphold community dietary ethics.
          </p>
        </div>

        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-accent-subtle)',
            color: 'var(--color-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem'
          }}>
            <Clock size={20} />
          </div>
          <h4 style={{ fontSize: '1.05rem', marginBottom: '0.35rem' }}>Urgency Window Priority</h4>
          <p style={{ fontSize: '0.85rem', margin: 0 }}>
            Calculates remaining pickup minutes dynamically, alerting rapid-response volunteers before perishable deadlines lapse.
          </p>
        </div>

        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-bg-subtle)',
            color: 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem'
          }}>
            <ShieldCheck size={20} />
          </div>
          <h4 style={{ fontSize: '1.05rem', marginBottom: '0.35rem' }}>Batch Volume Fit</h4>
          <p style={{ fontSize: '0.85rem', margin: 0 }}>
            Matches large catering batches (50+ servings) with larger community kitchens to avoid overwhelming small shelters.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MatchesView;

