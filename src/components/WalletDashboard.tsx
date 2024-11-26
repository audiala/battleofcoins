/** @jsxImportSource react */
import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import '../styles/wallet.css';

interface WalletInfo {
  address: string;
  balance: string;
  receivable: string;
  earned: string;
  transactions: Transaction[];
}

interface Transaction {
  type: 'send' | 'receive';
  amount: string;
  timestamp: string;
  account: string;
  hash: string;
}

export function WalletDashboard() {
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [isApiKeySet, setIsApiKeySet] = useState(false);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);

  const fetchTransactions = async (address: string) => {
    setIsLoadingTransactions(true);
    try {
      const response = await fetch('/api/nano-transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ address })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      return data.transactions;
    } catch (err) {
      console.error('Error fetching transactions:', err);
      return [];
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  const fetchWalletInfo = async (key: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/nano-balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ apiKey: key })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      const transactions = await fetchTransactions(data.address);

      setWalletInfo({
        address: data.address || '',
        balance: data.balance || '0',
        receivable: data.receivable || '0',
        earned: data.earned || '0',
        transactions
      });
      setIsApiKeySet(true);
      localStorage.setItem('nanoGptApiKey', key);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch wallet info');
      setIsApiKeySet(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Load saved API key on mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem('nanoGptApiKey');
    if (savedApiKey) {
      setApiKey(savedApiKey);
      fetchWalletInfo(savedApiKey);
    }
  }, []);

  const handleSetApiKey = () => {
    if (apiKey.trim()) {
      fetchWalletInfo(apiKey.trim());
    }
  };

  if (isLoading) return <div className="loading-spinner"></div>;

  if (!isApiKeySet) {
    return (
      <div className="wallet-dashboard">
        <h1 className="wallet-title">My Nano Wallet</h1>
        <div className="api-key-section">
          <h2>Enter your nano-gpt.com API Key</h2>
          <div className="api-key-form">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Your API Key"
              className="api-key-input"
            />
            <button 
              onClick={handleSetApiKey}
              className="api-key-button"
            >
              Connect Wallet
            </button>
          </div>
          {error && <div className="error-message">{error}</div>}
        </div>
      </div>
    );
  }

  if (!walletInfo) return <div className="error-message">No wallet data available</div>;

  return (
    <div className="wallet-dashboard">
      <h1 className="wallet-title">My Nano Wallet</h1>
      
      <div className="wallet-card2">
        <div className="wallet-balance2">
          <h2>Balance</h2>
          <p className="balance-amount2">Ӿ {parseFloat(walletInfo.balance.toString())}</p>
          <div className="balance-details">
            <p>Receivable: {parseFloat(walletInfo.receivable.toString())} NANO</p>
            <p>Earned: {parseFloat(walletInfo.earned.toString())} NANO</p>
          </div>
          <div className="buy-nano-section">
            <p className="buy-nano-text">Need more NANO?</p>
            <a 
              href="https://hub.nano.org/trading" 
              target="_blank" 
              rel="noopener noreferrer"
              className="buy-nano-link"
            >
              View exchanges and trading platforms →
            </a>
          </div>
        </div>

        <div className="wallet-address">
          <h2>Deposit Address</h2>
          <div className="qr-container">
            <QRCodeSVG 
              value={walletInfo.address}
              size={200}
              level="H"
              includeMargin={true}
              className="qr-code"
            />
          </div>
          <div className="address-container">
            <code className="address">{walletInfo.address}</code>
            <button 
              onClick={() => navigator.clipboard.writeText(walletInfo.address)}
              className="copy-button"
            >
              Copy
            </button>
          </div>
        </div>

        <div className="withdraw-info">
          <h2>Withdraw</h2>
          <p className="withdraw-description">
            To withdraw your NANO, please visit:
          </p>
          <a 
            href="https://nano-gpt.com/balance" 
            target="_blank" 
            rel="noopener noreferrer"
            className="withdraw-link"
          >
            nano-gpt.com/balance
            <span className="external-link-icon">↗</span>
          </a>
          <p className="withdraw-note">
            Log in with your API key to access withdrawal options
          </p>
        </div>
      </div>

      <div className="transactions-section">
        <h2>Recent Transactions</h2>
        {isLoadingTransactions ? (
          <div className="loading-spinner"></div>
        ) : (
          <div className="transactions-container">
            {walletInfo?.transactions.map((tx) => (
              <div 
                key={tx.hash} 
                className={`transaction-card ${tx.type}`}
              >
                <div className="transaction-type">
                  {tx.type === 'receive' ? '↓' : '↑'} {tx.type}
                </div>
                <div className="transaction-amount">
                  {tx.amount} NANO
                </div>
                <div className="transaction-account">
                  <span className="label">
                    {tx.type === 'receive' ? 'From:' : 'To:'}
                  </span>
                  <code className="account-address">{tx.account}</code>
                </div>
                <div className="transaction-time">
                  {new Date(tx.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
            {walletInfo?.transactions.length === 0 && (
              <div className="no-transactions">
                No transactions found
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 