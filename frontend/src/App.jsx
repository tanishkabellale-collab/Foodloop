import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

/* ── Layout ──────────────────────────────────────────── */
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';

/* ── Dashboard ───────────────────────────────────────── */
import DashboardView from './components/dashboard/DashboardView';

/* ── Feature Views ───────────────────────────────────── */
import DonationGrid from './components/donations/DonationGrid';
import DonationDetailModal from './components/donations/DonationDetailModal';
import DonorForm from './components/donor/DonorForm';
import MatchesView from './components/matches/MatchesView';
import AnalyticsView from './components/analytics/AnalyticsView';
import ErrorBoundary from './components/common/ErrorBoundary';

/* ── Auth & Guards ───────────────────────────────────── */
import { useAuth } from './context/useAuth';
import AuthPage from './components/auth/AuthPage';
import UnauthorizedView from './components/common/UnauthorizedView';

/* ── Operations Pages ────────────────────────────────── */
import PickupDeliveryPage from './components/pages/PickupDeliveryPage';
import AdminReviewPage from './components/pages/AdminReviewPage';
import SettingsPage from './components/pages/SettingsPage';

import { API_URL } from './config';
import './App.css';

const VALID_TABS = ['dashboard','donations','matches','analytics','create','pickup','admin','settings'];
const ROUTE_ROLES = {
  dashboard: ['DONOR', 'NGO', 'VOLUNTEER', 'ADMIN'],
  donations: ['DONOR', 'NGO', 'VOLUNTEER', 'ADMIN'],
  matches: ['DONOR', 'NGO', 'ADMIN'],
  analytics: ['DONOR', 'NGO', 'VOLUNTEER', 'ADMIN'],
  create: ['DONOR', 'ADMIN'],
  pickup: ['DONOR', 'NGO', 'VOLUNTEER', 'ADMIN'],
  admin: ['ADMIN'],
  settings: ['DONOR', 'NGO', 'VOLUNTEER', 'ADMIN'],
};

function App() {
  const { user, token, isAuthenticated, authLoading, logout } = useAuth();

  const getInitialTab = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab && VALID_TABS.includes(tab)) return tab;
      if (params.get('view') === 'ngo') return 'donations';
      if (params.get('view') === 'donor') return 'create';
    } catch { /* fallback */ }
    return 'dashboard';
  };

  const getInitialQuery = () => {
    try {
      return new URLSearchParams(window.location.search).get('q') || '';
    } catch {
      return '';
    }
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDonation, setSelectedDonation] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Global search & live notifications
  const [searchQuery, setSearchQuery] = useState(getInitialQuery);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  /* ── Tab Navigation ────────────────────────────── */
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.pushState({}, '', url);
    } catch { /* ignore */ }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  /* ── Data & Notifications Fetching ─────────────── */
  const fetchDonations = useCallback(async (showLoading = false) => {
    if (!isAuthenticated) return;
    if (showLoading) setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/donations`);
      setDonations(res.data);
    } catch (error) {
      console.error('Failed to fetch donations:', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [isAuthenticated]);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await axios.get(`${API_URL}/notifications`);
      setNotifications(res.data?.notifications || []);
      setUnreadCount(res.data?.unread_count || 0);
    } catch {
      // Non-blocking notification failure
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;

    Promise.all([
      axios.get(`${API_URL}/donations`),
      axios.get(`${API_URL}/notifications`).catch(() => ({ data: { notifications: [], unread_count: 0 } })),
    ])
      .then(([donRes, notifRes]) => {
        if (!active) return;
        setDonations(donRes.data);
        setNotifications(notifRes.data?.notifications || []);
        setUnreadCount(notifRes.data?.unread_count || 0);
      })
      .catch((error) => {
        if (active) console.error('Failed to load workspace data:', error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    // Fallback polling interval (relaxed when SSE is connected)
    const id = setInterval(() => {
      fetchDonations(false);
      fetchNotifications();
    }, 15000);

    return () => {
      active = false;
      clearInterval(id);
    };
  }, [fetchDonations, fetchNotifications, isAuthenticated]);

  /* ── Server-Sent Events (Real-Time Feed) ───────── */
  useEffect(() => {
    if (!isAuthenticated || !token || typeof window.EventSource !== 'function') {
      return undefined;
    }

    const sseUrl = `${API_URL}/events?token=${encodeURIComponent(token)}`;
    const es = new EventSource(sseUrl);

    const handleConnected = () => setRealtimeConnected(true);
    const handleSync = () => {
      fetchDonations(false);
      fetchNotifications();
    };

    es.addEventListener('connected', handleConnected);
    es.addEventListener('donation:created', handleSync);
    es.addEventListener('donation:updated', handleSync);
    es.addEventListener('delivery:updated', handleSync);
    es.addEventListener('notification:new', fetchNotifications);
    es.onerror = () => {
      setRealtimeConnected(false);
    };

    return () => {
      es.close();
      setRealtimeConnected(false);
    };
  }, [isAuthenticated, token, fetchDonations, fetchNotifications]);

  /* ── Browser Back/Forward & Escape Modal ───────── */
  useEffect(() => {
    const handlePop = () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab') || 'dashboard';
      setActiveTab(tab);
      setSearchQuery(params.get('q') || '');
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setSelectedDonation(null);
    };
    window.addEventListener('popstate', handlePop);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('popstate', handlePop);
      window.removeEventListener('keydown', handleKey);
    };
  }, []);

  /* ── Global Search Integration ─────────────────── */
  const handleGlobalSearchChange = (q) => {
    setSearchQuery(q);
    try {
      const url = new URL(window.location.href);
      if (q) url.searchParams.set('q', q);
      else url.searchParams.delete('q');
      window.history.replaceState({}, '', url);
    } catch { /* ignore */ }
  };

  const handleGlobalSearchSubmit = () => {
    if (activeTab !== 'donations') {
      handleTabChange('donations');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await axios.patch(`${API_URL}/notifications/read-all`);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch { /* ignore */ }
  };

  const handleNotificationSelect = (notif) => {
    if (notif.type?.startsWith('delivery') || notif.type === 'donation_accepted') {
      handleTabChange('pickup');
      return;
    }
    if (notif.type?.startsWith('admin') || notif.type === 'listing_expired') {
      handleTabChange(user?.role === 'ADMIN' ? 'admin' : 'donations');
      return;
    }
    handleTabChange('donations');
  };

  /* ── Accept / Collect (Optimistic) ─────────────── */
  const handleAccept = async (id, ngoInfo = null) => {
    try {
      const patchUpdate = {
        status: 'accepted',
        ...(ngoInfo?.matched_ngo_id ? { matched_ngo_id: ngoInfo.matched_ngo_id } : {}),
        ...(ngoInfo?.matched_ngo_name ? { matched_ngo_name: ngoInfo.matched_ngo_name } : {}),
      };
      setDonations(prev => prev.map(d => d.id === id ? { ...d, ...patchUpdate } : d));
      if (selectedDonation?.id === id) setSelectedDonation(prev => ({ ...prev, ...patchUpdate }));
      await axios.patch(`${API_URL}/donations/${id}/accept`, ngoInfo || {});
      fetchDonations(false);
      fetchNotifications();
    } catch (error) {
      console.error('Failed to accept donation:', error);
      fetchDonations(false);
    }
  };

  const handleCollect = async (id) => {
    try {
      setDonations(prev => prev.map(d => d.id === id ? { ...d, status: 'collected' } : d));
      if (selectedDonation?.id === id) setSelectedDonation(prev => ({ ...prev, status: 'collected' }));
      await axios.patch(`${API_URL}/donations/${id}/collect`);
      fetchDonations(false);
      fetchNotifications();
    } catch (error) {
      console.error('Failed to collect donation:', error);
      fetchDonations(false);
    }
  };

  /* ── Derived State ─────────────────────────────── */
  const activeCount = donations.filter(
    d => (d.status || 'available') === 'available' || d.status === 'submitted'
  ).length;

  const userRole = user?.role || 'DONOR';
  const canCreate = userRole === 'DONOR' || userRole === 'ADMIN';
  const canAcceptCollect = userRole === 'NGO' || userRole === 'ADMIN';
  const allowedRolesForTab = ROUTE_ROLES[activeTab] || ['DONOR', 'NGO', 'ADMIN'];
  const isRouteAllowed = allowedRolesForTab.includes(userRole);

  if (authLoading) {
    return (
      <div className="auth-shell">
        <div className="card" style={{ padding: '2rem 2.5rem', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 0.75rem' }} />
          <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>Verifying FoodLoop session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return (
    <div className="app-layout">
      {mobileMenuOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileMenuOpen(false)} />
      )}

      <Sidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
        mobileOpen={mobileMenuOpen}
        userRole={userRole}
      />

      <div className={`app-main ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
        <TopBar
          activeTab={activeTab}
          activeDonationsCount={activeCount}
          onMobileMenuToggle={() => setMobileMenuOpen(prev => !prev)}
          user={user}
          onLogout={logout}
          searchQuery={searchQuery}
          onSearchChange={handleGlobalSearchChange}
          onSearchSubmit={handleGlobalSearchSubmit}
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAllRead={handleMarkAllRead}
          onNotificationSelect={handleNotificationSelect}
          realtimeConnected={realtimeConnected}
        />

        <main className="app-content">
          {!isRouteAllowed ? (
            <UnauthorizedView
              userRole={userRole}
              requiredRoles={allowedRolesForTab}
              onBack={() => handleTabChange('dashboard')}
            />
          ) : (
            <ErrorBoundary key={activeTab}>
              {activeTab === 'dashboard' && (
                <DashboardView
                  donations={donations}
                  loading={loading}
                  onTabChange={handleTabChange}
                  onSelectDonation={setSelectedDonation}
                />
              )}

              {activeTab === 'donations' && (
                <DonationGrid
                  donations={donations}
                  loading={loading}
                  onRefresh={() => fetchDonations(true)}
                  onSelectDonation={setSelectedDonation}
                  onAccept={canAcceptCollect ? handleAccept : undefined}
                  onCollect={canAcceptCollect ? handleCollect : undefined}
                  searchQuery={searchQuery}
                  onSearchQueryChange={handleGlobalSearchChange}
                />
              )}

              {activeTab === 'create' && canCreate && (
                <DonorForm onSuccess={() => { fetchDonations(false); fetchNotifications(); }} />
              )}

              {activeTab === 'matches' && (
                <MatchesView
                  donations={donations}
                  onAccept={canAcceptCollect ? handleAccept : undefined}
                  onTabChange={handleTabChange}
                  onSelectDonation={setSelectedDonation}
                />
              )}

              {activeTab === 'analytics' && (
                <AnalyticsView donations={donations} />
              )}

              {activeTab === 'pickup' && (
                <PickupDeliveryPage
                  onTabChange={handleTabChange}
                  onDonationsRefresh={fetchDonations}
                />
              )}

              {activeTab === 'admin' && (
                <AdminReviewPage onTabChange={handleTabChange} />
              )}

              {activeTab === 'settings' && (
                <SettingsPage />
              )}
            </ErrorBoundary>
          )}
        </main>
      </div>

      {selectedDonation && (
        <DonationDetailModal
          donation={selectedDonation}
          onClose={() => setSelectedDonation(null)}
          onAccept={canAcceptCollect ? handleAccept : undefined}
          onCollect={canAcceptCollect ? handleCollect : undefined}
        />
      )}
    </div>
  );
}

export default App;
