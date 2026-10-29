import React, { useState, useMemo } from 'react';
import { Search, Filter, RefreshCw, SlidersHorizontal } from 'lucide-react';
import DonationCard from './DonationCard';
import EmptyState from '../common/EmptyState';

const CATEGORY_OPTIONS = [
  { id: 'all', label: 'All Categories' },
  { id: 'cooked_meals', label: '🍲 Cooked Meals' },
  { id: 'fresh_produce', label: '🍎 Fresh Produce' },
  { id: 'bakery', label: '🍞 Bakery' },
  { id: 'packaged_sealed', label: '📦 Packaged' }
];

const STATUS_OPTIONS = [
  { id: 'all', label: 'All Statuses' },
  { id: 'available', label: 'Available' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'collected', label: 'Collected' }
];

const DonationGrid = ({ 
  donations = [], 
  loading = false, 
  onRefresh, 
  onSelectDonation, 
  onAccept, 
  onCollect 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  const filteredDonations = useMemo(() => {
    return donations.filter(item => {
      // Search filter
      const title = (item.title || item.foodName || '').toLowerCase();
      const loc = (item.address_text || item.location || '').toLowerCase();
      const matchesSearch = !searchTerm || title.includes(searchTerm.toLowerCase()) || loc.includes(searchTerm.toLowerCase());

      // Category filter
      const matchesCategory = selectedCategory === 'all' || item.food_category === selectedCategory;

      // Status filter
      const st = (item.status || 'available').toLowerCase();
      let matchesStatus = true;
      if (selectedStatus === 'available') {
        matchesStatus = st === 'available' || st === 'submitted';
      } else if (selectedStatus !== 'all') {
        matchesStatus = st === selectedStatus;
      }

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [donations, searchTerm, selectedCategory, selectedStatus]);

  return (
    <div>
      {/* Search and Filters Header */}
      <div className="card mb-6" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Top row: search + refresh */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search 
                size={18} 
                style={{ 
                  position: 'absolute', 
                  left: '12px', 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  color: 'var(--color-text-subtle)' 
                }} 
              />
              <input 
                type="text" 
                placeholder="Search surplus by food title, dish name, or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '2.4rem' }}
              />
            </div>

            {onRefresh && (
              <button 
                type="button" 
                className="btn btn-outline" 
                onClick={onRefresh}
                disabled={loading}
                title="Refresh donation feed"
              >
                <RefreshCw size={16} className={loading ? 'spinner' : ''} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            )}
          </div>

          {/* Bottom row: Category filter chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginRight: '0.25rem' }}>
              <SlidersHorizontal size={14} />
              <span>Category:</span>
            </span>
            {CATEGORY_OPTIONS.map(cat => (
              <button 
                type="button"
                key={cat.id}
                className={`btn btn-outline ${selectedCategory === cat.id ? 'btn-secondary' : ''}`}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.8rem',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: selectedCategory === cat.id ? 'var(--color-primary)' : 'var(--color-bg-base)'
                }}
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Status filter chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginRight: '0.25rem' }}>
              <Filter size={14} />
              <span>Status:</span>
            </span>
            {STATUS_OPTIONS.map(st => (
              <button 
                type="button"
                key={st.id}
                className={`btn btn-outline ${selectedStatus === st.id ? 'btn-secondary' : ''}`}
                style={{
                  padding: '0.3rem 0.65rem',
                  fontSize: '0.785rem',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: selectedStatus === st.id ? 'var(--color-primary)' : 'var(--color-bg-surface)'
                }}
                onClick={() => setSelectedStatus(st.id)}
              >
                {st.label}
              </button>
            ))}

            {(searchTerm || selectedCategory !== 'all' || selectedStatus !== 'all') && (
              <button 
                type="button" 
                className="btn btn-ghost" 
                style={{ fontSize: '0.785rem', padding: '0.25rem 0.5rem', marginLeft: 'auto' }}
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                  setSelectedStatus('all');
                }}
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid of Cards */}
      {loading && donations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <div className="spinner" style={{ width: '36px', height: '36px', margin: '0 auto 1rem' }}></div>
          <p>Loading surplus food listings...</p>
        </div>
      ) : filteredDonations.length === 0 ? (
        <EmptyState 
          title="No surplus food matches your criteria"
          description={searchTerm || selectedCategory !== 'all' ? "Try broadening your category filters or search keywords." : "No surplus listings are currently recorded in the system."}
          actionLabel={(searchTerm || selectedCategory !== 'all' || selectedStatus !== 'all') ? "Clear Filters" : null}
          onAction={() => {
            setSearchTerm('');
            setSelectedCategory('all');
            setSelectedStatus('all');
          }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {filteredDonations.map(donation => (
            <DonationCard 
              key={donation.id} 
              donation={donation} 
              onSelect={onSelectDonation}
              onAccept={onAccept}
              onCollect={onCollect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default DonationGrid;

