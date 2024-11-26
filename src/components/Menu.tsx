import { useState } from 'react';

export function Menu() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const menuItems = [
    { href: '/crypto-table', label: 'Select Coins' },
    { href: '/crypto-battle', label: 'Battle Arena' },
    { href: '/battle-history', label: 'Public History' },
    { href: '/private-history', label: 'Private History' },
    { href: '/my-wallet', label: 'My Wallet' },
    { href: '/settings', label: 'Settings' },
    { href: '/terms', label: 'Terms & Conditions' },
  ];

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
          {menuItems.map((item) => (
            <a key={item.href} href={item.href} className="menu-item">{item.label}</a>
          ))}
        </div>
      )}
    </div>
  );
} 