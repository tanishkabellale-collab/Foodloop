import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// Layout Components
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';

// Dashboard Components
import HeroSection from './components/dashboard/HeroSection';
import ImpactMetrics from './components/dashboard/ImpactMetrics';
import RecentActivity from './components/dashboard/RecentActivity';

// Donations Components
import DonationGrid from './components/donations/DonationGrid';
import DonationDetailModal from './components/donations/DonationDetailModal';

// Specific Views
import DonorForm from './components/donor/DonorForm';
import MatchesView from './components/matches/MatchesView';
import AnalyticsView from './components/analytics/AnalyticsView';

const API_URL = 'http://localhost:5000/api';

function App() {
  // Sync tab with URL search parameter ?tab=... (default: 'dashboard')
  const getInitialTab = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      const validTabs = ['dashboard', 'donations', 'matches', 'analytics', 'create'];
      if (tab && validTabs.includes(tab)) return tab;
      // Backward-compat check for older hash or query format
      if (params.get('view') === 'ngo') return 'donations';
      if (params.get('view') === 'donor') return 'create';
    } catch (e) {
      // Fallback
    }
    return 'dashboard';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDonation, setSelectedDonation] = useState(null);

  // Update tab and URL query param
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.pushState({}, '', url);
    } catch (e) {
      // Ignore if pushState fails
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Fetch all donations
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

  // Initial fetch and gentle background poll (every 5 seconds)
  useEffect(() => {
    fetchDonations(true);

    const intervalId = setInterval(() => {
      fetchDonations(false);
    }, 5000);

    return () => clearInterval(intervalId);
  }, [fetchDonations]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab') || 'dashboard';
      setActiveTab(tab);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Claim / Accept Donation
  const handleAccept = async (id) => {
    try {
      // Optimistic update
      setDonations(prev =>
        prev.map(d => d.id === id ? { ...d, status: 'accepted' } : d)
      );
      if (selectedDonation && selectedDonation.id === id) {
        setSelectedDonation(prev => ({ ...prev, status: 'accepted' }));
      }
      await axios.patch(`${API_URL}/donations/${id}/accept`);
      fetchDonations(false);
    } catch (error) {
      console.error('Failed to accept donation:', error);
      fetchDonations(false);
    }
  };

  // Collect Donation
  const handleCollect = async (id) => {
    try {
      // Optimistic update
      setDonations(prev =>
        prev.map(d => d.id === id ? { ...d, status: 'collected' } : d)
      );
      if (selectedDonation && selectedDonation.id === id) {
        setSelectedDonation(prev => ({ ...prev, status: 'collected' }));
      }
      await axios.patch(`${API_URL}/donations/${id}/collect`);
      fetchDonations(false);
    } catch (error) {
      console.error('Failed to collect donation:', error);
      fetchDonations(false);
    }
  };

  const activeCount = donations.filter(
    d => (d.status || 'available') === 'available' || d.status === 'submitted'
  ).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Persistent Global Header */}
      <Navbar 
        activeTab={activeTab} 
        onTabChange={handleTabChange} 
        activeDonationsCount={activeCount}
      />

      {/* Main View Container */}
      <main style={{ flex: '1 0 auto' }}>
        {activeTab === 'dashboard' && (
          <div>
            <HeroSection 
              onTabChange={handleTabChange} 
              activeCount={activeCount} 
            />
            <div className="container section-spacing">
              <ImpactMetrics donations={donations} />
              <RecentActivity 
                donations={donations} 
                onSelectDonation={setSelectedDonation}
                onTabChange={handleTabChange}
              />
            </div>
          </div>
        )}

        {activeTab === 'donations' && (
          <div className="container section-spacing">
            <div style={{ marginBottom: '1.75rem' }}>
              <h1 style={{ fontSize: '2rem', color: 'var(--color-primary)', marginBottom: '0.35rem' }}>
                Surplus Food Directory
              </h1>
              <p style={{ fontSize: '1rem', color: 'var(--color-text-muted)', margin: 0 }}>
                Explore live surplus food listings registered by verified community kitchens and donors.
              </p>
            </div>

            <DonationGrid 
              donations={donations}
              loading={loading}
              onRefresh={() => fetchDonations(true)}
              onSelectDonation={setSelectedDonation}
              onAccept={handleAccept}
              onCollect={handleCollect}
            />
          </div>
        )}

        {activeTab === 'matches' && (
          <div className="container section-spacing">
            <MatchesView onTabChange={handleTabChange} />
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="container section-spacing">
            <AnalyticsView donations={donations} />
          </div>
        )}

        {activeTab === 'create' && (
          <div className="container section-spacing">
            <DonorForm 
              onSuccess={() => {
                fetchDonations(false);
              }}
            />
          </div>
        )}
      </main>

      {/* Reusable Donation Detail Modal */}
      {selectedDonation && (
        <DonationDetailModal 
          donation={selectedDonation}
          onClose={() => setSelectedDonation(null)}
          onAccept={handleAccept}
          onCollect={handleCollect}
        />
      )}

      {/* Global Brand Footer */}
      <Footer onTabChange={handleTabChange} />
    </div>
  );
}

export default App;
