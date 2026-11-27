import React from 'react';
import {
  LayoutDashboard,
  Package,
  GitFork,
  Truck,
  BarChart3,
  ShieldCheck,
  Settings,
  PlusCircle,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['DONOR', 'NGO', 'ADMIN'] },
  { id: 'donations', label: 'Donations', icon: Package, roles: ['DONOR', 'NGO', 'ADMIN'] },
  { id: 'matches', label: 'NGO Matching', icon: GitFork, roles: ['DONOR', 'NGO', 'ADMIN'] },
  { id: 'pickup', label: 'Pickup & Delivery', icon: Truck, roles: ['NGO', 'ADMIN'] },
  { id: 'analytics', label: 'Impact Analytics', icon: BarChart3, roles: ['DONOR', 'NGO', 'ADMIN'] },
  { id: 'admin', label: 'Admin Review', icon: ShieldCheck, roles: ['ADMIN'] },
  { id: 'settings', label: 'Settings', icon: Settings, roles: ['DONOR', 'NGO', 'ADMIN'] },
];

const Sidebar = ({ activeTab, onTabChange, collapsed, onToggleCollapse, mobileOpen, userRole = 'DONOR' }) => {
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(userRole));
  const canCreate = userRole === 'DONOR' || userRole === 'ADMIN';
  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      {/* Logo Header */}
      <div className="sidebar-header">
        <div className="sidebar-logo" onClick={() => onTabChange('dashboard')}>
          <div className="sidebar-logo-icon">
            <svg width="24" height="24" viewBox="0 0 64 64" fill="none">
              <path d="M22 36C22 28.268 28.268 22 36 22C43.732 22 50 28.268 50 36C50 43.732 43.732 50 36 50C31.5 50 28 47.5 25 43" stroke="#F47A20" strokeWidth="5" strokeLinecap="round"/>
              <path d="M42 28C42 35.732 35.732 42 28 42C20.268 42 14 35.732 14 28C14 20.268 20.268 14 28 14C32.5 14 36 16.5 39 21" stroke="#A8D99C" strokeWidth="5" strokeLinecap="round"/>
            </svg>
          </div>
          {!collapsed && <span className="sidebar-logo-text">FoodLoop</span>}
        </div>
        <button
          className="sidebar-collapse-btn"
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
        <button
          className="sidebar-close-mobile"
          onClick={() => onTabChange(activeTab)}
          title="Close menu"
        >
          <X size={20} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {!collapsed && <div className="sidebar-section-label">Main Menu</div>}
        {visibleItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onTabChange(item.id)}
              title={collapsed ? item.label : undefined}
            >
              <div className="sidebar-nav-icon">
                <Icon size={20} />
              </div>
              {!collapsed && <span className="sidebar-nav-label">{item.label}</span>}
              {isActive && <div className="sidebar-active-indicator" />}
            </button>
          );
        })}
      </nav>

      {/* CTA Footer */}
      <div className="sidebar-footer">
        {!collapsed && (
          <div className="sidebar-footer-divider" />
        )}
        {canCreate && (
          <button
            className="sidebar-cta"
            onClick={() => onTabChange('create')}
            title={collapsed ? 'Create Donation' : undefined}
          >
            <PlusCircle size={20} />
            {!collapsed && <span>Create Donation</span>}
          </button>
        )}
        {!collapsed && (
          <div className="sidebar-version">
            FoodLoop v1.0 — Rescue Platform
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;

