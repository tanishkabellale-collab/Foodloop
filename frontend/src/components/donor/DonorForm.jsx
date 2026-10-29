import React, { useState, useRef } from 'react';
import axios from 'axios';
import { 
  Package, 
  CheckCircle, 
  AlertCircle, 
  Camera, 
  Upload, 
  X, 
  Clock, 
  Thermometer, 
  Calendar, 
  MapPin, 
  Scale, 
  Sparkles,
  Info,
  Check,
  AlertTriangle,
  HelpCircle
} from 'lucide-react';

const API_URL = 'http://localhost:5000/api';

// Helper to prefill pickup time (+3 hours default)
const getDefaultPickupTime = () => {
  const d = new Date(Date.now() + 3 * 60 * 60 * 1000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

const CATEGORIES = [
  { 
    id: 'cooked_meals', 
    label: 'Cooked Meals', 
    icon: '🍲', 
    desc: 'Prepared batches from catering, canteens, or kitchens' 
  },
  { 
    id: 'fresh_produce', 
    label: 'Fresh Produce', 
    icon: '🍎', 
    desc: 'Raw fruits, vegetables, and whole edible produce' 
  },
  { 
    id: 'bakery', 
    label: 'Bakery Goods', 
    icon: '🍞', 
    desc: 'Bread loaves, buns, pastries, and baked goods' 
  },
  { 
    id: 'packaged_sealed', 
    label: 'Packaged / Sealed', 
    icon: '📦', 
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
  { id: 'room_temperature', label: 'Room Temperature' },
  { id: 'refrigerated', label: 'Refrigerated' },
  { id: 'hot_insulated', label: 'Hot / Insulated' }
];

const QUANTITY_UNITS = [
  { id: 'servings', label: 'Servings (meals)' },
  { id: 'plates', label: 'Plates' },
  { id: 'trays', label: 'Catering Trays' },
  { id: 'boxes', label: 'Boxes / Cartons' }
];

const PACKAGING_TYPES = [
  { id: 'sealed_covered', label: 'Sealed / Covered' },
  { id: 'open_loose', label: 'Open / Loose Trays' }
];

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
    special_note: ''
  });

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // AI Visual Assessment State
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState('');

  const fileInputRef = useRef(null);

  const handleTextChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errorMsg) setErrorMsg('');
  };

  // Triggers non-blocking AI assessment
  const runAiAssessment = async (file, category) => {
    if (!file) return;

    if (category !== 'fresh_produce') {
      setAiLoading(false);
      setAiError('');
      setAiResult({
        assessment_status: 'requires_human_review',
        reason: 'model_not_validated_for_category',
        message: "AI visual assessment isn't validated for this food category."
      });
      return;
    }

    setAiLoading(true);
    setAiError('');
    setAiResult(null);

    try {
      const dataAi = new FormData();
      dataAi.append('image', file);
      dataAi.append('food_category', 'fresh_produce');

      const res = await axios.post(`${API_URL}/ai/assess-image`, dataAi, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 10000 // 10s timeout
      });

      setAiResult(res.data);
    } catch (err) {
      console.warn('[AI Assessment] Non-blocking visual assessment notice:', err.message);
      // Non-blocking fallback
      setAiError('AI assessment unavailable — donation can still be submitted and reviewed manually.');
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
      return 'Please enter a clear Food Title or description.';
    }
    if (!formData.food_category) {
      return 'Please select a Food Category.';
    }
    if (!formData.dietary_type) {
      return 'Please select Vegetarian or Non-Vegetarian dietary type.';
    }
    const qNum = parseFloat(formData.quantity);
    if (isNaN(qNum) || qNum <= 0) {
      return 'Quantity must be a positive number greater than 0.';
    }
    if (!formData.quantity_unit) {
      return 'Please select a Quantity Unit.';
    }
    if (!photoFile) {
      return 'A clear food photograph is required to register surplus.';
    }
    if (!formData.pickup_available_until) {
      return 'Please specify the Pickup Available Until datetime.';
    }
    const pickupDate = new Date(formData.pickup_available_until);
    if (isNaN(pickupDate.getTime()) || pickupDate.getTime() <= Date.now()) {
      return 'Pickup Available Until must be a future date and time.';
    }
    if (!formData.address_text.trim()) {
      return 'Please provide the Pickup Address / Location.';
    }

    // Category conditionals
    if (formData.food_category === 'cooked_meals') {
      if (!formData.preparation_time) {
        return 'Preparation Time is required for Cooked Meals.';
      }
      if (!formData.current_storage) {
        return 'Current Storage condition is required for Cooked Meals.';
      }
    }

    if (formData.food_category === 'packaged_sealed') {
      if (!formData.expiry_date.trim()) {
        return 'Expiry / Best Before Date is required for Packaged Food.';
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

      if (photoFile) {
        data.append('photo', photoFile);
      }

      // Attach AI visual assessment if completed
      if (aiResult && aiResult.assessment_status === 'completed') {
        data.append('ai_assessment', JSON.stringify({
          assessment_status: aiResult.assessment_status,
          visual_assessment_label: aiResult.visual_assessment_label,
          predicted_class: aiResult.predicted_class,
          confidence_score: aiResult.confidence_score,
          probability_fresh: aiResult.probability_fresh,
          probability_rotten: aiResult.probability_rotten,
          threshold_applied: aiResult.threshold_applied,
          model_version: aiResult.model_version,
          assessed_at: new Date().toISOString()
        }));
      }

      const res = await axios.post(`${API_URL}/donations`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setSuccess(true);
      handleRemovePhoto();
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
        special_note: ''
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
    <div style={{ maxWidth: '780px', margin: '0 auto' }}>
      {/* Title & Introduction */}
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.1rem', color: 'var(--color-primary)', marginBottom: '0.5rem' }}>
          Register Surplus Food
        </h1>
        <p style={{ fontSize: '1rem', color: 'var(--color-text-muted)', maxWidth: '580px', margin: '0 auto' }}>
          Provide structured operational parameters so receiving NGOs and food banks can safely coordinate timely pickup.
        </p>
      </div>

      {/* Success Notification */}
      {success && (
        <div className="card mb-6" style={{
          backgroundColor: 'var(--color-secondary-subtle)',
          borderColor: 'rgba(91, 140, 81, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <CheckCircle size={24} style={{ color: 'var(--color-secondary)', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
              Surplus Food Successfully Registered!
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              Your listing and food photograph are now live in the FoodLoop coordination network.
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {errorMsg && (
        <div className="card mb-6" style={{
          backgroundColor: 'var(--color-danger-subtle)',
          borderColor: 'rgba(217, 72, 59, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem'
        }}>
          <AlertCircle size={22} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
          <div style={{ fontWeight: 600, color: 'var(--color-danger)', fontSize: '0.9rem' }}>
            {errorMsg}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

        {/* SECTION 1: Food Category & Description */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ 
              width: '28px', 
              height: '28px', 
              borderRadius: '50%', 
              backgroundColor: 'var(--color-primary)', 
              color: '#FFFFFF', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontWeight: 700, 
              fontSize: '0.8rem' 
            }}>1</span>
            <h3 style={{ fontSize: '1.2rem', marginBottom: 0 }}>Food Category &amp; Description</h3>
          </div>

          {/* Category Cards */}
          <div className="form-group mb-6">
            <label className="form-label">
              Select Food Category <span style={{ color: 'var(--color-accent)' }}>*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CATEGORIES.map(cat => {
                const isSelected = formData.food_category === cat.id;
                return (
                  <div
                    key={cat.id}
                    onClick={() => handleSelect('food_category', cat.id)}
                    style={{
                      border: isSelected ? '2px solid var(--color-primary)' : '1.5px solid var(--color-border)',
                      backgroundColor: isSelected ? 'var(--color-bg-subtle)' : '#FFFFFF',
                      borderRadius: 'var(--radius-md)',
                      padding: '1rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '1.4rem' }}>{cat.icon}</span>
                      {isSelected && (
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'var(--color-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-primary)' }}>
                      {cat.label}
                    </div>
                    <div style={{ fontSize: '0.785rem', color: 'var(--color-text-muted)' }}>
                      {cat.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              Food Title / Menu Description <span style={{ color: 'var(--color-accent)' }}>*</span>
            </label>
            <input 
              type="text"
              name="title"
              value={formData.title}
              onChange={handleTextChange}
              placeholder="e.g. Fresh Red Apples, Mixed Veg Pulao &amp; Dal, Fresh Sandwich Loaves"
              className="form-input"
              required
            />
            <div className="form-helper">
              Provide a clear title describing the surplus food items.
            </div>
          </div>
        </div>

        {/* SECTION 2: Quantity & Dietary Profile */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ 
              width: '28px', 
              height: '28px', 
              borderRadius: '50%', 
              backgroundColor: 'var(--color-primary)', 
              color: '#FFFFFF', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontWeight: 700, 
              fontSize: '0.8rem' 
            }}>2</span>
            <h3 style={{ fontSize: '1.2rem', marginBottom: 0 }}>Quantity &amp; Dietary Designation</h3>
          </div>

          {/* Dietary Selection */}
          <div className="form-group mb-6">
            <label className="form-label">
              Dietary Designation <span style={{ color: 'var(--color-accent)' }}>*</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => handleSelect('dietary_type', 'vegetarian')}
                className={`btn btn-outline ${formData.dietary_type === 'vegetarian' ? 'btn-secondary' : ''}`}
                style={{
                  padding: '0.75rem',
                  fontSize: '0.95rem',
                  backgroundColor: formData.dietary_type === 'vegetarian' ? 'var(--color-primary)' : '#FFFFFF'
                }}
              >
                <span>🟢</span>
                <span>Vegetarian</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelect('dietary_type', 'non_vegetarian')}
                className={`btn btn-outline ${formData.dietary_type === 'non_vegetarian' ? 'btn-secondary' : ''}`}
                style={{
                  padding: '0.75rem',
                  fontSize: '0.95rem',
                  backgroundColor: formData.dietary_type === 'non_vegetarian' ? 'var(--color-primary)' : '#FFFFFF'
                }}
              >
                <span>🔴</span>
                <span>Non-Vegetarian</span>
              </button>
            </div>
          </div>

          {/* Quantity and Units */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">
                Numeric Quantity <span style={{ color: 'var(--color-accent)' }}>*</span>
              </label>
              <input 
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleTextChange}
                min="0.5"
                step="any"
                placeholder="25"
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Measurement Unit <span style={{ color: 'var(--color-accent)' }}>*</span>
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

          {/* Packaging Type */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              Packaging State <span style={{ fontSize: '0.785rem', color: 'var(--color-text-muted)' }}>(Recommended)</span>
            </label>
            <div className="flex gap-3">
              {PACKAGING_TYPES.map(pt => (
                <button
                  type="button"
                  key={pt.id}
                  onClick={() => handleSelect('packaging_type', pt.id)}
                  className={`btn btn-outline flex-1 ${formData.packaging_type === pt.id ? 'btn-secondary' : ''}`}
                  style={{
                    padding: '0.6rem',
                    fontSize: '0.85rem',
                    backgroundColor: formData.packaging_type === pt.id ? 'var(--color-primary)' : '#FFFFFF'
                  }}
                >
                  {pt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* SECTION 3: Timing & Context Conditionals */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ 
              width: '28px', 
              height: '28px', 
              borderRadius: '50%', 
              backgroundColor: 'var(--color-primary)', 
              color: '#FFFFFF', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontWeight: 700, 
              fontSize: '0.8rem' 
            }}>3</span>
            <h3 style={{ fontSize: '1.2rem', marginBottom: 0 }}>Timing &amp; Storage Conditions</h3>
          </div>

          {/* Cooked Conditionals */}
          {formData.food_category === 'cooked_meals' && (
            <div style={{
              backgroundColor: 'var(--color-bg-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              border: '1px solid var(--color-border)',
              marginBottom: '1.25rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: 'var(--color-primary)', fontSize: '0.925rem', marginBottom: '1rem' }}>
                <Clock size={16} />
                <span>Cooked Food Context</span>
              </div>

              {/* Prep time */}
              <div className="form-group mb-4">
                <label className="form-label" style={{ fontSize: '0.85rem' }}>
                  Preparation Time <span style={{ color: 'var(--color-accent)' }}>*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PREPARATION_TIMES.map(pt => (
                    <button
                      type="button"
                      key={pt.id}
                      onClick={() => handleSelect('preparation_time', pt.id)}
                      className={`btn btn-outline ${formData.preparation_time === pt.id ? 'btn-secondary' : ''}`}
                      style={{
                        padding: '0.5rem',
                        fontSize: '0.785rem',
                        backgroundColor: formData.preparation_time === pt.id ? 'var(--color-primary)' : '#FFFFFF'
                      }}
                    >
                      {pt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Storage condition */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.85rem' }}>
                  Current Storage State <span style={{ color: 'var(--color-accent)' }}>*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {STORAGE_CONDITIONS.map(sc => (
                    <button
                      type="button"
                      key={sc.id}
                      onClick={() => handleSelect('current_storage', sc.id)}
                      className={`btn btn-outline ${formData.current_storage === sc.id ? 'btn-secondary' : ''}`}
                      style={{
                        padding: '0.5rem',
                        fontSize: '0.785rem',
                        backgroundColor: formData.current_storage === sc.id ? 'var(--color-primary)' : '#FFFFFF'
                      }}
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Packaged Conditionals */}
          {formData.food_category === 'packaged_sealed' && (
            <div style={{
              backgroundColor: 'var(--color-bg-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              border: '1px solid var(--color-border)',
              marginBottom: '1.25rem'
            }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  Expiry / Best Before Date <span style={{ color: 'var(--color-accent)' }}>*</span>
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

          {/* Pickup Available Until */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              Pickup Available Until <span style={{ color: 'var(--color-accent)' }}>*</span>
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
              Latest time food can be collected before donor facility closes.
            </div>
          </div>
        </div>

        {/* SECTION 4: Food Photograph & AI Visual Assessment */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ 
              width: '28px', 
              height: '28px', 
              borderRadius: '50%', 
              backgroundColor: 'var(--color-primary)', 
              color: '#FFFFFF', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontWeight: 700, 
              fontSize: '0.8rem' 
            }}>4</span>
            <h3 style={{ fontSize: '1.2rem', marginBottom: 0 }}>Food Photograph &amp; Condition Screening</h3>
          </div>

          <label className="form-label">
            Clear Food Photo for Condition Screening <span style={{ color: 'var(--color-accent)' }}>*</span>
          </label>

          {!photoPreview ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '2.5rem 1.5rem',
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: 'var(--color-bg-base)',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--color-accent)'}
              onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
            >
              <div style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                backgroundColor: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
                color: 'var(--color-accent)',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <Camera size={26} />
              </div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-primary)', marginBottom: '0.25rem' }}>
                Click or tap to upload food photo
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                JPEG, PNG, or WebP up to 5 MB (One clear photo)
              </div>
            </div>
          ) : (
            <div>
              <div style={{
                position: 'relative',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                border: '1px solid var(--color-border)',
                maxHeight: '260px',
                backgroundColor: '#000'
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
                    backgroundColor: 'rgba(217, 72, 59, 0.9)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '34px',
                    height: '34px',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                  }}
                  title="Remove photo"
                >
                  <X size={18} />
                </button>
              </div>

              {/* 1. AI Loading State */}
              {aiLoading && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '1rem 1.25rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg-subtle)',
                  border: '1px solid var(--color-border)',
                  marginTop: '1rem'
                }}>
                  <div className="spinner" style={{ width: '18px', height: '18px' }}></div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                    Analyzing image...
                  </div>
                </div>
              )}

              {/* 2. AI Assessment Completed (Fresh Produce) */}
              {aiResult && aiResult.assessment_status === 'completed' && (
                <div style={{
                  marginTop: '1rem',
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: aiResult.visual_assessment_label === 'visually_acceptable' ? 'var(--color-secondary-subtle)' : 'var(--color-danger-subtle)',
                  border: aiResult.visual_assessment_label === 'visually_acceptable' ? '1px solid rgba(91, 140, 81, 0.3)' : '1px solid rgba(217, 72, 59, 0.3)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-primary)' }}>
                      <Sparkles size={14} style={{ color: 'var(--color-accent)' }} />
                      <span>AI Visual Assessment</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                      Model: {aiResult.model_version}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontWeight: 800,
                      fontSize: '1.05rem',
                      color: aiResult.visual_assessment_label === 'visually_acceptable' ? '#2F6126' : '#A32A2A'
                    }}>
                      {aiResult.visual_assessment_label === 'visually_acceptable' ? (
                        <>
                          <CheckCircle size={18} />
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
                      {Math.round((aiResult.confidence_score || 0) * 100)}% confidence
                    </div>
                  </div>

                  {/* Probabilities Breakdown */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Fresh appearance:</span>
                      <span className="tabular-nums" style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                        {Math.round((aiResult.probability_fresh || 0) * 100)}%
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Visible deterioration:</span>
                      <span className="tabular-nums" style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                        {Math.round((aiResult.probability_rotten || 0) * 100)}%
                      </span>
                    </div>
                  </div>

                  {/* Disclaimer */}
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '0.65rem', lineHeight: 1.45 }}>
                    {aiResult.disclaimer || 'AI operational triage only. Does not certify food safety or detect pathogens, toxins, or internal spoilage.'}
                  </div>
                </div>
              )}

              {/* 3. Unsupported Category (Requires Human Review) */}
              {aiResult && aiResult.assessment_status === 'requires_human_review' && (
                <div style={{
                  marginTop: '1rem',
                  padding: '1rem 1.25rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg-subtle)',
                  border: '1px solid var(--color-border)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <HelpCircle size={16} style={{ color: 'var(--color-accent)' }} />
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-primary)' }}>
                      Requires human review
                    </span>
                  </div>
                  <div style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
                    AI visual assessment isn't validated for this food category. Cooked meals, bakery, and packaged foods undergo standard inspection.
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)', fontStyle: 'italic' }}>
                    AI operational triage only. Does not certify food safety.
                  </div>
                </div>
              )}

              {/* 4. AI Error Notice (Non-Blocking) */}
              {aiError && (
                <div style={{
                  marginTop: '1rem',
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-warning-subtle)',
                  border: '1px solid rgba(231, 165, 43, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem'
                }}>
                  <Info size={16} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
                  <div style={{ fontSize: '0.825rem', color: 'var(--color-text-main)' }}>
                    {aiError}
                  </div>
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
              gap: '0.5rem',
              marginTop: '0.75rem',
              fontSize: '0.8rem',
              color: 'var(--color-text-subtle)'
            }}>
              <Sparkles size={14} style={{ color: 'var(--color-accent)' }} />
              <span>Fresh produce photographs (apples, bananas, oranges) receive automated visual condition screening.</span>
            </div>
          )}
        </div>

        {/* SECTION 5: Pickup Location & Instructions */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ 
              width: '28px', 
              height: '28px', 
              borderRadius: '50%', 
              backgroundColor: 'var(--color-primary)', 
              color: '#FFFFFF', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontWeight: 700, 
              fontSize: '0.8rem' 
            }}>5</span>
            <h3 style={{ fontSize: '1.2rem', marginBottom: 0 }}>Pickup Logistics &amp; Instructions</h3>
          </div>

          {/* Address */}
          <div className="form-group mb-4">
            <label className="form-label">
              Pickup Address / Location <span style={{ color: 'var(--color-accent)' }}>*</span>
            </label>
            <input 
              type="text"
              name="address_text"
              value={formData.address_text}
              onChange={handleTextChange}
              placeholder="e.g. Canteen 2, Main Campus Gate 3, Tathwade, Pune"
              className="form-input"
              required
            />
          </div>

          {/* Allergens & Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                Major Allergens <span style={{ fontSize: '0.785rem', color: 'var(--color-text-muted)' }}>(Optional)</span>
              </label>
              <input 
                type="text"
                name="allergens"
                value={formData.allergens}
                onChange={handleTextChange}
                placeholder="e.g. Contains dairy, gluten, peanuts"
                className="form-input"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                Special Pickup Note <span style={{ fontSize: '0.785rem', color: 'var(--color-text-muted)' }}>(Optional)</span>
              </label>
              <input 
                type="text"
                name="special_note"
                value={formData.special_note}
                onChange={handleTextChange}
                placeholder="e.g. Use back loading bay; call donor on arrival"
                className="form-input"
              />
            </div>
          </div>
        </div>

        {/* SECTION 6: Review & Submit */}
        <div style={{ textAlign: 'center', paddingTop: '0.5rem' }}>
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={loading}
            style={{ 
              padding: '0.9rem 2.5rem', 
              fontSize: '1.05rem', 
              minWidth: '240px' 
            }}
          >
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div className="spinner" style={{ width: '18px', height: '18px', borderTopColor: '#FFFFFF' }}></div>
                <span>Submitting Surplus Listing...</span>
              </div>
            ) : (
              'Confirm & Register Surplus'
            )}
          </button>

          <div style={{ marginTop: '0.85rem', fontSize: '0.8rem', color: 'var(--color-text-subtle)' }}>
            Information is collected to coordinate surplus food pickup. Donors are covered under Good Samaritan food donation guidelines.
          </div>
        </div>

      </form>
    </div>
  );
};

export default DonorForm;
