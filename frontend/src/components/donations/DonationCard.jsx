import React from 'react';
import { MapPin, Scale, ExternalLink, Eye, CheckCircle2 } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';
import CategoryPill from '../common/CategoryPill';
import UrgencyTimer from '../common/UrgencyTimer';
import PlaceholderImage from '../common/PlaceholderImage';

const DonationCard = ({ 
  donation, 
  onSelect, 
  onAccept, 
  onCollect,
  showActions = true 
}) => {
  const { 
    id, 
    foodName, 
    title,
    quantity, 
    quantityText,
    quantity_unit,
    expiryTime, 
    pickup_available_until,
    location, 
    address_text,
    status,
    image_url,
    food_category,
    dietary_type,
    packaging_type
  } = donation;
  
  const displayName = title || foodName || 'Surplus Food';
  const displayLocation = address_text || location || 'Pickup Location Specified';
  const displayExpiry = pickup_available_until || expiryTime;
  const displayQuantity = quantityText || (typeof quantity === 'number' ? `${quantity} ${quantity_unit || 'servings'}` : `${quantity || 1} servings`);

  const isAccepted = status === 'accepted';
  const isCollected = status === 'collected';

  // Local image url resolver: no external loremflickr
  const resolvedImageUrl = image_url 
    ? (image_url.startsWith('http') ? image_url : `http://localhost:5000${image_url}`)
    : null;

  return (
    <div 
      className="card card-hoverable" 
      style={{
        padding: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer'
      }}
      onClick={() => onSelect && onSelect(donation)}
    >
      {/* Card Media Header */}
      <div style={{ width: '100%', height: '190px', position: 'relative', backgroundColor: 'var(--color-bg-subtle)' }}>
        {resolvedImageUrl ? (
          <img 
            src={resolvedImageUrl} 
            alt={displayName} 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              // Hide broken image so fallback placeholder renders smoothly
              e.currentTarget.style.display = 'none';
              const parent = e.currentTarget.parentElement;
              if (parent) {
                const placeholder = parent.querySelector('.card-placeholder-fallback');
                if (placeholder) placeholder.style.display = 'block';
              }
            }}
          />
        ) : null}

        <div 
          className="card-placeholder-fallback"
          style={{ display: resolvedImageUrl ? 'none' : 'block', width: '100%', height: '100%' }}
        >
          <PlaceholderImage category={food_category} title={displayName} height="190px" />
        </div>

        {/* Top Floating Status & Category Badges */}
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          right: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pointerEvents: 'none'
        }}>
          <StatusBadge status={status} />
          {dietary_type && (
            <span style={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              padding: '0.2rem 0.5rem',
              borderRadius: '6px',
              fontSize: '0.72rem',
              fontWeight: 700,
              color: dietary_type === 'vegetarian' ? '#2F6126' : '#A32A2A',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              {dietary_type === 'vegetarian' ? '🟢 Veg' : '🔴 Non-Veg'}
            </span>
          )}
        </div>
      </div>

      {/* Card Content */}
      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <h3 style={{ 
            fontSize: '1.15rem', 
            fontWeight: 700, 
            color: 'var(--color-primary)', 
            marginBottom: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {displayName}
          </h3>
          <CategoryPill category={food_category} />
        </div>

        {/* Operational Parameters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', margin: '0.75rem 0 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--color-text-main)', fontWeight: 600 }}>
            <Scale size={15} style={{ color: 'var(--color-accent)' }} />
            <span>{displayQuantity}</span>
            {packaging_type && (
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 400 }}>
                ({packaging_type === 'sealed_covered' ? 'Sealed' : 'Open / Loose'})
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.825rem', color: 'var(--color-text-muted)' }}>
            <MapPin size={15} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayLocation}
            </span>
          </div>

          <div>
            <UrgencyTimer pickupAvailableUntil={displayExpiry} />
          </div>
        </div>

        {/* Card Footer Actions */}
        <div style={{ 
          marginTop: 'auto', 
          paddingTop: '0.85rem', 
          borderTop: '1px solid var(--color-border)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          gap: '0.5rem'
        }}>
          <button 
            type="button"
            className="btn btn-outline" 
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.825rem' }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect && onSelect(donation);
            }}
          >
            <Eye size={14} />
            <span>Details</span>
          </button>

          {showActions && (
            <div>
              {isCollected ? (
                <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#5D2A9E', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <CheckCircle2 size={16} />
                  <span>Collected</span>
                </span>
              ) : isAccepted ? (
                <button 
                  type="button"
                  className="btn btn-secondary" 
                  style={{ padding: '0.45rem 0.85rem', fontSize: '0.825rem' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCollect && onCollect(id);
                  }}
                >
                  Mark Collected
                </button>
              ) : (
                <button 
                  type="button"
                  className="btn btn-primary" 
                  style={{ padding: '0.45rem 0.85rem', fontSize: '0.825rem' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAccept && onAccept(id);
                  }}
                >
                  Accept Surplus
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DonationCard;

