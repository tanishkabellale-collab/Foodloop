import React from 'react';
import { Utensils, Apple, Wheat, Package } from 'lucide-react';

const CATEGORY_MAP = {
  cooked_meals: { label: 'Cooked meals', Icon: Utensils },
  fresh_produce: { label: 'Fresh produce', Icon: Apple },
  bakery: { label: 'Bakery', Icon: Wheat },
  packaged_sealed: { label: 'Packaged', Icon: Package },
};

const CategoryPill = ({ category }) => {
  if (!category) return null;
  const item = CATEGORY_MAP[category] || { label: category.replace(/_/g, ' '), Icon: Package };
  const { Icon, label } = item;

  return (
    <span className="category-pill">
      <Icon size={13} strokeWidth={1.75} style={{ color: 'var(--color-text-muted)' }} />
      <span>{label}</span>
    </span>
  );
};

export default CategoryPill;
