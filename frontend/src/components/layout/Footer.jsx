import React from 'react';

const Footer = ({ onTabChange }) => {
  return (
    <footer className="app-footer">
      <div className="container">
        <div className="footer-inner">
          <div className="footer-brand">
            <div className="footer-title">FoodLoop</div>
            <div className="footer-tagline">
              Rescuing surplus food through better coordination. Connecting donors with organizations that put edible surplus to good use.
            </div>
          </div>

          <div className="footer-links">
            <button 
              type="button" 
              className="footer-link"
              onClick={() => { onTabChange('dashboard'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            >
              Dashboard
            </button>
            <button 
              type="button" 
              className="footer-link"
              onClick={() => { onTabChange('donations'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            >
              Donations Directory
            </button>
            <button 
              type="button" 
              className="footer-link"
              onClick={() => { onTabChange('matches'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            >
              Intelligent Matching
            </button>
            <button 
              type="button" 
              className="footer-link"
              onClick={() => { onTabChange('analytics'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            >
              Platform Telemetry
            </button>
            <button 
              type="button" 
              className="footer-link"
              onClick={() => { onTabChange('create'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            >
              Register Surplus
            </button>
          </div>
        </div>

        <div className="footer-bottom">
          <div>
            &copy; {new Date().getFullYear()} FoodLoop Initiative. Non-commercial surplus coordination system.
          </div>
          <div style={{ opacity: 0.85 }}>
            Operational Triage &bull; Software Coordination &bull; Zero Food Waste
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

