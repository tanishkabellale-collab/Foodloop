import React, { useState, useEffect, useRef } from 'react';
import { Bell, Search, User, Menu, LogOut, CheckCheck } from 'lucide-react';

const PAGE_TITLES = {
  dashboard: { title: 'Operations overview', subtitle: 'Surplus intake, claims, and rescue volume' },
  donations: { title: 'Donations', subtitle: 'Registered food batches ready for coordination' },
  matches: { title: 'NGO matching', subtitle: 'Multi-factor recipient scoring and assignment' },
  pickup: { title: 'Pickup & delivery', subtitle: 'Courier dispatch, route distance, and OTP handoffs' },
  analytics: { title: 'Analytics', subtitle: 'Status, category, and dietary telemetry' },
  admin: { title: 'Review queue', subtitle: 'Flagged listings and manual verification log' },
  settings: { title: 'Settings', subtitle: 'Account, NGO profile, and engine diagnostics' },
  create: { title: 'Register surplus', subtitle: 'Submit food batch details and intake photo' },
};

const TopBar = ({
  activeTab,
  activeDonationsCount = 0,
  onMobileMenuToggle,
  user,
  onLogout,
  searchQuery = '',
  onSearchChange,
  onSearchSubmit,
  notifications = [],
  unreadCount = 0,
  onMarkAllRead,
  onNotificationSelect,
  realtimeConnected = false,
}) => {
  const page = PAGE_TITLES[activeTab] || PAGE_TITLES.dashboard;
  const [notifOpen, setNotifOpen] = useState(false);
  const popoverRef = useRef(null);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setNotifOpen(false);
    };
    const onClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, []);

  const badgeCount = unreadCount > 0 ? unreadCount : activeDonationsCount;

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button type="button" className="topbar-mobile-menu" onClick={onMobileMenuToggle} aria-label="Toggle menu">
          <Menu size={20} strokeWidth={1.65} />
        </button>
        <div className="topbar-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 className="topbar-title">{page.title}</h1>
            <span
              className={`live-sync-pill ${realtimeConnected ? 'live' : ''}`}
              title={realtimeConnected ? 'Live server updates connected' : 'Periodic polling active'}
            >
              <span className="live-sync-dot" />
              <span>{realtimeConnected ? 'Live' : 'Sync'}</span>
            </span>
          </div>
          <p className="topbar-subtitle">{page.subtitle}</p>
        </div>
      </div>

      <div className="topbar-right">
        <form
          className="topbar-search"
          onSubmit={(e) => {
            e.preventDefault();
            onSearchSubmit?.();
          }}
        >
          <Search size={16} strokeWidth={1.65} className="topbar-search-icon" />
          <input
            type="text"
            placeholder="Search"
            className="topbar-search-input"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            aria-label="Search donations"
          />
        </form>

        <div className="topbar-notif-wrapper" ref={popoverRef}>
          <button
            type="button"
            className="topbar-icon-btn"
            title="Notifications"
            aria-label="Notifications"
            aria-expanded={notifOpen}
            onClick={() => setNotifOpen((prev) => !prev)}
          >
            <Bell size={18} strokeWidth={1.65} />
            {badgeCount > 0 && (
              <span className="topbar-notification-badge">{badgeCount > 9 ? '9+' : badgeCount}</span>
            )}
          </button>

          {notifOpen && (
            <div className="topbar-notif-popover" role="dialog" aria-label="Notifications">
              <div className="notif-popover-header">
                <span>Activity alerts ({notifications.length})</span>
                {notifications.length > 0 && onMarkAllRead && (
                  <button
                    type="button"
                    className="btn-link"
                    style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    onClick={onMarkAllRead}
                  >
                    <CheckCheck size={14} strokeWidth={1.65} /> Mark read
                  </button>
                )}
              </div>
              <div className="notif-popover-list">
                {notifications.length === 0 ? (
                  <div className="notif-popover-empty">
                    No alerts yet. Active surplus batches: {activeDonationsCount}
                  </div>
                ) : (
                  notifications.slice(0, 12).map((n) => (
                    <button
                      type="button"
                      key={n.id}
                      className={`notif-popover-item ${n.is_read ? '' : 'unread'}`}
                      onClick={() => {
                        setNotifOpen(false);
                        onNotificationSelect?.(n);
                      }}
                    >
                      <div className="notif-item-title">{n.title}</div>
                      <div className="notif-item-msg">{n.message}</div>
                      <div className="notif-item-time">
                        {n.created_at ? new Date(n.created_at).toLocaleTimeString() : ''}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="topbar-divider" />

        <div className="topbar-profile">
          <div className="topbar-avatar">
            <User size={16} strokeWidth={1.65} />
          </div>
          <div className="topbar-profile-text">
            <span className="topbar-profile-name">{user?.name || 'FoodLoop User'}</span>
            <span className="topbar-profile-role">
              {user?.role || 'USER'}{user?.is_demo ? ' · Demo' : ''}
            </span>
          </div>
        </div>

        {onLogout && (
          <button
            type="button"
            className="topbar-logout-btn"
            onClick={onLogout}
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={15} strokeWidth={1.65} />
            <span className="logout-label">Sign out</span>
          </button>
        )}
      </div>
    </header>
  );
};

export default TopBar;
