import { useState } from 'react';
import { Leaf, Navigation, HandPlatter } from 'lucide-react';
import DonorForm from './components/DonorForm';
import NGODashboard from './components/NGODashboard';

function App() {
  const [activeTab, setActiveTab] = useState('donor');

  return (
    <div className="container">
      <header className="app-header animate-fade-in">
        <div className="flex justify-center">
          <Leaf size={48} className="logo-icon" />
        </div>
        <h1 className="gradient-text" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
          FoodLoop
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>Connecting surplus food with those in need.</p>
      </header>

      <div className="nav-tabs animate-fade-in">
        <button 
          className={`btn btn-outline ${activeTab === 'donor' ? 'active' : ''}`}
          onClick={() => setActiveTab('donor')}
        >
          <HandPlatter size={20} />
          Donor Portal
        </button>
        <button 
          className={`btn btn-outline ${activeTab === 'ngo' ? 'active' : ''}`}
          onClick={() => setActiveTab('ngo')}
        >
          <Navigation size={20} />
          NGO Dashboard
        </button>
      </div>

      <main className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
        {activeTab === 'donor' ? <DonorForm /> : <NGODashboard />}
      </main>
    </div>
  );
}

export default App;
