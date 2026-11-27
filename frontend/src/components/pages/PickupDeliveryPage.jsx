import React from 'react';
import { Truck, MapPin, Clock, Route, Radio, PackageCheck, ArrowRight, Sparkles } from 'lucide-react';

const PLANNED_FEATURES = [
  { icon: Route, title: 'Route Optimization', desc: 'Automated pickup route planning for minimum transit time and fuel consumption.' },
  { icon: Radio, title: 'Real-Time Tracking', desc: 'Live GPS tracking of volunteer drivers en route to donation pickup points.' },
  { icon: Clock, title: 'Scheduling Engine', desc: 'Smart scheduling to match volunteer availability with donor pickup windows.' },
  { icon: PackageCheck, title: 'Proof of Pickup', desc: 'Digital confirmation receipts with photo verification at collection points.' },
];

const PickupDeliveryPage = ({ onTabChange }) => (
  <div className="placeholder-page">
    <div className="placeholder-hero">
      <div className="placeholder-icon-ring">
        <Truck size={32} />
      </div>
      <div className="placeholder-badge">
        <Sparkles size={14} />
        <span>Coming Soon</span>
      </div>
      <h1 className="placeholder-title">Pickup & Delivery Coordination</h1>
      <p className="placeholder-desc">
        Logistics coordination to ensure rescued food reaches receiving organizations efficiently,
        safely, and within perishability windows. This module will connect donors, volunteer drivers,
        and NGOs into a seamless pickup workflow.
      </p>
      <button className="btn btn-primary" onClick={() => onTabChange('donations')}>
        <span>Browse Active Donations</span>
        <ArrowRight size={16} />
      </button>
    </div>

    <div className="placeholder-features-title">Planned Capabilities</div>
    <div className="placeholder-features-grid">
      {PLANNED_FEATURES.map(f => (
        <div key={f.title} className="placeholder-feature-card">
          <div className="placeholder-feature-icon">
            <f.icon size={22} />
          </div>
          <h4>{f.title}</h4>
          <p>{f.desc}</p>
        </div>
      ))}
    </div>

    <div className="placeholder-current-note">
      <MapPin size={16} />
      <span>Currently, donors provide pickup addresses and NGOs coordinate collection directly through the Donations directory.</span>
    </div>
  </div>
);

export default PickupDeliveryPage;

