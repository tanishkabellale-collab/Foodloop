import { useState, useEffect } from 'react';
import axios from 'axios';
import { RefreshCw, LayoutGrid } from 'lucide-react';
import DonationCard from './DonationCard';

const API_URL = 'http://localhost:5000/api';

const NGODashboard = () => {
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDonations = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/donations`);
      setDonations(res.data);
    } catch (error) {
      console.error('Failed to fetch donations', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDonations(true);

    // Poll every 2 seconds for instant updates
    const intervalId = setInterval(() => {
      fetchDonations(false);
    }, 2000);

    return () => clearInterval(intervalId);
  }, []);

  const handleAccept = async (id) => {
    try {
      setDonations(prev =>
        prev.map(d => d.id === id ? { ...d, status: 'accepted' } : d)
      );
      await axios.patch(`${API_URL}/donations/${id}/accept`);
      fetchDonations(false);
    } catch (error) {
      console.error('Failed to accept donation', error);
      fetchDonations(false);
    }
  };

  const handleCollect = async (id) => {
    try {
      setDonations(prev =>
        prev.map(d => d.id === id ? { ...d, status: 'collected' } : d)
      );
      await axios.patch(`${API_URL}/donations/${id}/collect`);
      fetchDonations(false);
    } catch (error) {
      console.error('Failed to collect donation', error);
      fetchDonations(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="flex items-center gap-2 mb-0" style={{ marginBottom: 0 }}>
          <LayoutGrid className="logo-icon" size={24} />
          Availables
        </h2>
        <button
          className="btn btn-outline"
          onClick={fetchDonations}
          disabled={loading}
          style={{ padding: '0.5rem 1rem' }}
        >
          <RefreshCw size={18} className={loading ? 'spinner' : ''} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="spinner" style={{ width: '40px', height: '40px', borderColor: 'rgba(255,255,255,0.1)', borderTopColor: 'var(--primary)' }}></div>
        </div>
      ) : donations.length === 0 ? (
        <div className="glass glass-card text-center py-12 text-muted">
          <p>No donations available at the moment.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2">
          {donations.map(donation => (
            <DonationCard
              key={donation.id}
              donation={donation}
              onAccept={handleAccept}
              onCollect={handleCollect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default NGODashboard;
