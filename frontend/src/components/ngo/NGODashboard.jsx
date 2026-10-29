import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  Search, 
  Filter, 
  RefreshCw, 
  CheckCircle, 
  Clock, 
  PackageCheck,
  SlidersHorizontal
} from 'lucide-react';
import DonationCard from '../donations/DonationCard';
import EmptyState from '../common/EmptyState';

const TAB_FILTERS = [
  { id: 'available', label: 'Available for Claim' },
  { id: 'accepted', label: 'My Claimed Pickups' },
  { id: 'collected', label: 'Collected History' },
  { id: 'all', label: 'All Listings' }
];

const NGODashboard = ({ 
  donations = [], 
  loading = false, 
  onRefresh, 
  onAccept, 
  onCollect,
  onSelectDonation 
}) => {
  const [activeTab, setActiveTab] = useState('available');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const filtered = useMemo(() => {
    return donations.filter(d => {
      const st = (d.status || 'available').toLowerCase();

      // Tab filter
      let matchesTab = true;
      if (activeTab === 'available') {
        matchesTab = st === 'available' || st === 'submitted';
      } else if (activeTab === 'accepted') {
        matchesTab = st === 'accepted';
      } else if (activeTab === 'collected') {
        matchesTab = st === 'collected';
      }

      // Search filter
      const title = (d.title || d.foodName || '').toLowerCase();
      const loc = (d.address_text || d.location || '').toLowerCase();
      const matchesSearch = !searchTerm || title.includes(searchTerm.toLowerCase()) || loc.includes(searchTerm.toLowerCase());

      // Category filter
      const matchesCategory = categoryFilter === 'all' || d.food_category === categoryFilter;

      return matchesTab && matchesSearch && matchesCategory;
    });
  }, [donations, activeTab, searchTerm, categoryFilter]);

  const availableCount = donations.filter(d => (d.status || 'available') === 'available' || d.status === 'submitted').length;
  const acceptedCount = donations.filter(d => d.status === 'accepted').length;
  const collectedCount = donations.filter(d => d.status === 'collected').length;

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
      {/* NGO Hub Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)', marginBottom: '0.25rem' }}>
            <Building2 size={24} />
            <h1 style={{ fontSize: '1.85rem', marginBottom: 0 }}>NGO Rescue Coordination Hub</h1>
          </div>
          <p style={{ fontSize: '0.95rem', margin: 0 }}>
            Inspect available community surplus, claim batches for distribution, and confirm pickups.
          </p>
        </div>

        {onRefresh && (
          <button 
            type="button"
            className="btn btn-outline"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'spinner' : ''} />
            <span>Refresh Feed</span>
          </button>
        )}
      </div>

      {/* Primary Status Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem', overflowX: 'auto' }}>
        <button
          type="button"
          className={`btn ${activeTab === 'available' ? 'btn-secondary' : 'btn-ghost'}`}
          style={{ borderRadius: 'var(--radius-pill)', padding: '0.5rem 1rem', fontSize: '0.875rem' }}
          onClick={() => setActiveTab('available')}
        >
          <Clock size={16} />
          <span>Available to Claim ({availableCount})</span>
        </button>

        <button
          type="button"
          className={`btn ${activeTab === 'accepted' ? 'btn-secondary' : 'btn-ghost'}`}
          style={{ borderRadius: 'var(--radius-pill)', padding: '0.5rem 1rem', fontSize: '0.875rem' }}
          onClick={() => setActiveTab('accepted')}
        >
          <PackageCheck size={16} />
          <span>Claimed / Awaiting Pickup ({acceptedCount})</span>
        </button>

        <button
          type="button"
          className={`btn ${activeTab === 'collected' ? 'btn-secondary' : 'btn-ghost'}`}
          style={{ borderRadius: 'var(--radius-pill)', padding: '0.5rem 1rem', fontSize: '0.875rem' }}
          onClick={() => setActiveTab('collected')}
        >
          <CheckCircle size={16} />
          <span>Collected History ({collectedCount})</span>
        </button>

        <button
          type="button"
          className={`btn ${activeTab === 'all' ? 'btn-secondary' : 'btn-ghost'}`}
          style={{ borderRadius: 'var(--radius-pill)', padding: '0.5rem 1rem', fontSize: '0.875rem' }}
          onClick={() => setActiveTab('all')}
        >
          <span>All ({donations.length})</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="card mb-6" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-subtle)' }} />
            <input 
              type="text"
              placeholder="Search by meal name or pickup address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '2.2rem', paddingRight: '0.75rem', height: '38px', fontSize: '0.875rem' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Category:</span>
            {['all', 'cooked_meals', 'fresh_produce', 'bakery', 'packaged_sealed'].map(cat => (
              <button
                type="button"
                key={cat}
                className={`btn btn-outline ${categoryFilter === cat ? 'btn-secondary' : ''}`}
                style={{
                  padding: '0.25rem 0.65rem',
                  fontSize: '0.785rem',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: categoryFilter === cat ? 'var(--color-primary)' : '#FFFFFF'
                }}
                onClick={() => setCategoryFilter(cat)}
              >
                {cat === 'all' ? 'All' : cat === 'cooked_meals' ? '🍲 Cooked' : cat === 'fresh_produce' ? '🍎 Produce' : cat === 'bakery' ? '🍞 Bakery' : '📦 Packaged'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Grid */}
      {loading && donations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <div className="spinner" style={{ width: '36px', height: '36px', margin: '0 auto 1rem' }}></div>
          <p>Syncing coordination feed...</p>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState 
          title={activeTab === 'accepted' ? 'No claimed pickups awaiting collection' : activeTab === 'collected' ? 'No historical collections recorded yet' : 'No available donations found'}
          description={searchTerm ? "No listings matched your search criteria." : activeTab === 'available' ? "All surplus food in this category has been claimed or collected." : "Check back as new donations are registered by local partners."}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {filtered.map(donation => (
            <DonationCard 
              key={donation.id}
              donation={donation}
              onSelect={onSelectDonation}
              onAccept={onAccept}
              onCollect={onCollect}
              showActions={true}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default NGODashboard;

