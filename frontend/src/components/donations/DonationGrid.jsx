import React, { useState, useMemo } from 'react';
import { Search, Filter, RefreshCw, SlidersHorizontal } from 'lucide-react';
import DonationCard from './DonationCard';
import EmptyState from '../common/EmptyState';

const CATEGORY_OPTIONS = [
  { id: 'all', label: 'All categories' },
  { id: 'cooked_meals', label: 'Cooked meals' },
  { id: 'fresh_produce', label: 'Fresh produce' },
  { id: 'bakery', label: 'Bakery' },
  { id: 'packaged_sealed', label: 'Packaged' },
];

const STATUS_OPTIONS = [
  { id: 'all', label: 'All statuses' },
  { id: 'available', label: 'Available' },
  { id: 'accepted', label: 'Claimed' },
  { id: 'collected', label: 'Collected' },
];

const getInitialParam = (key, fallback) => {
  try {
    return new URLSearchParams(window.location.search).get(key) || fallback;
  } catch {
    return fallback;
  }
};

const syncGridUrlParam = (key, val, defaultVal = 'all') => {
  try {
    const url = new URL(window.location.href);
    if (!val || val === defaultVal) {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, val);
    }
    window.history.replaceState({}, '', url);
  } catch {
    // ignore
  }
};

const DonationGrid = ({
  donations = [],
  loading = false,
  onRefresh,
  onSelectDonation,
  onAccept,
  onCollect,
  searchQuery,
  onSearchQueryChange,
}) => {
  const [localSearch, setLocalSearch] = useState(() => getInitialParam('q', ''));
  const [selectedCategory, setSelectedCategory] = useState(() => getInitialParam('cat', 'all'));
  const [selectedStatus, setSelectedStatus] = useState(() => getInitialParam('status', 'all'));

  const searchTerm = searchQuery !== undefined ? searchQuery : localSearch;
  const setSearchTerm = (val) => {
    setLocalSearch(val);
    onSearchQueryChange?.(val);
    syncGridUrlParam('q', val, '');
  };

  const handleCategoryChange = (cat) => {
    setSelectedCategory(cat);
    syncGridUrlParam('cat', cat, 'all');
  };

  const handleStatusChange = (st) => {
    setSelectedStatus(st);
    syncGridUrlParam('status', st, 'all');
  };

  const filteredDonations = useMemo(() => {
    return donations.filter((item) => {
      const title = (item.title || item.foodName || '').toLowerCase();
      const loc = (item.address_text || item.location || '').toLowerCase();
      const matchesSearch =
        !searchTerm ||
        title.includes(searchTerm.toLowerCase()) ||
        loc.includes(searchTerm.toLowerCase());

      const matchesCategory = selectedCategory === 'all' || item.food_category === selectedCategory;

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
    <div className="page-enter">
      {/* Search & Filters Card */}
      <div className="card mb-6" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search
                size={16}
                strokeWidth={1.65}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-subtle)',
                }}
              />
              <input
                type="text"
                placeholder="Search by food title or address"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '36px' }}
              />
            </div>

            {onRefresh && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={onRefresh}
                disabled={loading}
                title="Refresh feed"
              >
                <RefreshCw size={15} strokeWidth={1.65} className={loading ? 'spin-icon' : ''} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px', marginRight: '4px' }}>
              <SlidersHorizontal size={13} strokeWidth={1.65} />
              <span>Category</span>
            </span>
            {CATEGORY_OPTIONS.map((cat) => (
              <button
                type="button"
                key={cat.id}
                className={`btn btn-sm ${selectedCategory === cat.id ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => handleCategoryChange(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px', marginRight: '4px' }}>
              <Filter size={13} strokeWidth={1.65} />
              <span>Status</span>
            </span>
            {STATUS_OPTIONS.map((st) => (
              <button
                type="button"
                key={st.id}
                className={`btn btn-sm ${selectedStatus === st.id ? 'btn-pastel' : 'btn-outline'}`}
                onClick={() => handleStatusChange(st.id)}
              >
                {st.label}
              </button>
            ))}

            {(searchTerm || selectedCategory !== 'all' || selectedStatus !== 'all') && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ marginLeft: 'auto' }}
                onClick={() => {
                  setSearchTerm('');
                  handleCategoryChange('all');
                  handleStatusChange('all');
                }}
              >
                Reset filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results Grid */}
      {loading && donations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 16px' }}>
          <div className="spinner" style={{ width: '28px', height: '28px', margin: '0 auto 12px' }} />
          <p style={{ fontSize: '14px' }}>Loading surplus food listings</p>
        </div>
      ) : filteredDonations.length === 0 ? (
        <EmptyState
          title="No matching donations"
          description={
            searchTerm || selectedCategory !== 'all'
              ? 'Widen category filters or adjust search terms'
              : 'No surplus batches are currently listed in this workspace'
          }
          actionLabel={searchTerm || selectedCategory !== 'all' || selectedStatus !== 'all' ? 'Clear filters' : null}
          onAction={() => {
            setSearchTerm('');
            handleCategoryChange('all');
            handleStatusChange('all');
          }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {filteredDonations.map((donation) => (
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
