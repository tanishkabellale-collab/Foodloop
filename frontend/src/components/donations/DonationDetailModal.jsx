import React, { useEffect } from 'react';
import {
  X,
  MapPin,
  Clock,
  Scale,
  Thermometer,
  Calendar,
  ExternalLink,
  ScanEye,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import StatusBadge from '../common/StatusBadge';
import CategoryPill from '../common/CategoryPill';
import UrgencyTimer from '../common/UrgencyTimer';
import PlaceholderImage from '../common/PlaceholderImage';
import { resolveAssetUrl } from '../../config';

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
  useEffect(() => {
    if (!donation || !onClose) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [donation, onClose]);

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

  const displayName = title || foodName || 'Surplus food listing';
  const displayLocation = address_text || location || 'Address on file';
  const displayExpiry = pickup_available_until || expiryTime;
  const displayQuantity = quantityText || (typeof quantity === 'number' ? `${quantity} ${quantity_unit || 'servings'}` : `${quantity || 1} servings`);
  const registeredTime = created_at || createdAt ? new Date(created_at || createdAt).toLocaleString() : 'Recently';

  const isAccepted = status === 'accepted';
  const isCollected = status === 'collected';

  const resolvedImageUrl = resolveAssetUrl(image_url);

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
  const isVeg = dietary_type === 'vegetarian';

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={displayName}>
      <div
        className="modal-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <StatusBadge status={status} />
            <CategoryPill category={food_category} />
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            aria-label="Close modal"
            style={{ minHeight: '32px', padding: '6px', borderRadius: 'var(--radius-md)' }}
            onClick={onClose}
          >
            <X size={18} strokeWidth={1.65} />
          </button>
        </div>

        <div className="modal-body">
          {/* Main Photo Banner */}
          <div style={{
            width: '100%',
            height: '240px',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            marginBottom: '20px',
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
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '20px', color: 'var(--color-ink)', marginBottom: '4px' }}>
              {displayName}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', color: 'var(--color-text-muted)', fontSize: '13px' }}>
              <span>Registered {registeredTime}</span>
              <span>·</span>
              <span className="mono">Ref #{id}</span>
            </div>
          </div>

          {/* Status Timeline */}
          <div style={{
            padding: '16px',
            backgroundColor: 'var(--color-bg-base)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            marginBottom: '20px'
          }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-ink)', marginBottom: '12px' }}>
              Status lifecycle
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
              {LIFECYCLE_STEPS.map((step, idx) => {
                const isPassed = idx <= currentStep;
                const isCurrent = idx === currentStep;

                return (
                  <div key={step.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, zIndex: 2 }}>
                    <div className="mono" style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: isCurrent ? 'var(--color-accent)' : isPassed ? 'var(--color-ink)' : 'var(--color-bg-surface)',
                      color: isPassed ? '#FFFFFF' : 'var(--color-text-muted)',
                      border: isCurrent ? '1px solid var(--color-accent)' : isPassed ? '1px solid var(--color-ink)' : '1px solid var(--color-border-strong)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 600,
                      marginBottom: '6px'
                    }}>
                      {isPassed ? <CheckCircle2 size={14} strokeWidth={1.75} /> : idx + 1}
                    </div>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: isCurrent ? 600 : 500,
                      color: isCurrent ? 'var(--color-ink)' : 'var(--color-text-muted)',
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
            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Quantity and volume</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '15px', color: 'var(--color-ink)' }}>
                <Scale size={16} strokeWidth={1.65} style={{ color: 'var(--color-accent)' }} />
                <span>{displayQuantity}</span>
              </div>
              {packaging_type && (
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  Packaging: {packaging_type === 'sealed_covered' ? 'Sealed / covered' : 'Open / loose'}
                </div>
              )}
            </div>

            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Dietary profile</div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 600,
                fontSize: '15px',
                color: isVeg ? 'var(--color-pastel-green-ink)' : 'var(--color-accent-ink)'
              }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: isVeg ? '#5E9E59' : 'var(--color-accent)',
                  display: 'inline-block'
                }} />
                <span>{isVeg ? 'Vegetarian' : 'Non-vegetarian'}</span>
              </div>
              {allergens ? (
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  Allergens: {allergens}
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  No allergen warnings specified
                </div>
              )}
            </div>

            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Pickup deadline</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '14px', color: 'var(--color-ink)' }}>
                <Clock size={15} strokeWidth={1.65} />
                <span>{displayExpiry ? new Date(displayExpiry).toLocaleString() : 'N/A'}</span>
              </div>
              <div style={{ marginTop: '8px' }}>
                <UrgencyTimer pickupAvailableUntil={displayExpiry} />
              </div>
            </div>

            {preparation_time && (
              <div className="card" style={{ padding: '16px' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Cooked food storage</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '14px', color: 'var(--color-ink)' }}>
                  <Thermometer size={15} strokeWidth={1.65} />
                  <span style={{ textTransform: 'capitalize' }}>
                    {current_storage ? current_storage.replace(/_/g, ' ') : 'Room temperature'}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  Prepared: {preparation_time.replace(/_/g, ' ')}
                </div>
              </div>
            )}

            {expiry_date && (
              <div className="card" style={{ padding: '16px' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Package best before</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '14px', color: 'var(--color-ink)' }}>
                  <Calendar size={15} strokeWidth={1.65} />
                  <span className="mono">{expiry_date}</span>
                </div>
              </div>
            )}
          </div>

          {/* Pickup Address & Maps */}
          <div className="card mb-6" style={{ padding: '16px', backgroundColor: 'var(--color-bg-base)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <MapPin size={18} strokeWidth={1.65} style={{ color: 'var(--color-accent)', marginTop: '2px', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-ink)', marginBottom: '4px' }}>
                  Pickup address
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-main)', marginBottom: '8px' }}>
                  {displayLocation}
                </div>
                {special_note && (
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '12px', fontStyle: 'italic' }}>
                    Note: &ldquo;{special_note}&rdquo;
                  </div>
                )}
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(displayLocation)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-sm"
                >
                  <ExternalLink size={13} strokeWidth={1.65} />
                  <span>Open directions in Maps</span>
                </a>
              </div>
            </div>
          </div>

          {/* AI Visual Condition Assessment (Gemini / Groq / Hybrid ONNX / Legacy ONNX) */}
          {ai_assessment && ai_assessment.assessment_status === 'completed' ? (() => {
            const isLegacyOnnx = Boolean(ai_assessment.visual_assessment_label) && !ai_assessment.possible_food_description;
            const isAcceptable = ai_assessment.visual_assessment_label === 'visually_acceptable';
            const isDemo = Boolean(ai_assessment.is_demo_fallback);
            const bgColor = isLegacyOnnx
              ? (isAcceptable ? 'var(--color-pastel-green-subtle)' : 'var(--color-danger-subtle)')
              : (isDemo ? 'var(--color-bg-base)' : 'var(--color-pastel-green-subtle)');
            const borderColor = isLegacyOnnx
              ? (isAcceptable ? '1px solid var(--color-pastel-green-strong)' : '1px solid rgba(194, 58, 43, 0.35)')
              : (isDemo ? '1px solid var(--color-border-strong)' : '1px solid var(--color-pastel-green-strong)');

            return (
              <div style={{
                padding: '16px',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: bgColor,
                border: borderColor,
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '13px', color: 'var(--color-ink)' }}>
                    <ScanEye size={15} strokeWidth={1.65} style={{ color: 'var(--color-accent)' }} />
                    <span>Visual condition screening</span>
                  </div>
                  <span className="mono" style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)' }}>
                    {isDemo
                      ? 'Fallback mode'
                      : `Model: ${ai_assessment.model_version || 'gemini-vision'}`}
                  </span>
                </div>

                {isLegacyOnnx ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontWeight: 600,
                        fontSize: '15px',
                        color: isAcceptable ? 'var(--color-pastel-green-ink)' : 'var(--color-danger)'
                      }}>
                        {isAcceptable ? (
                          <>
                            <CheckCircle2 size={16} strokeWidth={1.75} />
                            <span>Visually acceptable</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle size={16} strokeWidth={1.75} />
                            <span>Visually unsuitable</span>
                          </>
                        )}
                      </div>
                      <div className="mono" style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-ink)' }}>
                        {Math.round((ai_assessment.confidence_score || 0) * 100)}% confidence
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <span style={{ color: 'var(--color-text-muted)' }}>Fresh appearance:</span>
                        <span className="mono" style={{ fontWeight: 600, color: 'var(--color-ink)' }}>
                          {Math.round((ai_assessment.probability_fresh || 0) * 100)}%
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <span style={{ color: 'var(--color-text-muted)' }}>Visible deterioration:</span>
                        <span className="mono" style={{ fontWeight: 600, color: 'var(--color-ink)' }}>
                          {Math.round((ai_assessment.probability_rotten || 0) * 100)}%
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', color: 'var(--color-text-main)' }}>
                        <strong style={{ color: 'var(--color-ink)', fontWeight: 600 }}>Suggested category:</strong>{' '}
                        <span style={{ textTransform: 'capitalize' }}>
                          {(ai_assessment.suggested_food_category || 'uncertain').replace(/_/g, ' ')}
                        </span>
                      </span>
                      <span className="mono" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-ink)' }}>
                        Confidence: {ai_assessment.confidence_level || 'low'}
                        {typeof ai_assessment.confidence_score === 'number'
                          ? ` (${Math.round(ai_assessment.confidence_score * 100)}%)`
                          : ''}
                      </span>
                    </div>

                    {ai_assessment.possible_food_description && (
                      <div style={{ fontSize: '13px', color: 'var(--color-text-main)', lineHeight: 1.45 }}>
                        <strong style={{ color: 'var(--color-ink)', fontWeight: 600 }}>Visible description:</strong>{' '}
                        {ai_assessment.possible_food_description}
                      </div>
                    )}

                    {ai_assessment.onnx_produce_screening && (
                      <div style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid var(--color-border)',
                        fontSize: '12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '8px'
                      }}>
                        <span>
                          <strong style={{ fontWeight: 600 }}>Produce model screening:</strong>{' '}
                          {(ai_assessment.onnx_produce_screening.visual_assessment_label || '').replace(/_/g, ' ')}
                        </span>
                        <span className="mono">
                          {Math.round((ai_assessment.onnx_produce_screening.confidence_score || 0) * 100)}% confidence
                        </span>
                      </div>
                    )}

                    {ai_assessment.human_review_recommended && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--color-accent-subtle)',
                        border: '1px solid rgba(234, 93, 26, 0.3)',
                        fontSize: '12px',
                        color: 'var(--color-ink)'
                      }}>
                        <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--color-accent-ink)' }} />
                        <span>
                          <strong style={{ fontWeight: 600 }}>Human review recommended:</strong>{' '}
                          {ai_assessment.human_review_reason || 'Manual verification is required before dispatch.'}
                        </span>
                      </div>
                    )}

                    {Array.isArray(ai_assessment.packaging_condition_observations) && ai_assessment.packaging_condition_observations.length > 0 && (
                      <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        {ai_assessment.packaging_condition_observations.map((obs, i) => (
                          <li key={i}>{obs}</li>
                        ))}
                      </ul>
                    )}

                    {Array.isArray(ai_assessment.missing_information) && ai_assessment.missing_information.length > 0 && (
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        <strong style={{ color: 'var(--color-ink)', fontWeight: 600 }}>Missing info to verify:</strong>{' '}
                        {ai_assessment.missing_information.join(' · ')}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)', paddingTop: '8px', lineHeight: 1.45 }}>
                  {ai_assessment.safety_disclaimer || ai_assessment.disclaimer || 'AI image assessment observes visible characteristics only. It does NOT certify food safety or detect pathogens, toxins, or internal spoilage.'}
                </div>
              </div>
            );
          })() : (
            <div style={{
              padding: '16px',
              borderRadius: 'var(--radius-lg)',
              border: '1px dashed var(--color-border-strong)',
              backgroundColor: '#FFFFFF',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px'
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-accent-subtle)',
                color: 'var(--color-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <ScanEye size={18} strokeWidth={1.65} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-ink)', marginBottom: '2px' }}>
                  Manual volunteer review
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                  No AI assessment payload was attached at registration. Standard human inspection is required before dispatch.
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
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--color-pastel-green-ink)', fontWeight: 600, fontSize: '14px' }}>
              <CheckCircle2 size={16} strokeWidth={1.75} />
              <span>Rescue completed</span>
            </div>
          ) : isAccepted && onCollect ? (
            <button
              type="button"
              className="btn btn-pastel"
              onClick={() => {
                onCollect(id);
                onClose();
              }}
            >
              Mark collected
            </button>
          ) : !isAccepted && onAccept ? (
            <button
              type="button"
              className="btn btn-orange"
              onClick={() => {
                onAccept(id);
                onClose();
              }}
            >
              Accept donation
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default DonationDetailModal;
