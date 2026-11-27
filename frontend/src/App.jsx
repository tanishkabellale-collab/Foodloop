import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

/* ── Layout ──────────────────────────────────────────── */
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';

/* ── Dashboard ───────────────────────────────────────── */
import DashboardView from './components/dashboard/DashboardView';

/* ── Existing Feature Views ──────────────────────────── */
import DonationGrid from './components/donations/DonationGrid';
import DonationDetailModal from './components/donations/DonationDetailModal';
import DonorForm from './components/donor/DonorForm';
import MatchesView from './components/matches/MatchesView';
import AnalyticsView from './components/analytics/AnalyticsView';

/* ── Auth & Guards ───────────────────────────────────── */
import { useAuth } from './context/AuthContext';
import AuthPage from './components/auth/AuthPage';
import UnauthorizedView from './components/common/UnauthorizedView';

/* ── New Placeholder Pages ───────────────────────────── */
import PickupDeliveryPage from './components/pages/PickupDeliveryPage';
import AdminReviewPage from './components/pages/AdminReviewPage';
import SettingsPage from './components/pages/SettingsPage';

import './App.css';

const API_URL = 'http://localhost:5001/api';
const VALID_TABS = ['dashboard','donations','matches','analytics','create','pickup','admin','settings'];
const ROUTE_ROLES = {
  dashboard: ['DONOR', 'NGO', 'ADMIN'],
  donations: ['DONOR', 'NGO', 'ADMIN'],
  matches: ['DONOR', 'NGO', 'ADMIN'],
  analytics: ['DONOR', 'NGO', 'ADMIN'],
  create: ['DONOR', 'ADMIN'],
  pickup: ['NGO', 'ADMIN'],
  admin: ['ADMIN'],
  settings: ['DONOR', 'NGO', 'ADMIN'],
};

function App() {
  const { user, isAuthenticated, authLoading, logout } = useAuth();
  /* ── Tab / Routing State ───────────────────────── */
  const getInitialTab = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab && VALID_TABS.includes(tab)) return tab;
      if (params.get('view') === 'ngo') return 'donations';
      if (params.get('view') === 'donor') return 'create';
    } catch (e) { /* fallback */ }
    return 'dashboard';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDonation, setSelectedDonation] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  /* ── Tab Navigation ────────────────────────────── */
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.pushState({}, '', url);
    } catch (e) { /* ignore */ }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  /* ── Data Fetching ─────────────────────────────── */
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

  useEffect(() => {
    if (!isAuthenticated) {
      setDonations([]);
      return;
    }
    fetchDonations(true);
    const id = setInterval(() => fetchDonations(false), 5000);
    return () => clearInterval(id);
  }, [fetchDonations, isAuthenticated]);

  /* ── Browser Back/Forward ──────────────────────── */
  useEffect(() => {
    const handlePop = () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab') || 'dashboard';
      setActiveTab(tab);
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

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

  /* ── Render ────────────────────────────────────── */
  return (
    <div className="app-layout">
      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
        mobileOpen={mobileMenuOpen}
        userRole={userRole}
      />

      {/* Main Content Area */}
      <div className={`app-main ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
        <TopBar
          activeTab={activeTab}
          activeDonationsCount={activeCount}
          onMobileMenuToggle={() => setMobileMenuOpen(prev => !prev)}
          user={user}
          onLogout={logout}
        />

        <main className="app-content">
          {!isRouteAllowed ? (
            <UnauthorizedView
              userRole={userRole}
              requiredRoles={allowedRolesForTab}
              onBack={() => handleTabChange('dashboard')}
            />
          ) : (
            <>
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
                />
              )}

              {activeTab === 'create' && canCreate && (
                <DonorForm onSuccess={() => fetchDonations(false)} />
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
                <PickupDeliveryPage onTabChange={handleTabChange} />
              )}

              {activeTab === 'admin' && (
                <AdminReviewPage onTabChange={handleTabChange} />
              )}

              {activeTab === 'settings' && (
                <SettingsPage />
              )}
            </>
          )}
        </main>
      </div>

      {/* Donation Detail Modal (Global) */}
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
