import React from 'react';
import { ArrowRight, Clock, MapPin, Eye, PlusCircle, CheckCircle } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';
import CategoryPill from '../common/CategoryPill';
import UrgencyTimer from '../common/UrgencyTimer';

const RecentActivity = ({ 
  donations = [], 
  onSelectDonation, 
  onTabChange 
}) => {
  const recent = [...donations].slice(0, 4);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* 2 Cols: Recent Submissions / Listings */}
      <div style={{ gridColumn: 'span 2' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.15rem' }}>Recent Listings</h3>
            <p style={{ fontSize: '0.85rem', margin: 0 }}>Latest surplus food registered in the network.</p>
          </div>
          <button 
            type="button" 
            className="btn btn-ghost" 
            style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
            onClick={() => onTabChange('donations')}
          >
            <span>View All</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {recent.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
            <p>No recent activity recorded.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {recent.map(d => {
              const title = d.title || d.foodName || 'Surplus Food';
              const location = d.address_text || d.location || 'Local Donor';
              const expiry = d.pickup_available_until || d.expiryTime;

              return (
                <div 
                  key={d.id} 
                  className="card card-hoverable"
                  style={{
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    cursor: 'pointer'
                  }}
                  onClick={() => onSelectDonation(d)}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-primary)' }}>
                        {title}
                      </span>
                      <CategoryPill category={d.food_category} />
                      <StatusBadge status={d.status} size="small" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <MapPin size={13} />
                        <span style={{ maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {location}
                        </span>
                      </span>
                      <UrgencyTimer pickupAvailableUntil={expiry} />
                    </div>
                  </div>

                  <button 
                    type="button" 
                    className="btn btn-outline" 
                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', flexShrink: 0 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDonation(d);
                    }}
                  >
                    <Eye size={14} />
                    <span>Details</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 1 Col: Quick Actions & Operational Context */}
      <div>
        <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Quick Actions</h3>
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-primary)', marginBottom: '0.25rem' }}>
              Have surplus edible food?
            </div>
            <p style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
              Register hot meals, packaged items, or fresh produce in under 60 seconds.
            </p>
            <button 
              type="button" 
              className="btn btn-primary w-full"
              onClick={() => onTabChange('create')}
            >
              <PlusCircle size={16} />
              <span>Register Donation</span>
            </button>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)' }} />

          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-primary)', marginBottom: '0.25rem' }}>
              Operating an NGO or Shelter?
            </div>
            <p style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
              Browse listings matching your facility's dietary needs and pickup capacity.
            </p>
            <button 
              type="button" 
              className="btn btn-secondary w-full"
              onClick={() => onTabChange('donations')}
            >
              <CheckCircle size={16} />
              <span>Browse Active Surplus</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecentActivity;

