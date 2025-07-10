// src/components/FlagToggle.tsx
'use client';

import { useState, useEffect } from 'react';

export default function FlagToggle() {
  const [openA, setOpenA] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load initial state from localStorage
    const savedState = localStorage.getItem('openA');
    if (savedState) {
      setOpenA(savedState === 'true');
    }
    setLoading(false);
  }, []);

  const toggleFlag = () => {
    const newState = !openA;
    setOpenA(newState);
    localStorage.setItem('openA', String(newState));
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flag-toggle">
      <h3>Admin Flag Control</h3>
      <p>Current state: {openA ? 'Open' : 'Closed'}</p>
      <button
        onClick={toggleFlag}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        {openA ? 'Close Flag' : 'Open Flag'}
      </button>
    </div>
  );
}