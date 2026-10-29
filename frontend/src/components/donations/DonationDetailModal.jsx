import React from 'react';
import { 
  X, 
  MapPin, 
  Clock, 
  Scale, 
  Thermometer, 
  Calendar, 
  ExternalLink, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  AlertTriangle,
  HelpCircle,
  FileText
} from 'lucide-react';
import StatusBadge from '../common/StatusBadge';
import CategoryPill from '../common/CategoryPill';
import UrgencyTimer from '../common/UrgencyTimer';
import PlaceholderImage from '../common/PlaceholderImage';

const LIFECYCLE_STEPS = [
  { key: 'submitted', label: '1. Registered' },
  { key: 'available', label: '2. Available' },
  { key: 'accepted', label: '3. Claimed' },
  { key: 'collected', label: '4. Collected' }
];

const DonationDetailModal = ({ 
  donation, 
  onClose, 
  onAccept, 
  onCollect 
}) => {
  if (!donation) return null;

  const {
    id,
    title,
    foodName,
    food_category,
    dietary_type,
    quantity,
    quantityText,
    quantity_unit,
    image_url,
    pickup_available_until,
    expiryTime,
    address_text,
    location,
    preparation_time,
    current_storage,
    expiry_date,
    packaging_type,
    allergens,
    special_note,
    status = 'available',
    created_at,
    createdAt,
    ai_assessment
  } = donation;

  const displayName = title || foodName || 'Surplus Food Listing';
  const displayLocation = address_text || location || 'Address on file';
  const displayExpiry = pickup_available_until || expiryTime;
  const displayQuantity = quantityText || (typeof quantity === 'number' ? `${quantity} ${quantity_unit || 'servings'}` : `${quantity || 1} servings`);
  const registeredTime = created_at || createdAt ? new Date(created_at || createdAt).toLocaleString() : 'Recently';

  const isAccepted = status === 'accepted';
  const isCollected = status === 'collected';

  const resolvedImageUrl = image_url 
    ? (image_url.startsWith('http') ? image_url : `http://localhost:5000${image_url}`)
    : null;

  // Determine current lifecycle step index
  const getStepIndex = (st) => {
    switch ((st || '').toLowerCase()) {
      case 'submitted': return 0;
      case 'available': return 1;
      case 'accepted': return 2;
      case 'collected': return 3;
      default: return 1;
    }
  };

  const currentStep = getStepIndex(status);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-sheet" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <StatusBadge status={status} />
            <CategoryPill category={food_category} />
          </div>
          <button 
            type="button" 
            className="btn btn-ghost" 
            style={{ padding: '0.4rem', borderRadius: '50%' }}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {/* Main Photo Banner */}
          <div style={{ 
            width: '100%', 
            height: '240px', 
            borderRadius: 'var(--radius-lg)', 
            overflow: 'hidden', 
            marginBottom: '1.25rem',
            backgroundColor: 'var(--color-bg-subtle)' 
          }}>
            {resolvedImageUrl ? (
              <img 
                src={resolvedImageUrl} 
                alt={displayName} 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent) {
                    const fallback = parent.querySelector('.modal-placeholder-fallback');
                    if (fallback) fallback.style.display = 'block';
                  }
                }}
              />
            ) : null}
            <div 
              className="modal-placeholder-fallback"
              style={{ display: resolvedImageUrl ? 'none' : 'block', width: '100%', height: '100%' }}
            >
              <PlaceholderImage category={food_category} title={displayName} height="240px" />
            </div>
          </div>

          {/* Title & Core Meta */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.6rem', color: 'var(--color-primary)', marginBottom: '0.35rem' }}>
              {displayName}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
              <span>Registered {registeredTime}</span>
              &bull;
              <span>Ref ID #{id}</span>
            </div>
          </div>

          {/* Status Timeline */}
          <div style={{ 
            padding: '1.25rem', 
            backgroundColor: 'var(--color-bg-base)', 
            borderRadius: 'var(--radius-md)', 
            border: '1px solid var(--color-border)',
            marginBottom: '1.5rem'
          }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '0.85rem' }}>
              Status Lifecycle
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
              {LIFECYCLE_STEPS.map((step, idx) => {
                const isPassed = idx <= currentStep;
                const isCurrent = idx === currentStep;

                return (
                  <div key={step.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, zIndex: 2 }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: isPassed ? 'var(--color-primary)' : 'var(--color-bg-surface)',
                      color: isPassed ? '#FFFFFF' : 'var(--color-text-muted)',
                      border: isPassed ? '2px solid var(--color-primary)' : '2px solid var(--color-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      marginBottom: '0.35rem'
                    }}>
                      {isPassed ? <CheckCircle2 size={16} /> : idx + 1}
                    </div>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      fontWeight: isCurrent ? 700 : 500, 
                      color: isCurrent ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      textAlign: 'center'
                    }}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Structured Parameters Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Quantity &amp; Volume</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-primary)' }}>
                <Scale size={18} style={{ color: 'var(--color-accent)' }} />
                <span>{displayQuantity}</span>
              </div>
              {packaging_type && (
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                  Packaging: {packaging_type === 'sealed_covered' ? 'Sealed / Covered' : 'Open / Loose'}
                </div>
              )}
            </div>

            <div className="card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Dietary Profile</div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: dietary_type === 'vegetarian' ? '#2F6126' : '#A32A2A' }}>
                {dietary_type === 'vegetarian' ? '🟢 Vegetarian' : '🔴 Non-Vegetarian'}
              </div>
              {allergens ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                  Allergens: {allergens}
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                  No allergen warnings specified
                </div>
              )}
            </div>

            <div className="card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Pickup Deadline</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-primary)' }}>
                <Clock size={16} />
                <span>{displayExpiry ? new Date(displayExpiry).toLocaleString() : 'N/A'}</span>
              </div>
              <div style={{ marginTop: '0.35rem' }}>
                <UrgencyTimer pickupAvailableUntil={displayExpiry} />
              </div>
            </div>

            {/* Conditionals */}
            {preparation_time && (
              <div className="card" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Cooked Food Storage</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.95rem', color: 'var(--color-primary)' }}>
                  <Thermometer size={16} style={{ color: 'var(--color-primary)' }} />
                  <span>{current_storage ? current_storage.replace(/_/g, ' ') : 'Room Temperature'}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                  Prepared: {preparation_time.replace(/_/g, ' ')}
                </div>
              </div>
            )}

            {expiry_date && (
              <div className="card" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Package Best Before</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.95rem', color: 'var(--color-primary)' }}>
                  <Calendar size={16} />
                  <span>{expiry_date}</span>
                </div>
              </div>
            )}
          </div>

          {/* Pickup Address & Maps */}
          <div className="card mb-6" style={{ padding: '1.25rem', backgroundColor: 'var(--color-bg-base)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <MapPin size={20} style={{ color: 'var(--color-primary)', marginTop: '2px', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-primary)', marginBottom: '0.2rem' }}>
                  Pickup Address
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--color-text-main)', marginBottom: '0.5rem' }}>
                  {displayLocation}
                </div>
                {special_note && (
                  <div style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem', fontStyle: 'italic' }}>
                    Note: "{special_note}"
                  </div>
                )}
                <a 
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(displayLocation)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline"
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', display: 'inline-flex', gap: '0.4rem' }}
                >
                  <ExternalLink size={13} />
                  <span>Open Directions in Google Maps</span>
                </a>
              </div>
            </div>
          </div>

          {/* AI Visual Condition Assessment (Real or Placeholder) */}
          {ai_assessment && ai_assessment.assessment_status === 'completed' ? (
            <div style={{
              padding: '1.25rem',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: ai_assessment.visual_assessment_label === 'visually_acceptable' ? 'var(--color-secondary-subtle)' : 'var(--color-danger-subtle)',
              border: ai_assessment.visual_assessment_label === 'visually_acceptable' ? '1px solid rgba(91, 140, 81, 0.3)' : '1px solid rgba(217, 72, 59, 0.3)',
              marginBottom: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-primary)' }}>
                  <Sparkles size={14} style={{ color: 'var(--color-accent)' }} />
                  <span>AI Visual Condition Assessment</span>
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                  Model: {ai_assessment.model_version || 'resnet18_v1.0.0_foodloop'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontWeight: 800,
                  fontSize: '1.05rem',
                  color: ai_assessment.visual_assessment_label === 'visually_acceptable' ? '#2F6126' : '#A32A2A'
                }}>
                  {ai_assessment.visual_assessment_label === 'visually_acceptable' ? (
                    <>
                      <CheckCircle2 size={18} />
                      <span>✓ Visually Acceptable</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={18} />
                      <span>⚠ Visually Unsuitable</span>
                    </>
                  )}
                </div>
                <div className="tabular-nums" style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-primary)' }}>
                  {Math.round((ai_assessment.confidence_score || 0) * 100)}% confidence
                </div>
              </div>

              {/* Probabilities Breakdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Fresh appearance:</span>
                  <span className="tabular-nums" style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                    {Math.round((ai_assessment.probability_fresh || 0) * 100)}%
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Visible deterioration:</span>
                  <span className="tabular-nums" style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                    {Math.round((ai_assessment.probability_rotten || 0) * 100)}%
                  </span>
                </div>
              </div>

              {/* Disclaimer */}
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '0.65rem', lineHeight: 1.45 }}>
                {ai_assessment.disclaimer || 'AI operational triage only. Does not certify food safety or detect pathogens, toxins, or internal spoilage.'}
              </div>
            </div>
          ) : (
            <div style={{
              padding: '1.25rem',
              borderRadius: 'var(--radius-lg)',
              border: '1.5px dashed var(--color-border)',
              backgroundColor: '#FFFFFF',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.85rem'
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-accent-subtle)',
                color: 'var(--color-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Sparkles size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.925rem', color: 'var(--color-primary)', marginBottom: '0.15rem' }}>
                  AI Visual Condition Screening
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                  {food_category === 'fresh_produce' 
                    ? 'AI visual screening verified at registration (Model Contract: ResNet-18 Produce Triage).' 
                    : 'AI visual assessment is validated exclusively for fresh produce (apples, bananas, oranges). Other food categories undergo standard volunteer inspection.'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="modal-footer">
          <button 
            type="button" 
            className="btn btn-outline" 
            onClick={onClose}
          >
            Close
          </button>

          {isCollected ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#5D2A9E', fontWeight: 700, fontSize: '0.9rem' }}>
              <CheckCircle2 size={18} />
              <span>Rescue Completed</span>
            </div>
          ) : isAccepted ? (
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={() => {
                onCollect && onCollect(id);
                onClose();
              }}
            >
              Mark Collected
            </button>
          ) : (
            <button 
              type="button" 
              className="btn btn-primary"
              onClick={() => {
                onAccept && onAccept(id);
                onClose();
              }}
            >
              Accept Donation
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DonationDetailModal;
