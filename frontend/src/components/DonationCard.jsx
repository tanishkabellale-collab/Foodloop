import { Clock, MapPin, Scale, CheckCircle2, ExternalLink, Tag } from 'lucide-react';

const DonationCard = ({ donation, onAccept, onCollect }) => {
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
  const displayLocation = address_text || location || '';
  const displayExpiry = pickup_available_until || expiryTime;
  const displayQuantity = quantityText || (typeof quantity === 'string' ? quantity : `${quantity} ${quantity_unit || 'servings'}`);

  const isAccepted = status === 'accepted';
  const isCollected = status === 'collected';

  const getImageUrl = (name) => {
    return `https://loremflickr.com/400/300/food,${encodeURIComponent(name || 'meal')}`;
  };

  // Option A decision: local uploads served through Express, legacy fallbacks to loremflickr
  const displayImage = image_url 
    ? (image_url.startsWith('http') ? image_url : `http://localhost:5000${image_url}`)
    : getImageUrl(displayName);

  const getStatusBadgeStyle = () => {
    switch (status) {
      case 'accepted':
        return { background: 'rgba(59, 130, 246, 0.85)', color: 'white' };
      case 'collected':
        return { background: 'rgba(168, 85, 247, 0.85)', color: 'white' };
      case 'submitted':
        return { background: 'rgba(234, 179, 8, 0.85)', color: '#1e293b' };
      case 'available':
      default:
        return { background: 'rgba(34, 197, 94, 0.85)', color: 'white' };
    }
  };

  const formatCategory = (cat) => {
    switch (cat) {
      case 'cooked_meals': return 'Cooked Meals';
      case 'fresh_produce': return 'Fresh Produce';
      case 'bakery': return 'Bakery';
      case 'packaged_sealed': return 'Packaged';
      default: return null;
    }
  };

  return (
    <div className={`glass glass-card animate-fade-in flex flex-col ${isAccepted ? 'opacity-80' : ''}`} style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ width: '100%', height: '190px', position: 'relative', background: '#0f172a' }}>
        <img 
          src={displayImage} 
          alt={displayName} 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => {
            // Fallback if image fails to load
            e.currentTarget.src = getImageUrl(displayName);
          }}
        />
        <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
          <span 
            className="badge" 
            style={{ 
              backdropFilter: 'blur(8px)', 
              ...getStatusBadgeStyle(),
              border: 'none',
              textTransform: 'uppercase',
              fontSize: '0.7rem',
              fontWeight: 700
            }}
          >
            {status || 'available'}
          </span>
        </div>

        {/* Dietary & Category indicator chips */}
        <div style={{ position: 'absolute', bottom: '10px', left: '10px', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {dietary_type && (
            <span style={{ 
              background: 'rgba(15, 23, 42, 0.85)', 
              backdropFilter: 'blur(6px)',
              padding: '0.2rem 0.5rem', 
              borderRadius: '6px', 
              fontSize: '0.7rem',
              fontWeight: 600,
              color: dietary_type === 'vegetarian' ? '#4ade80' : '#f87171',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              {dietary_type === 'vegetarian' ? '🟢 Veg' : '🔴 Non-Veg'}
            </span>
          )}
          {food_category && formatCategory(food_category) && (
            <span style={{ 
              background: 'rgba(15, 23, 42, 0.85)', 
              backdropFilter: 'blur(6px)',
              padding: '0.2rem 0.5rem', 
              borderRadius: '6px', 
              fontSize: '0.7rem',
              fontWeight: 600,
              color: 'var(--text-main)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              {formatCategory(food_category)}
            </span>
          )}
        </div>
      </div>

      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-xl font-bold" style={{ marginBottom: 0 }}>{displayName}</h3>
        </div>

        <div className="space-y-3 mb-5" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div className="flex items-center gap-3 text-sm text-muted">
            <Scale size={16} />
            <span>{displayQuantity}</span>
            {packaging_type && (
              <span style={{ fontSize: '0.75rem', opacity: 0.8, marginLeft: 'auto' }}>
                ({packaging_type === 'sealed_covered' ? 'Sealed / Covered' : 'Open / Loose'})
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-3 text-sm text-muted">
            <Clock size={16} />
            <span>Pickup by: {displayExpiry ? new Date(displayExpiry).toLocaleString() : 'N/A'}</span>
          </div>
          
          <div className="flex items-start gap-3 text-sm p-3 rounded-lg" style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.1)' }}>
            <MapPin size={18} style={{ color: 'var(--secondary)', marginTop: '2px', flexShrink: 0 }} />
            <div className="flex-1" style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '2px', fontSize: '0.85rem' }}>Pickup Address</div>
              <div style={{ color: 'var(--text-muted)', marginBottom: '6px', fontSize: '0.85rem', wordBreak: 'break-word' }}>{displayLocation}</div>
              <a 
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(displayLocation)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-medium hover:underline"
                style={{ color: 'var(--secondary)', display: 'inline-flex' }}
              >
                <ExternalLink size={12} />
                View on Google Maps
              </a>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-auto pt-3 border-t" style={{ borderTop: '1px solid var(--border-color)' }}>
          <div></div>
          {isCollected ? (
            <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--success)' }}>
              <CheckCircle2 size={18} />
              <span>Collected</span>
            </div>
          ) : isAccepted ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-muted mr-2">Accepted</span>
              <button 
                className="btn btn-outline"
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderColor: 'var(--success)', color: 'var(--success)' }}
                onClick={() => onCollect(id)}
              >
                Mark Collected
              </button>
            </div>
          ) : (
            <button 
              className="btn btn-primary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
              onClick={() => onAccept(id)}
            >
              Accept Donation
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DonationCard;
