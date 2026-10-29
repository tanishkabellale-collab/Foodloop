import React from 'react';
import { 
  LayoutDashboard, 
  Package, 
  GitFork, 
  BarChart3, 
  PlusCircle, 
  Sparkles 
} from 'lucide-react';

const Navbar = ({ activeTab, onTabChange, activeDonationsCount = 0 }) => {
  return (
    <header className="app-navbar">
      <div className="container">
        <div className="navbar-inner">
          {/* Brand Logo */}
          <div 
            className="brand-logo"
            onClick={() => onTabChange('dashboard')}
          >
            <div className="brand-icon-wrapper">
              <svg width="22" height="22" viewBox="0 0 64 64" fill="none">
                <path d="M22 36C22 28.268 28.268 22 36 22C43.732 22 50 28.268 50 36C50 43.732 43.732 50 36 50C31.5 50 28 47.5 25 43" stroke="#F47A20" strokeWidth="5" strokeLinecap="round"/>
                <path d="M42 28C42 35.732 35.732 42 28 42C20.268 42 14 35.732 14 28C14 20.268 20.268 14 28 14C32.5 14 36 16.5 39 21" stroke="#5B8C51" strokeWidth="5" strokeLinecap="round"/>
              </svg>
            </div>
            <span>FoodLoop</span>
          </div>

          {/* Navigation Links */}
          <nav className="nav-links">
            <button 
              type="button"
              className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => onTabChange('dashboard')}
            >
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </button>

            <button 
              type="button"
              className={`nav-item ${activeTab === 'donations' ? 'active' : ''}`}
              onClick={() => onTabChange('donations')}
            >
              <Package size={18} />
              <span>Donations</span>
              {activeDonationsCount > 0 && (
                <span style={{
                  backgroundColor: 'var(--color-accent-subtle)',
                  color: 'var(--color-accent)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '0.1rem 0.45rem',
                  borderRadius: '9999px',
                  marginLeft: '0.2rem'
                }}>
                  {activeDonationsCount}
                </span>
              )}
            </button>

            <button 
              type="button"
              className={`nav-item ${activeTab === 'matches' ? 'active' : ''}`}
              onClick={() => onTabChange('matches')}
            >
              <GitFork size={18} />
              <span>Matches</span>
            </button>

            <button 
              type="button"
              className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => onTabChange('analytics')}
            >
              <BarChart3 size={18} />
              <span>Analytics</span>
            </button>
          </nav>

          {/* Action CTA */}
          <div className="nav-actions">
            <button 
              type="button"
              className="btn btn-primary"
              onClick={() => onTabChange('create')}
            >
              <PlusCircle size={18} />
              <span>Create Donation</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;

