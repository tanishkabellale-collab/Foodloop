import React from 'react';

const CATEGORY_MAP = {
  cooked_meals: { label: 'Cooked Meals', icon: '🍲' },
  fresh_produce: { label: 'Fresh Produce', icon: '🍎' },
  bakery: { label: 'Bakery Goods', icon: '🍞' },
  packaged_sealed: { label: 'Packaged / Sealed', icon: '📦' }
};

const CategoryPill = ({ category }) => {
  if (!category) return null;
  const item = CATEGORY_MAP[category] || { label: category, icon: '🍽️' };

  return (
    <span className="category-pill">
      <span>{item.icon}</span>
      <span>{item.label}</span>
    </span>
  );
};

export default CategoryPill;

