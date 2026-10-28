import { useState, useRef } from 'react';
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
  Sparkles 
} from 'lucide-react';

const API_URL = 'http://localhost:5000/api';

// Helper to get formatted local datetime string for input prefill (default +3 hours)
const getDefaultPickupTime = () => {
  const d = new Date(Date.now() + 3 * 60 * 60 * 1000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

const CATEGORIES = [
  { id: 'cooked_meals', label: 'Cooked Meals', icon: '🍲' },
  { id: 'fresh_produce', label: 'Fresh Produce', icon: '🍎' },
  { id: 'bakery', label: 'Bakery', icon: '🍞' },
  { id: 'packaged_sealed', label: 'Packaged / Sealed', icon: '📦' }
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
  { id: 'servings', label: 'Servings' },
  { id: 'plates', label: 'Plates' },
  { id: 'trays', label: 'Trays' },
  { id: 'boxes', label: 'Boxes' }
];

const PACKAGING_TYPES = [
  { id: 'sealed_covered', label: 'Sealed / Covered' },
  { id: 'open_loose', label: 'Open / Loose' }
];

const DonorForm = () => {
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

  const fileInputRef = useRef(null);

  const handleTextChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errorMsg) setErrorMsg('');
  };

  const handleChipSelect = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errorMsg) setErrorMsg('');
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.match(/^image\/(jpeg|png|webp|jpg)$/i)) {
      setErrorMsg('Please select a valid image file (JPG, PNG, or WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image size exceeds 5 MB. Please select a smaller photo.');
      return;
    }

    setErrorMsg('');
    setPhotoFile(file);
    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
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
      return 'Please provide a Food Title or short description.';
    }
    if (!formData.food_category) {
      return 'Please select a Food Category.';
    }
    if (!formData.dietary_type) {
      return 'Please choose Dietary Type (Vegetarian or Non-Vegetarian).';
    }
    const qNum = parseFloat(formData.quantity);
    if (isNaN(qNum) || qNum <= 0) {
      return 'Quantity must be a positive number greater than 0.';
    }
    if (!formData.quantity_unit) {
      return 'Please select a Quantity Unit (servings, plates, trays, or boxes).';
    }
    if (!photoFile) {
      return 'A clear food photograph is required for new donations.';
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

    // Category-specific conditionals
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
        return 'Expiry / Best Before Date is required for Packaged / Sealed food.';
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

      await axios.post(`${API_URL}/donations`, data, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
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

      setTimeout(() => setSuccess(false), 5000);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Failed to submit donation', err);
      const serverMsg = err.response?.data?.error || 'Failed to submit donation. Please try again.';
      setErrorMsg(serverMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto" style={{ maxWidth: '42rem' }}>
      <div className="glass glass-card">
        <div className="flex items-center justify-between mb-6 pb-3" style={{ borderBottom: '1px solid var(--border-color)' }}>
          <h2 className="flex items-center gap-2 mb-0" style={{ marginBottom: 0, fontSize: '1.4rem' }}>
            <Package className="logo-icon" size={24} />
            Register Surplus Food Donation
          </h2>
          <span className="badge badge-available" style={{ fontSize: '0.7rem' }}>V1.0 Intake</span>
        </div>

        {/* Success Alert */}
        {success && (
          <div className="mb-6 p-4 rounded-lg flex items-center gap-3 animate-fade-in" 
               style={{ background: 'rgba(34, 197, 94, 0.12)', color: 'var(--success)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
            <CheckCircle size={22} />
            <div>
              <div style={{ fontWeight: 600 }}>Donation Registered Successfully!</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Your surplus listing and photograph have been received for rescue coordination.
              </div>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-6 p-4 rounded-lg flex items-center gap-3 animate-fade-in" 
               style={{ background: 'rgba(239, 68, 68, 0.12)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <AlertCircle size={22} />
            <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{errorMsg}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>

          {/* 1. Food Category (Required) */}
          <div className="form-group mb-6">
            <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-main)' }}>
              1. Food Category <span style={{ color: 'var(--primary)' }}>*</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
              {CATEGORIES.map(cat => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => handleChipSelect('food_category', cat.id)}
                  className={`btn btn-outline ${formData.food_category === cat.id ? 'active' : ''}`}
                  style={{
                    padding: '0.6rem 0.8rem',
                    fontSize: '0.9rem',
                    justifyContent: 'flex-start',
                    gap: '0.5rem'
                  }}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Food Title (Required) */}
          <div className="form-group mb-6">
            <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-main)' }}>
              2. Food Title / Short Description <span style={{ color: 'var(--primary)' }}>*</span>
            </label>
            <input 
              type="text" 
              name="title"
              value={formData.title}
              onChange={handleTextChange}
              placeholder="e.g. Steamed Rice & Dal Makhani, Mixed Bakery Sandwiches"
              className="form-input"
              required 
            />
          </div>

          {/* 3. Dietary Type (Required) */}
          <div className="form-group mb-6">
            <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-main)' }}>
              3. Dietary Type <span style={{ color: 'var(--primary)' }}>*</span>
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleChipSelect('dietary_type', 'vegetarian')}
                className={`btn btn-outline flex-1 ${formData.dietary_type === 'vegetarian' ? 'active' : ''}`}
                style={{ padding: '0.6rem 1rem', fontSize: '0.9rem' }}
              >
                <span>🟢</span>
                <span>Vegetarian</span>
              </button>
              <button
                type="button"
                onClick={() => handleChipSelect('dietary_type', 'non_vegetarian')}
                className={`btn btn-outline flex-1 ${formData.dietary_type === 'non_vegetarian' ? 'active' : ''}`}
                style={{ padding: '0.6rem 1rem', fontSize: '0.9rem' }}
              >
                <span>🔴</span>
                <span>Non-Vegetarian</span>
              </button>
            </div>
          </div>

          {/* 4. Quantity & Unit (Required) */}
          <div className="form-group mb-6">
            <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-main)' }}>
              4. Quantity & Unit <span style={{ color: 'var(--primary)' }}>*</span>
            </label>
            <div className="flex gap-2">
              <input 
                type="number" 
                name="quantity"
                value={formData.quantity}
                onChange={handleTextChange}
                min="0.5"
                step="any"
                placeholder="Amount"
                className="form-input"
                style={{ width: '45%' }}
                required 
              />
              <select
                name="quantity_unit"
                value={formData.quantity_unit}
                onChange={handleTextChange}
                className="form-input"
                style={{ width: '55%', background: 'rgba(15, 23, 42, 0.8)' }}
              >
                {QUANTITY_UNITS.map(u => (
                  <option key={u.id} value={u.id}>{u.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 5. Food Photograph (Required for new donations) */}
          <div className="form-group mb-6">
            <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-main)' }}>
              5. Food Photograph <span style={{ color: 'var(--primary)' }}>*</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                (One clear photo for condition assessment)
              </span>
            </label>

            {!photoPreview ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--border-color)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: 'rgba(15, 23, 42, 0.4)',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
              >
                <div className="flex justify-center mb-2">
                  <Camera size={32} style={{ color: 'var(--primary)' }} />
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                  Click or tap to snap / upload photo
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  JPEG, PNG, or WebP up to 5 MB
                </div>
              </div>
            ) : (
              <div style={{
                position: 'relative',
                borderRadius: '12px',
                overflow: 'hidden',
                border: '1px solid var(--border-color)',
                maxHeight: '220px',
                background: '#000'
              }}>
                <img 
                  src={photoPreview} 
                  alt="Donation preview" 
                  style={{ width: '100%', height: '220px', objectFit: 'contain' }} 
                />
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    background: 'rgba(239, 68, 68, 0.85)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.5)'
                  }}
                  title="Remove Photo"
                >
                  <X size={18} />
                </button>
              </div>
            )}

            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handlePhotoSelect}
              accept="image/jpeg,image/png,image/webp,image/jpg"
              style={{ display: 'none' }} 
            />
          </div>

          {/* CONDITIONAL SECTION: Cooked Meals */}
          {formData.food_category === 'cooked_meals' && (
            <div className="p-4 rounded-lg mb-6 animate-fade-in" style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <div className="flex items-center gap-2 mb-3" style={{ color: 'var(--secondary)', fontWeight: 600, fontSize: '0.95rem' }}>
                <Clock size={18} />
                <span>Cooked Meals Context</span>
              </div>

              {/* Preparation Time */}
              <div className="form-group mb-4">
                <label className="form-label" style={{ fontSize: '0.85rem' }}>
                  Preparation Time <span style={{ color: 'var(--primary)' }}>*</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem' }}>
                  {PREPARATION_TIMES.map(pt => (
                    <button
                      type="button"
                      key={pt.id}
                      onClick={() => handleChipSelect('preparation_time', pt.id)}
                      className={`btn btn-outline ${formData.preparation_time === pt.id ? 'active' : ''}`}
                      style={{ padding: '0.45rem 0.6rem', fontSize: '0.8rem', justifyContent: 'center' }}
                    >
                      {pt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Current Storage */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.85rem' }}>
                  Current Storage <span style={{ color: 'var(--primary)' }}>*</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
                  {STORAGE_CONDITIONS.map(sc => (
                    <button
                      type="button"
                      key={sc.id}
                      onClick={() => handleChipSelect('current_storage', sc.id)}
                      className={`btn btn-outline ${formData.current_storage === sc.id ? 'active' : ''}`}
                      style={{ padding: '0.45rem 0.6rem', fontSize: '0.8rem', justifyContent: 'center' }}
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* CONDITIONAL SECTION: Packaged / Sealed */}
          {formData.food_category === 'packaged_sealed' && (
            <div className="p-4 rounded-lg mb-6 animate-fade-in" style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <div className="flex items-center gap-2 mb-3" style={{ color: 'var(--secondary)', fontWeight: 600, fontSize: '0.95rem' }}>
                <Calendar size={18} />
                <span>Packaged Food Context</span>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.85rem' }}>
                  Expiry / Best Before Date <span style={{ color: 'var(--primary)' }}>*</span>
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

          {/* 6. Pickup Available Until (Required) */}
          <div className="form-group mb-6">
            <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-main)' }}>
              6. Pickup Available Until <span style={{ color: 'var(--primary)' }}>*</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                (Latest time food can be collected)
              </span>
            </label>
            <input 
              type="datetime-local" 
              name="pickup_available_until"
              value={formData.pickup_available_until}
              onChange={handleTextChange}
              className="form-input"
              required 
            />
          </div>

          {/* 7. Pickup Address / Location (Required) */}
          <div className="form-group mb-6">
            <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-main)' }}>
              7. Pickup Address / Location <span style={{ color: 'var(--primary)' }}>*</span>
            </label>
            <input 
              type="text" 
              name="address_text"
              value={formData.address_text}
              onChange={handleTextChange}
              placeholder="e.g. Canteen 2, JSPM RSCOE Campus, Tathwade, Pune"
              className="form-input"
              required 
            />
          </div>

          {/* RECOMMENDED: Packaging Type */}
          <div className="form-group mb-6">
            <label className="form-label" style={{ fontSize: '0.85rem' }}>
              Packaging Type <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Recommended)</span>
            </label>
            <div className="flex gap-2">
              {PACKAGING_TYPES.map(pt => (
                <button
                  type="button"
                  key={pt.id}
                  onClick={() => handleChipSelect('packaging_type', pt.id)}
                  className={`btn btn-outline flex-1 ${formData.packaging_type === pt.id ? 'active' : ''}`}
                  style={{ padding: '0.5rem', fontSize: '0.85rem' }}
                >
                  {pt.label}
                </button>
              ))}
            </div>
          </div>

          {/* OPTIONAL: Allergens & Special Note */}
          <div className="form-group mb-4">
            <label className="form-label" style={{ fontSize: '0.85rem' }}>
              Major Allergens <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Optional)</span>
            </label>
            <input 
              type="text" 
              name="allergens"
              value={formData.allergens}
              onChange={handleTextChange}
              placeholder="e.g. Contains dairy, peanuts, gluten (leave blank if none)"
              className="form-input"
            />
          </div>

          <div className="form-group mb-6">
            <label className="form-label" style={{ fontSize: '0.85rem' }}>
              Special Pickup Note <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Optional)</span>
            </label>
            <input 
              type="text" 
              name="special_note"
              value={formData.special_note}
              onChange={handleTextChange}
              placeholder="e.g. Call loading dock bell upon arrival"
              className="form-input"
            />
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            className="btn btn-primary w-full mt-4"
            disabled={loading}
            style={{ padding: '0.85rem 1.5rem', fontSize: '1.05rem' }}
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="spinner"></div>
                <span>Submitting Donation & Photo...</span>
              </div>
            ) : (
              'Submit Donation'
            )}
          </button>

          <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Information collected for food rescue coordination. Structured details and photograph will assist volunteer matching.
          </div>

        </form>
      </div>
    </div>
  );
};

export default DonorForm;
