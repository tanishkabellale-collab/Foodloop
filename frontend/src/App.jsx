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

/* ── New Placeholder Pages ───────────────────────────── */
import PickupDeliveryPage from './components/pages/PickupDeliveryPage';
import AdminReviewPage from './components/pages/AdminReviewPage';
import SettingsPage from './components/pages/SettingsPage';

import './App.css';

const API_URL = 'http://localhost:5001/api';
const VALID_TABS = ['dashboard','donations','matches','analytics','create','pickup','admin','settings'];

function App() {
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
    if (showLoading) setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/donations`);
      setDonations(res.data);
    } catch (error) {
      console.error('Failed to fetch donations:', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDonations(true);
    const id = setInterval(() => fetchDonations(false), 5000);
    return () => clearInterval(id);
  }, [fetchDonations]);

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
      />

      {/* Main Content Area */}
      <div className={`app-main ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
        <TopBar
          activeTab={activeTab}
          activeDonationsCount={activeCount}
          onMobileMenuToggle={() => setMobileMenuOpen(prev => !prev)}
        />

        <main className="app-content">
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
              onAccept={handleAccept}
              onCollect={handleCollect}
            />
          )}

          {activeTab === 'create' && (
            <DonorForm onSuccess={() => fetchDonations(false)} />
          )}

          {activeTab === 'matches' && (
            <MatchesView
              donations={donations}
              onAccept={handleAccept}
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
        </main>
      </div>

      {/* Donation Detail Modal (Global) */}
      {selectedDonation && (
        <DonationDetailModal
          donation={selectedDonation}
          onClose={() => setSelectedDonation(null)}
          onAccept={handleAccept}
          onCollect={handleCollect}
        />
      )}
    </div>
  );
}

export default App;
