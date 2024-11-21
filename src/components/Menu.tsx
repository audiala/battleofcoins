import { useState } from 'react';

export function Menu() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="menu-container">
      <button 
        className="menu-button"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
      >
        ☰
      </button>
      {isMenuOpen && (
        <div className="menu-dropdown">
          <a href="/my-wallet" className="menu-item">My Wallet</a>
          <a href="/battle-history" className="menu-item">Battle History</a>
          <a href="/crypto-table" className="menu-item">Crypto Table</a>
          <a href="/crypto-battle" className="menu-item">Crypto Battle</a>
          <a href="/settings" className="menu-item">Settings</a>
        </div>
      )}
    </div>
  );
} 