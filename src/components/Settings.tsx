/** @jsxImportSource react */
import { useState, useEffect } from 'react';
import '../styles/settings.css';

export function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const savedApiKey = localStorage.getItem('nanoGptApiKey');
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }
    setIsLoading(false);
  }, []);

  const handleSave = async () => {
    try {
      // Validate API key by making a test request
      const response = await fetch('/api/nano-balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ apiKey })
      });

      if (!response.ok) {
        throw new Error('Invalid API key');
      }

      // If validation succeeds, save the API key
      localStorage.setItem('nanoGptApiKey', apiKey);
      setMessage({ text: 'API key saved successfully', type: 'success' });

      // Clear success message after 3 seconds
      setTimeout(() => {
        setMessage(null);
      }, 3000);
    } catch (err) {
      setMessage({ 
        text: err instanceof Error ? err.message : 'Failed to validate API key', 
        type: 'error' 
      });
    }
  };

  const handleClear = () => {
    localStorage.removeItem('nanoGptApiKey');
    setApiKey('');
    setMessage({ text: 'API key cleared', type: 'success' });
    setTimeout(() => {
      setMessage(null);
    }, 3000);
  };

  if (isLoading) {
    return <div className="loading-spinner"></div>;
  }

  return (
    <div className="settings-container">
      <h1 className="settings-title">Settings</h1>

      <div className="settings-card">
        <div className="settings-section">
          <h2>NanoGPT API Key</h2>
          <p className="settings-description">
            Enter your API key from{' '}
            <a 
              href="https://nano-gpt.com/api" 
              target="_blank" 
              rel="noopener noreferrer"
              className="settings-link"
            >
              nano-gpt.com/api
            </a>
          </p>
          
          <div className="api-key-form">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Your API Key"
              className="api-key-input"
            />
            <div className="button-group">
              <button 
                onClick={handleSave}
                className="save-button"
                disabled={!apiKey.trim()}
              >
                Save
              </button>
              <button 
                onClick={handleClear}
                className="clear-button"
                disabled={!apiKey.trim()}
              >
                Clear
              </button>
            </div>
          </div>

          {message && (
            <div className={`message ${message.type}`}>
              {message.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 