import React from 'react';
import { Utensils, Apple, Wheat, Package } from 'lucide-react';

const CATEGORY_THEMES = {
  cooked_meals: {
    bg: '#EBE5D8',
    fg: '#12352A',
    icon: Utensils,
    title: 'Cooked Surplus'
  },
  fresh_produce: {
    bg: '#EDF4EB',
    fg: '#2F6126',
    icon: Apple,
    title: 'Fresh Produce'
  },
  bakery: {
    bg: '#FEF7E8',
    fg: '#92660B',
    icon: Wheat,
    title: 'Artisanal Bakery'
  },
  packaged_sealed: {
    bg: '#F1ECE1',
    fg: '#1C1917',
    icon: Package,
    title: 'Packaged Goods'
  }
};

const PlaceholderImage = ({ category = 'cooked_meals', title = 'Surplus Food', height = '200px' }) => {
  const theme = CATEGORY_THEMES[category] || CATEGORY_THEMES.cooked_meals;
  const Icon = theme.icon;

  return (
    <div style={{
      width: '100%',
      height,
      backgroundColor: theme.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
      color: theme.fg,
      padding: '1rem',
      textAlign: 'center',
      userSelect: 'none'
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        backgroundColor: 'rgba(255, 255, 255, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
      }}>
        <Icon size={24} />
      </div>
      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: theme.fg }}>
        {title || theme.title}
      </div>
      <div style={{ fontSize: '0.75rem', opacity: 0.75, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        FoodLoop Surplus Verification
      </div>
    </div>
  );
};

export default PlaceholderImage;

