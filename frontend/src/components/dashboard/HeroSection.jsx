import React from 'react';
import { ArrowRight, PlusCircle, Sparkles, ShieldCheck, HeartHandshake } from 'lucide-react';

const HeroSection = ({ onTabChange, activeCount = 0 }) => {
  return (
    <div className="hero-wrapper">
      <div className="container">
        <div className="hero-content">
          <div className="hero-badge">
            <Sparkles size={14} />
            <span>Intelligent Surplus Food Rescue Platform</span>
          </div>

          <h1 className="hero-title">
            Rescue Surplus.<br />Feed Communities.
          </h1>

          <p className="hero-subtitle">
            Connect surplus food from catering, kitchens, and produce suppliers with verified organizations that can put it to good use — before it goes to waste.
          </p>

          <div className="hero-ctas">
            <button 
              type="button" 
              className="btn btn-primary"
              onClick={() => onTabChange('create')}
            >
              <PlusCircle size={18} />
              <span>Create Donation</span>
            </button>

            <button 
              type="button" 
              className="btn btn-outline"
              onClick={() => onTabChange('donations')}
            >
              <span>View Donations ({activeCount} Active)</span>
              <ArrowRight size={16} />
            </button>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.75rem',
            marginTop: '2.5rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid rgba(18, 53, 42, 0.08)',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              <ShieldCheck size={18} style={{ color: 'var(--color-secondary)' }} />
              <span>Structured Verification</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              <HeartHandshake size={18} style={{ color: 'var(--color-accent)' }} />
              <span>Direct NGO Coordination</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroSection;

