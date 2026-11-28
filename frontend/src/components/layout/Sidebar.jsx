import React from 'react';
import {
  LayoutDashboard,
  Package,
  GitFork,
  Truck,
  BarChart3,
  ShieldCheck,
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, roles: ['DONOR', 'NGO', 'VOLUNTEER', 'ADMIN'] },
  { id: 'donations', label: 'Donations', icon: Package, roles: ['DONOR', 'NGO', 'VOLUNTEER', 'ADMIN'] },
  { id: 'matches', label: 'NGO matching', icon: GitFork, roles: ['DONOR', 'NGO', 'ADMIN'] },
  { id: 'pickup', label: 'Pickup & delivery', icon: Truck, roles: ['DONOR', 'NGO', 'VOLUNTEER', 'ADMIN'] },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, roles: ['DONOR', 'NGO', 'VOLUNTEER', 'ADMIN'] },
  { id: 'admin', label: 'Review queue', icon: ShieldCheck, roles: ['ADMIN'] },
  { id: 'settings', label: 'Settings', icon: Settings, roles: ['DONOR', 'NGO', 'VOLUNTEER', 'ADMIN'] },
];

const Sidebar = ({ activeTab, onTabChange, collapsed, onToggleCollapse, mobileOpen, userRole = 'DONOR' }) => {
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(userRole));
  const canCreate = userRole === 'DONOR' || userRole === 'ADMIN';

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-header">
        <button type="button" className="sidebar-logo" onClick={() => onTabChange('dashboard')}>
          <div className="sidebar-logo-mark" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 64 64" fill="none">
              <path d="M22 36C22 28.268 28.268 22 36 22C43.732 22 50 28.268 50 36C50 43.732 43.732 50 36 50C31.5 50 28 47.5 25 43" stroke="#EA5D1A" strokeWidth="6" strokeLinecap="round" />
              <path d="M42 28C42 35.732 35.732 42 28 42C20.268 42 14 35.732 14 28C14 20.268 20.268 14 28 14C32.5 14 36 16.5 39 21" stroke="#CBE5C8" strokeWidth="6" strokeLinecap="round" />
            </svg>
          </div>
          {!collapsed && <span className="sidebar-logo-text">FoodLoop</span>}
        </button>

        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} strokeWidth={1.65} /> : <ChevronLeft size={16} strokeWidth={1.65} />}
        </button>

        <button
          type="button"
          className="sidebar-close-mobile"
          onClick={() => onTabChange(activeTab)}
          title="Close menu"
          aria-label="Close menu"
        >
          <X size={18} strokeWidth={1.65} />
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {!collapsed && <div className="sidebar-section-label">Workspace</div>}
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              type="button"
              key={item.id}
              className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onTabChange(item.id)}
              title={collapsed ? item.label : undefined}
            >
              <span className="sidebar-nav-icon">
                <Icon size={18} strokeWidth={1.65} />
              </span>
              {!collapsed && <span className="sidebar-nav-label">{item.label}</span>}
              {isActive && <span className="sidebar-active-indicator" />}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        {!collapsed && <div className="sidebar-footer-divider" />}
        {canCreate && (
          <button
            type="button"
            className="sidebar-cta"
            onClick={() => onTabChange('create')}
            title={collapsed ? 'Register surplus' : undefined}
          >
            <Plus size={18} strokeWidth={1.75} />
            {!collapsed && <span>Register surplus</span>}
          </button>
        )}
        {!collapsed && <div className="sidebar-version">FoodLoop v2.0</div>}
      </div>
    </aside>
  );
};

export default Sidebar;
