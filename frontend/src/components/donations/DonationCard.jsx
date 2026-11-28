import React from 'react';
import { MapPin, Scale, Eye, CheckCircle2 } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';
import CategoryPill from '../common/CategoryPill';
import UrgencyTimer from '../common/UrgencyTimer';
import PlaceholderImage from '../common/PlaceholderImage';
import { resolveAssetUrl } from '../../config';

const DonationCard = ({
  donation,
  onSelect,
  onAccept,
  onCollect,
  showActions = true,
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
    packaging_type,
  } = donation;

  const displayName = title || foodName || 'Surplus food';
  const displayLocation = address_text || location || 'Address on file';
  const displayExpiry = pickup_available_until || expiryTime;
  const displayQuantity =
    quantityText ||
    (typeof quantity === 'number'
      ? `${quantity} ${quantity_unit || 'servings'}`
      : `${quantity || 1} servings`);

  const isAccepted = status === 'accepted';
  const isCollected = status === 'collected';
  const resolvedImageUrl = resolveAssetUrl(image_url);

  return (
    <div
      className="card card-hoverable"
      style={{
        padding: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
      }}
      onClick={() => onSelect && onSelect(donation)}
    >
      {/* Card Photo */}
      <div style={{ width: '100%', height: '188px', position: 'relative', backgroundColor: 'var(--color-bg-subtle)' }}>
        {resolvedImageUrl ? (
          <img
            src={resolvedImageUrl}
            alt={displayName}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
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
          <PlaceholderImage category={food_category} title={displayName} height="188px" />
        </div>

        {/* Top Badges */}
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            right: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            pointerEvents: 'none',
          }}
        >
          <StatusBadge status={status} />
          {dietary_type && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#FFFFFF',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--color-ink)',
                border: '1px solid var(--color-border)',
              }}
            >
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: dietary_type === 'vegetarian' ? '#56A450' : 'var(--color-accent)',
                }}
              />
              <span>{dietary_type === 'vegetarian' ? 'Veg' : 'Non-veg'}</span>
            </span>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
          <h3
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--color-ink)',
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {displayName}
          </h3>
          <CategoryPill category={food_category} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '8px 0 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-ink)', fontWeight: 500 }}>
            <Scale size={14} strokeWidth={1.65} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
            <span className="tabular-nums">{displayQuantity}</span>
            {packaging_type && (
              <span style={{ fontSize: '12px', color: 'var(--color-text-subtle)', fontWeight: 400 }}>
                ({packaging_type === 'sealed_covered' ? 'Sealed' : 'Open tray'})
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
            <MapPin size={14} strokeWidth={1.65} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayLocation}
            </span>
          </div>

          <div>
            <UrgencyTimer pickupAvailableUntil={displayExpiry} />
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: 'auto',
            paddingTop: '12px',
            borderTop: '1px solid var(--color-border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              onSelect && onSelect(donation);
            }}
          >
            <Eye size={14} strokeWidth={1.65} />
            <span>Details</span>
          </button>

          {showActions && (
            <div>
              {isCollected ? (
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-pastel-green-ink)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={15} strokeWidth={1.75} />
                  <span>Collected</span>
                </span>
              ) : isAccepted && onCollect ? (
                <button
                  type="button"
                  className="btn btn-pastel btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCollect(id);
                  }}
                >
                  Mark collected
                </button>
              ) : !isAccepted && onAccept ? (
                <button
                  type="button"
                  className="btn btn-orange btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAccept(id);
                  }}
                >
                  Accept surplus
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DonationCard;
