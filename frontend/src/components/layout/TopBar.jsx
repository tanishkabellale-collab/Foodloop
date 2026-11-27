import React from 'react';
import { Bell, Search, User, Menu, LogOut } from 'lucide-react';

const PAGE_TITLES = {
  dashboard: { title: 'Dashboard', subtitle: 'Platform overview and key metrics' },
  donations: { title: 'Donations', subtitle: 'Browse and manage surplus food listings' },
  matches: { title: 'NGO Matching', subtitle: 'Intelligent recipient matching engine' },
  pickup: { title: 'Pickup & Delivery', subtitle: 'Logistics coordination hub' },
  analytics: { title: 'Impact Analytics', subtitle: 'Telemetry and rescue impact data' },
  admin: { title: 'Admin Review', subtitle: 'Quality oversight and assessment review' },
  settings: { title: 'Settings', subtitle: 'Platform configuration' },
  create: { title: 'Create Donation', subtitle: 'Register new surplus food for rescue' },
};

const TopBar = ({ activeTab, activeDonationsCount = 0, onMobileMenuToggle, user, onLogout }) => {
  const page = PAGE_TITLES[activeTab] || PAGE_TITLES.dashboard;

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="topbar-mobile-menu" onClick={onMobileMenuToggle} aria-label="Toggle menu">
          <Menu size={22} />
        </button>
        <div className="topbar-title-group">
          <h1 className="topbar-title">{page.title}</h1>
          <p className="topbar-subtitle">{page.subtitle}</p>
        </div>
      </div>

      <div className="topbar-right">
        <div className="topbar-search">
          <Search size={16} className="topbar-search-icon" />
          <input type="text" placeholder="Search donations, NGOs..." className="topbar-search-input" />
        </div>

        <button className="topbar-icon-btn" title="Notifications" aria-label="Notifications">
          <Bell size={20} />
          {activeDonationsCount > 0 && (
            <span className="topbar-notification-badge">{activeDonationsCount > 9 ? '9+' : activeDonationsCount}</span>
          )}
        </button>

        <div className="topbar-divider" />

        <div className="topbar-profile">
          <div className="topbar-avatar">
            <User size={16} />
          </div>
          <div className="topbar-profile-text">
            <span className="topbar-profile-name">{user?.name || 'FoodLoop User'}</span>
            <span className="topbar-profile-role">
              {user?.role || 'USER'}{user?.is_demo ? ' • Demo' : ''}
            </span>
          </div>
        </div>

        {onLogout && (
          <button
            type="button"
            className="topbar-logout-btn"
            onClick={onLogout}
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut size={16} />
            <span className="logout-label">Sign Out</span>
          </button>
        )}
      </div>
    </header>
  );
};

export default TopBar;
