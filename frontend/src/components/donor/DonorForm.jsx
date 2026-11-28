import React, { useState, useRef } from 'react';
import axios from 'axios';
import {
  Utensils,
  Apple,
  Wheat,
  Package,
  CheckCircle,
  AlertCircle,
  Camera,
  X,
  Clock,
  MapPin,
  ScanEye,
  Info,
  Check,
  AlertTriangle
} from 'lucide-react';
import { API_URL } from '../../config';

const getDefaultPickupTime = () => {
  const d = new Date(Date.now() + 3 * 60 * 60 * 1000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

const CATEGORIES = [
  {
    id: 'cooked_meals',
    label: 'Cooked meals',
    icon: Utensils,
    desc: 'Prepared batches from catering, canteens, or kitchens'
  },
  {
    id: 'fresh_produce',
    label: 'Fresh produce',
    icon: Apple,
    desc: 'Raw fruits, vegetables, and whole edible produce'
  },
  {
    id: 'bakery',
    label: 'Bakery goods',
    icon: Wheat,
    desc: 'Bread loaves, buns, pastries, and baked goods'
  },
  {
    id: 'packaged_sealed',
    label: 'Packaged / sealed',
    icon: Package,
    desc: 'Factory-sealed grocery packages with best-before dates'
  }
];

const PREPARATION_TIMES = [
  { id: 'less_than_1_hour_ago', label: 'Less than 1 hr ago' },
  { id: '1_to_2_hours_ago', label: '1–2 hours ago' },
  { id: '2_to_4_hours_ago', label: '2–4 hours ago' },
  { id: 'more_than_4_hours_ago', label: 'More than 4 hrs ago' }
];

const STORAGE_CONDITIONS = [
  { id: 'room_temperature', label: 'Room temperature' },
  { id: 'refrigerated', label: 'Refrigerated' },
  { id: 'hot_insulated', label: 'Hot / insulated' }
];

const QUANTITY_UNITS = [
  { id: 'servings', label: 'Servings (meals)' },
  { id: 'plates', label: 'Plates' },
  { id: 'trays', label: 'Catering trays' },
  { id: 'boxes', label: 'Boxes / cartons' }
];

const PACKAGING_TYPES = [
  { id: 'sealed_covered', label: 'Sealed / covered' },
  { id: 'open_loose', label: 'Open / loose trays' }
];

const SectionHeading = ({ step, title }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
    paddingBottom: '12px',
    borderBottom: '1px solid var(--color-border)'
  }}>
    <span style={{
      width: '24px',
      height: '24px',
      borderRadius: 'var(--radius-sm)',
      backgroundColor: 'var(--color-ink)',
      color: '#FFFFFF',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 600,
      fontSize: '12px'
    }} className="mono">{step}</span>
    <h3 style={{ fontSize: '16px', marginBottom: 0 }}>{title}</h3>
  </div>
);

const DonorForm = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    food_category: 'cooked_meals',
    title: '',
    dietary_type: 'vegetarian',
    quantity: '25',
    quantity_unit: 'servings',
    pickup_available_until: getDefaultPickupTime(),
    address_text: '',
    preparation_time: 'less_than_1_hour_ago',
    current_storage: 'room_temperature',
    expiry_date: '',
    packaging_type: 'sealed_covered',
    allergens: '',
    special_note: '',
    latitude: '',
    longitude: ''
  });

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [gpsStatus, setGpsStatus] = useState('');

  // AI Visual Assessment State
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState('');

  const fileInputRef = useRef(null);

  const handleCaptureGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus('Geolocation is not supported by this browser.');
      return;
    }
    setGpsStatus('Acquiring GPS coordinates...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData((prev) => ({
          ...prev,
          latitude: String(Math.round(pos.coords.latitude * 100000) / 100000),
          longitude: String(Math.round(pos.coords.longitude * 100000) / 100000),
        }));
        setGpsStatus('GPS coordinates captured for NGO distance matching.');
      },
      (err) => {
        setGpsStatus(`Unable to capture GPS (${err.message}). Address text will still work.`);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleTextChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errorMsg) setErrorMsg('');
  };

  // Triggers non-blocking AI visual assessment for any food category
  const runAiAssessment = async (file, category) => {
    if (!file) return;

    setAiLoading(true);
    setAiError('');
    setAiResult(null);

    try {
      const dataAi = new FormData();
      dataAi.append('image', file);
      dataAi.append('food_category', category || 'unspecified');

      const res = await axios.post(`${API_URL}/ai/assess-image`, dataAi, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 35000
      });

      setAiResult(res.data);
    } catch (err) {
      console.warn('[AI Assessment] Non-blocking visual assessment notice:', err.message);
      const serverErr = err.response?.data?.error;
      setAiError(serverErr || 'AI image assessment is temporarily unavailable — you can retry or still submit your donation.');
      setAiResult(null);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSelect = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errorMsg) setErrorMsg('');

    // Re-evaluate AI triage if category changed and photo already uploaded
    if (name === 'food_category' && photoFile) {
      runAiAssessment(photoFile, value);
    }
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.match(/^image\/(jpeg|png|webp|jpg)$/i)) {
      setErrorMsg('Please select a valid image file (JPG, PNG, or WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image size exceeds 5 MB limit. Please select a smaller photo.');
      return;
    }

    setErrorMsg('');
    setPhotoFile(file);
    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);

    // Auto-trigger visual assessment
    runAiAssessment(file, formData.food_category);
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setAiResult(null);
    setAiLoading(false);
    setAiError('');
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
      setPhotoPreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      return 'Please enter a clear food title or description.';
    }
    if (!formData.food_category) {
      return 'Please select a food category.';
    }
    if (!formData.dietary_type) {
      return 'Please select vegetarian or non-vegetarian dietary type.';
    }
    const qNum = parseFloat(formData.quantity);
    if (isNaN(qNum) || qNum <= 0) {
      return 'Quantity must be a positive number greater than 0.';
    }
    if (!formData.quantity_unit) {
      return 'Please select a quantity unit.';
    }
    if (!photoFile) {
      return 'A clear food photograph is required to register surplus.';
    }
    if (!formData.pickup_available_until) {
      return 'Please specify the pickup available until datetime.';
    }
    const pickupDate = new Date(formData.pickup_available_until);
    if (isNaN(pickupDate.getTime()) || pickupDate.getTime() <= Date.now()) {
      return 'Pickup available until must be a future date and time.';
    }
    if (!formData.address_text.trim()) {
      return 'Please provide the pickup address or location.';
    }

    if (formData.food_category === 'cooked_meals') {
      if (!formData.preparation_time) {
        return 'Preparation time is required for cooked meals.';
      }
      if (!formData.current_storage) {
        return 'Current storage condition is required for cooked meals.';
      }
    }

    if (formData.food_category === 'packaged_sealed') {
      if (!formData.expiry_date.trim()) {
        return 'Expiry / best-before date is required for packaged food.';
      }
    }

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const error = validateForm();
    if (error) {
      setErrorMsg(error);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const data = new FormData();
      data.append('title', formData.title.trim());
      data.append('food_category', formData.food_category);
      data.append('dietary_type', formData.dietary_type);
      data.append('quantity', formData.quantity);
      data.append('quantity_unit', formData.quantity_unit);
      data.append('pickup_available_until', formData.pickup_available_until);
      data.append('address_text', formData.address_text.trim());

      if (formData.food_category === 'cooked_meals') {
        data.append('preparation_time', formData.preparation_time);
        data.append('current_storage', formData.current_storage);
      }

      if (formData.food_category === 'packaged_sealed') {
        data.append('expiry_date', formData.expiry_date);
      }

      if (formData.packaging_type) {
        data.append('packaging_type', formData.packaging_type);
      }

      if (formData.allergens.trim()) {
        data.append('allergens', formData.allergens.trim());
      }

      if (formData.special_note.trim()) {
        data.append('special_note', formData.special_note.trim());
      }

      if (formData.latitude !== '' && formData.longitude !== '') {
        data.append('latitude', formData.latitude);
        data.append('longitude', formData.longitude);
      }

      if (photoFile) {
        data.append('photo', photoFile);
      }

      if (aiResult && aiResult.assessment_status === 'completed') {
        data.append('ai_assessment', JSON.stringify({
          assessment_status: aiResult.assessment_status,
          assessment_mode: aiResult.assessment_mode,
          is_demo_fallback: Boolean(aiResult.is_demo_fallback),
          suggested_food_category: aiResult.suggested_food_category,
          possible_food_description: aiResult.possible_food_description,
          packaging_condition_observations: aiResult.packaging_condition_observations || [],
          suggested_dietary_labels: aiResult.suggested_dietary_labels || [],
          missing_information: aiResult.missing_information || [],
          confidence_level: aiResult.confidence_level,
          confidence_score: aiResult.confidence_score,
          human_review_recommended: Boolean(aiResult.human_review_recommended),
          human_review_reason: aiResult.human_review_reason || null,
          onnx_produce_screening: aiResult.onnx_produce_screening || null,
          visual_assessment_label: aiResult.visual_assessment_label || null,
          predicted_class: aiResult.predicted_class ?? null,
          probability_fresh: aiResult.probability_fresh ?? null,
          probability_rotten: aiResult.probability_rotten ?? null,
          model_version: aiResult.model_version,
          assessed_at: new Date().toISOString()
        }));
      }

      const res = await axios.post(`${API_URL}/donations`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setSuccess(true);
      handleRemovePhoto();
      setGpsStatus('');
      setFormData({
        food_category: 'cooked_meals',
        title: '',
        dietary_type: 'vegetarian',
        quantity: '25',
        quantity_unit: 'servings',
        pickup_available_until: getDefaultPickupTime(),
        address_text: '',
        preparation_time: 'less_than_1_hour_ago',
        current_storage: 'room_temperature',
        expiry_date: '',
        packaging_type: 'sealed_covered',
        allergens: '',
        special_note: '',
        latitude: '',
        longitude: ''
      });

      if (onSuccess) {
        onSuccess(res.data);
      }

      setTimeout(() => setSuccess(false), 6000);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Failed to submit donation', err);
      const serverMsg = err.response?.data?.error || 'Failed to submit donation. Please verify inputs.';
      setErrorMsg(serverMsg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-enter" style={{ maxWidth: '780px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '22px', color: 'var(--color-ink)', marginBottom: '4px' }}>
          Register surplus food
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', maxWidth: '600px' }}>
          Enter structured operational parameters so receiving NGOs and couriers can coordinate pickup.
        </p>
      </div>

      {/* Success Notification */}
      {success && (
        <div className="card mb-6" style={{
          backgroundColor: 'var(--color-pastel-green-subtle)',
          borderColor: 'var(--color-pastel-green-strong)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px 20px'
        }}>
          <CheckCircle size={20} style={{ color: 'var(--color-pastel-green-ink)', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-pastel-green-ink)' }}>
              Surplus batch registered
            </div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
              Your listing and photograph are live in the coordination feed.
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {errorMsg && (
        <div className="card mb-6" style={{
          backgroundColor: 'var(--color-danger-subtle)',
          borderColor: 'rgba(194, 58, 43, 0.35)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px 20px'
        }}>
          <AlertCircle size={18} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
          <div style={{ fontWeight: 500, color: 'var(--color-danger)', fontSize: '14px' }}>
            {errorMsg}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* SECTION 1: Food Category & Description */}
        <div className="card">
          <SectionHeading step={1} title="Food category and description" />

          <div className="form-group mb-6">
            <label className="form-label">
              Category <span style={{ color: 'var(--color-accent)' }}>*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CATEGORIES.map(cat => {
                const isSelected = formData.food_category === cat.id;
                const IconComp = cat.icon;
                return (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => handleSelect('food_category', cat.id)}
                    style={{
                      border: isSelected ? '1.5px solid var(--color-ink)' : '1px solid var(--color-border)',
                      backgroundColor: isSelected ? 'var(--color-bg-subtle)' : '#FFFFFF',
                      borderRadius: 'var(--radius-md)',
                      padding: '16px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                      transition: 'border-color 150ms var(--ease-out), background-color 150ms var(--ease-out)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: isSelected ? 'var(--color-ink)' : 'var(--color-bg-base)',
                        color: isSelected ? '#FFFFFF' : 'var(--color-ink)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <IconComp size={16} strokeWidth={1.65} />
                      </div>
                      {isSelected && (
                        <div style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--color-pastel-green)',
                          color: 'var(--color-pastel-green-ink)',
                          border: '1px solid var(--color-pastel-green-strong)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Check size={12} strokeWidth={2.2} />
                        </div>
                      )}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-ink)' }}>
                      {cat.label}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                      {cat.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              Food title or menu description <span style={{ color: 'var(--color-accent)' }}>*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleTextChange}
              placeholder="e.g. Fresh red apples, mixed veg pulao and dal, sandwich loaves"
              className="form-input"
              required
            />
            <div className="form-helper">
              Provide a concise title describing the surplus batch.
            </div>
          </div>
        </div>

        {/* SECTION 2: Quantity & Dietary Profile */}
        <div className="card">
          <SectionHeading step={2} title="Quantity and dietary designation" />

          <div className="form-group mb-6">
            <label className="form-label">
              Dietary designation <span style={{ color: 'var(--color-accent)' }}>*</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              <button
                type="button"
                onClick={() => handleSelect('dietary_type', 'vegetarian')}
                className={`btn ${formData.dietary_type === 'vegetarian' ? 'btn-primary' : 'btn-outline'}`}
              >
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#5E9E59',
                  display: 'inline-block'
                }} />
                <span>Vegetarian</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelect('dietary_type', 'non_vegetarian')}
                className={`btn ${formData.dietary_type === 'non_vegetarian' ? 'btn-primary' : 'btn-outline'}`}
              >
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-accent)',
                  display: 'inline-block'
                }} />
                <span>Non-vegetarian</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">
                Numeric quantity <span style={{ color: 'var(--color-accent)' }}>*</span>
              </label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleTextChange}
                min="0.5"
                step="any"
                placeholder="25"
                className="form-input mono"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Measurement unit <span style={{ color: 'var(--color-accent)' }}>*</span>
              </label>
              <select
                name="quantity_unit"
                value={formData.quantity_unit}
                onChange={handleTextChange}
                className="form-select"
              >
                {QUANTITY_UNITS.map(u => (
                  <option key={u.id} value={u.id}>{u.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              Packaging state <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>(Recommended)</span>
            </label>
            <div className="flex gap-3">
              {PACKAGING_TYPES.map(pt => (
                <button
                  type="button"
                  key={pt.id}
                  onClick={() => handleSelect('packaging_type', pt.id)}
                  className={`btn btn-sm flex-1 ${formData.packaging_type === pt.id ? 'btn-primary' : 'btn-outline'}`}
                >
                  {pt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* SECTION 3: Timing & Context Conditionals */}
        <div className="card">
          <SectionHeading step={3} title="Timing and storage conditions" />

          {formData.food_category === 'cooked_meals' && (
            <div style={{
              backgroundColor: 'var(--color-bg-base)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              border: '1px solid var(--color-border)',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: 'var(--color-ink)', fontSize: '13px', marginBottom: '12px' }}>
                <Clock size={15} strokeWidth={1.65} />
                <span>Cooked food context</span>
              </div>

              <div className="form-group mb-4">
                <label className="form-label" style={{ fontSize: '13px' }}>
                  Preparation time <span style={{ color: 'var(--color-accent)' }}>*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PREPARATION_TIMES.map(pt => (
                    <button
                      type="button"
                      key={pt.id}
                      onClick={() => handleSelect('preparation_time', pt.id)}
                      className={`btn btn-sm ${formData.preparation_time === pt.id ? 'btn-primary' : 'btn-outline'}`}
                    >
                      {pt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '13px' }}>
                  Current storage state <span style={{ color: 'var(--color-accent)' }}>*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {STORAGE_CONDITIONS.map(sc => (
                    <button
                      type="button"
                      key={sc.id}
                      onClick={() => handleSelect('current_storage', sc.id)}
                      className={`btn btn-sm ${formData.current_storage === sc.id ? 'btn-primary' : 'btn-outline'}`}
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {formData.food_category === 'packaged_sealed' && (
            <div style={{
              backgroundColor: 'var(--color-bg-base)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              border: '1px solid var(--color-border)',
              marginBottom: '16px'
            }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  Expiry / best-before date <span style={{ color: 'var(--color-accent)' }}>*</span>
                </label>
                <input
                  type="date"
                  name="expiry_date"
                  value={formData.expiry_date}
                  onChange={handleTextChange}
                  className="form-input"
                  required
                />
              </div>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              Pickup available until <span style={{ color: 'var(--color-accent)' }}>*</span>
            </label>
            <input
              type="datetime-local"
              name="pickup_available_until"
              value={formData.pickup_available_until}
              onChange={handleTextChange}
              className="form-input"
              required
            />
            <div className="form-helper">
              Latest cutoff time before donor facility closes.
            </div>
          </div>
        </div>

        {/* SECTION 4: Food Photograph & AI Visual Assessment */}
        <div className="card">
          <SectionHeading step={4} title="Food photograph and condition screening" />

          <label className="form-label">
            Food photograph <span style={{ color: 'var(--color-accent)' }}>*</span>
          </label>

          {!photoPreview ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '100%',
                border: '1.5px dashed var(--color-border-strong)',
                borderRadius: 'var(--radius-lg)',
                padding: '32px 24px',
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: 'var(--color-bg-base)',
                fontFamily: 'inherit',
                transition: 'border-color 150ms var(--ease-out)'
              }}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)'; }}
              onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--color-border-strong)'; }}
            >
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
                color: 'var(--color-accent)'
              }}>
                <Camera size={20} strokeWidth={1.65} />
              </div>
              <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-ink)', marginBottom: '4px' }}>
                Select or capture food photograph
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                JPEG, PNG, or WebP up to 5 MB
              </div>
            </button>
          ) : (
            <div>
              <div style={{
                position: 'relative',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                border: '1px solid var(--color-border)',
                maxHeight: '260px',
                backgroundColor: 'var(--color-ink)'
              }}>
                <img
                  src={photoPreview}
                  alt="Donation preview"
                  style={{ width: '100%', height: '260px', objectFit: 'contain' }}
                />
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    backgroundColor: 'var(--color-ink)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                  aria-label="Remove photo"
                  title="Remove photo"
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }} className="mono">
                  {photoFile?.name} ({photoFile ? Math.max(1, Math.round(photoFile.size / 1024)) : 0} KB)
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={aiLoading}
                  onClick={() => runAiAssessment(photoFile, formData.food_category)}
                >
                  <ScanEye size={14} strokeWidth={1.65} />
                  <span>{aiLoading ? 'Analyzing...' : aiResult ? 'Re-analyze photo' : 'Analyze photo'}</span>
                </button>
              </div>

              {aiLoading && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg-base)',
                  border: '1px solid var(--color-border)',
                  marginTop: '12px'
                }}>
                  <div className="spinner" style={{ width: '16px', height: '16px' }} />
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-ink)' }}>
                    Analyzing visible image characteristics...
                  </div>
                </div>
              )}

              {aiResult && aiResult.assessment_status === 'completed' && (
                <div style={{
                  marginTop: '12px',
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: aiResult.is_demo_fallback ? 'var(--color-bg-base)' : 'var(--color-pastel-green-subtle)',
                  border: aiResult.is_demo_fallback ? '1px solid var(--color-border-strong)' : '1px solid var(--color-pastel-green-strong)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--color-ink)' }}>
                        <ScanEye size={15} strokeWidth={1.65} style={{ color: 'var(--color-accent)' }} />
                        <span>Visual screening result</span>
                      </span>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: 500,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-pill)',
                        backgroundColor: aiResult.is_demo_fallback ? 'var(--color-warning-subtle)' : 'var(--color-pastel-green)',
                        color: aiResult.is_demo_fallback ? 'var(--color-warning-ink)' : 'var(--color-pastel-green-ink)',
                        border: aiResult.is_demo_fallback ? '1px solid rgba(217, 138, 26, 0.35)' : '1px solid var(--color-pastel-green-strong)'
                      }}>
                        {aiResult.is_demo_fallback
                          ? 'Fallback mode (no API key)'
                          : aiResult.assessment_mode === 'local_onnx_produce'
                          ? `Produce ONNX (${aiResult.model_version})`
                          : aiResult.assessment_mode?.startsWith('hybrid_')
                          ? `Hybrid AI (${aiResult.model_version})`
                          : aiResult.assessment_mode === 'groq_vision_ai'
                          ? `Groq Vision (${aiResult.model_version})`
                          : `Live Vision (${aiResult.model_version})`}
                      </span>
                    </div>

                    <span className="mono" style={{
                      fontSize: '12px',
                      fontWeight: 500,
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-ink)',
                      textTransform: 'capitalize'
                    }}>
                      Confidence: {aiResult.confidence_level || 'low'}
                      {typeof aiResult.confidence_score === 'number' ? ` (${Math.round(aiResult.confidence_score * 100)}%)` : ''}
                    </span>
                  </div>

                  {aiResult.onnx_produce_screening && (
                    <div style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid var(--color-border)',
                      marginBottom: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '8px',
                      fontSize: '13px'
                    }}>
                      <span>
                        <strong style={{ color: 'var(--color-ink)', fontWeight: 600 }}>On-device produce screening:</strong>{' '}
                        <span style={{
                          fontWeight: 600,
                          color: aiResult.onnx_produce_screening.visual_assessment_label === 'visually_acceptable'
                            ? 'var(--color-pastel-green-ink)'
                            : 'var(--color-danger)',
                          textTransform: 'capitalize'
                        }}>
                          {(aiResult.onnx_produce_screening.visual_assessment_label || '').replace(/_/g, ' ')}
                        </span>
                      </span>
                      <span className="mono" style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        Fresh {Math.round((aiResult.onnx_produce_screening.probability_fresh || 0) * 100)}% · Deterioration {Math.round((aiResult.onnx_produce_screening.probability_rotten || 0) * 100)}%
                      </span>
                    </div>
                  )}

                  {aiResult.human_review_recommended && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--color-accent-subtle)',
                      border: '1px solid rgba(234, 93, 26, 0.3)',
                      marginBottom: '12px',
                      fontSize: '13px',
                      color: 'var(--color-ink)'
                    }}>
                      <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--color-accent-ink)' }} />
                      <div>
                        <strong style={{ fontWeight: 600 }}>Human review recommended:</strong>{' '}
                        {aiResult.human_review_reason || 'Manual verification is required before dispatch.'}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--color-ink)' }}>
                      <strong style={{ fontWeight: 600 }}>Suggested category:</strong>{' '}
                      <span style={{ textTransform: 'capitalize' }}>
                        {(aiResult.suggested_food_category || 'uncertain').replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--color-ink)', lineHeight: 1.45 }}>
                      <strong style={{ fontWeight: 600 }}>Visible description:</strong>{' '}
                      {aiResult.possible_food_description}
                    </div>
                  </div>

                  {Array.isArray(aiResult.packaging_condition_observations) && aiResult.packaging_condition_observations.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-ink)', marginBottom: '4px' }}>
                        Condition observations:
                      </div>
                      <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '13px', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {aiResult.packaging_condition_observations.map((obs, idx) => (
                          <li key={idx}>{obs}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {Array.isArray(aiResult.suggested_dietary_labels) && aiResult.suggested_dietary_labels.length > 0 && (
                    <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-ink)' }}>
                        Dietary hints:
                      </span>
                      {aiResult.suggested_dietary_labels.map((lbl, idx) => (
                        <span key={idx} style={{
                          fontSize: '12px',
                          fontWeight: 500,
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-pill)',
                          backgroundColor: '#FFFFFF',
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-ink)'
                        }}>
                          {lbl}
                        </span>
                      ))}
                    </div>
                  )}

                  {Array.isArray(aiResult.missing_information) && aiResult.missing_information.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-ink)', marginBottom: '4px' }}>
                        Details to confirm:
                      </div>
                      <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '13px', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {aiResult.missing_information.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)', paddingTop: '8px', lineHeight: 1.45 }}>
                    {aiResult.safety_disclaimer || aiResult.disclaimer}
                  </div>
                </div>
              )}

              {aiError && (
                <div style={{
                  marginTop: '12px',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-accent-subtle)',
                  border: '1px solid rgba(234, 93, 26, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px' }}>
                    <AlertCircle size={16} style={{ color: 'var(--color-accent-ink)', flexShrink: 0 }} />
                    <div style={{ fontSize: '13px', color: 'var(--color-ink)' }}>
                      {aiError}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => runAiAssessment(photoFile, formData.food_category)}
                  >
                    Retry analysis
                  </button>
                </div>
              )}
            </div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            onChange={handlePhotoSelect}
            accept="image/jpeg,image/png,image/webp,image/jpg"
            style={{ display: 'none' }}
          />

          {!photoPreview && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '12px',
              fontSize: '12px',
              color: 'var(--color-text-subtle)'
            }}>
              <Info size={14} strokeWidth={1.65} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
              <span>Fresh produce photographs receive local ONNX screening; all categories receive visual screening when enabled.</span>
            </div>
          )}
        </div>

        {/* SECTION 5: Pickup Location & Instructions */}
        <div className="card">
          <SectionHeading step={5} title="Pickup logistics and coordinates" />

          <div className="form-group mb-4">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>
                Pickup address / location <span style={{ color: 'var(--color-accent)' }}>*</span>
              </label>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleCaptureGps}
              >
                <MapPin size={13} strokeWidth={1.65} />
                <span>Use current GPS</span>
              </button>
            </div>
            <input
              type="text"
              name="address_text"
              value={formData.address_text}
              onChange={handleTextChange}
              placeholder="e.g. Canteen 2, Main Campus Gate 3, Tathwade, Pune"
              className="form-input"
              required
            />
            {gpsStatus && (
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                {gpsStatus}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                Latitude <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>(Optional)</span>
              </label>
              <input
                type="number"
                step="any"
                name="latitude"
                value={formData.latitude}
                onChange={handleTextChange}
                placeholder="e.g. 18.6208"
                className="form-input mono"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                Longitude <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>(Optional)</span>
              </label>
              <input
                type="number"
                step="any"
                name="longitude"
                value={formData.longitude}
                onChange={handleTextChange}
                placeholder="e.g. 73.7470"
                className="form-input mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                Major allergens <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>(Optional)</span>
              </label>
              <input
                type="text"
                name="allergens"
                value={formData.allergens}
                onChange={handleTextChange}
                placeholder="e.g. Dairy, gluten, peanuts"
                className="form-input"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                Special pickup note <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>(Optional)</span>
              </label>
              <input
                type="text"
                name="special_note"
                value={formData.special_note}
                onChange={handleTextChange}
                placeholder="e.g. Use back loading bay; call on arrival"
                className="form-input"
              />
            </div>
          </div>
        </div>

        {/* SECTION 6: Submit */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', paddingTop: '4px' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-subtle)', maxWidth: '460px' }}>
            Listings remain open to matched NGOs until the cutoff deadline and are covered under Good Samaritan food donation terms.
          </div>
          <button
            type="submit"
            className="btn btn-orange"
            disabled={loading}
            style={{ minHeight: '44px', padding: '12px 24px', fontSize: '15px' }}
          >
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="spinner" style={{ width: '16px', height: '16px', borderTopColor: '#FFFFFF' }} />
                <span>Submitting batch...</span>
              </div>
            ) : (
              'Confirm and register surplus'
            )}
          </button>
        </div>

      </form>
    </div>
  );
};

export default DonorForm;
