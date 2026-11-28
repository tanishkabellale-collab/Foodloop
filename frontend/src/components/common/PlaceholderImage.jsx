import React from 'react';
import { Utensils, Apple, Wheat, Package } from 'lucide-react';

const CATEGORY_THEMES = {
  cooked_meals: {
    bg: '#F2ECE0',
    fg: '#111110',
    Icon: Utensils,
    title: 'Cooked meals',
  },
  fresh_produce: {
    bg: '#EDF7EC',
    fg: '#183E1B',
    Icon: Apple,
    title: 'Fresh produce',
  },
  bakery: {
    bg: '#FDF0E6',
    fg: '#111110',
    Icon: Wheat,
    title: 'Bakery',
  },
  packaged_sealed: {
    bg: '#FAF6EE',
    fg: '#111110',
    Icon: Package,
    title: 'Packaged goods',
  },
};

const PlaceholderImage = ({ category = 'cooked_meals', title = 'Surplus food', height = '200px' }) => {
  const theme = CATEGORY_THEMES[category] || CATEGORY_THEMES.cooked_meals;
  const { Icon } = theme;

  return (
    <div
      style={{
        width: '100%',
        height,
        backgroundColor: theme.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        color: theme.fg,
        padding: '16px',
        textAlign: 'center',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '12px',
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={20} strokeWidth={1.65} />
      </div>
      <div style={{ fontWeight: 500, fontSize: '14px', color: theme.fg }}>
        {title || theme.title}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--color-text-subtle)' }}>
        No intake photo attached
      </div>
    </div>
  );
};

export default PlaceholderImage;
