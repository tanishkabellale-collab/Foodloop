import React from 'react';
import { ShieldCheck, Eye, FileSearch, History, UserCheck, ArrowRight, Sparkles } from 'lucide-react';

const PLANNED_FEATURES = [
  { icon: FileSearch, title: 'Review Queue', desc: 'Centralized inspection queue for donations flagged as questionable by AI visual assessment.' },
  { icon: Eye, title: 'AI Override Controls', desc: 'Authorized reviewers can approve or reject AI triage decisions with auditable reasoning.' },
  { icon: History, title: 'Audit Trail', desc: 'Complete, tamper-evident log of all review actions, timestamps, and reviewer identities.' },
  { icon: UserCheck, title: 'Role-Based Access', desc: 'Only verified admin and authorized reviewer accounts can access the review dashboard.' },
];

const AdminReviewPage = ({ onTabChange }) => (
  <div className="placeholder-page">
    <div className="placeholder-hero">
      <div className="placeholder-icon-ring" style={{ backgroundColor: 'rgba(139,92,246,0.1)', color: '#8B5CF6' }}>
        <ShieldCheck size={32} />
      </div>
      <div className="placeholder-badge">
        <Sparkles size={14} />
        <span>Coming Soon</span>
      </div>
      <h1 className="placeholder-title">Admin Review Dashboard</h1>
      <p className="placeholder-desc">
        A human oversight layer for quality assurance. When AI visual screening flags a donation
        as questionable, authorized reviewers inspect the listing and make the final
        eligibility decision — ensuring no edible food is wrongly rejected.
      </p>
      <button className="btn btn-primary" onClick={() => onTabChange('donations')}>
        <span>View All Donations</span>
        <ArrowRight size={16} />
      </button>
    </div>

    <div className="placeholder-features-title">Planned Capabilities</div>
    <div className="placeholder-features-grid">
      {PLANNED_FEATURES.map(f => (
        <div key={f.title} className="placeholder-feature-card">
          <div className="placeholder-feature-icon" style={{ backgroundColor: 'rgba(139,92,246,0.08)', color: '#8B5CF6' }}>
            <f.icon size={22} />
          </div>
          <h4>{f.title}</h4>
          <p>{f.desc}</p>
        </div>
      ))}
    </div>

    <div className="placeholder-current-note">
      <ShieldCheck size={16} />
      <span>Currently, all donations are visible to all users. Authentication and role-based reviewer access will be implemented in a future milestone.</span>
    </div>
  </div>
);

export default AdminReviewPage;

