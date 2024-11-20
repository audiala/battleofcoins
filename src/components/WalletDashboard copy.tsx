/** @jsxImportSource react */
import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import '../styles/wallet.css';

interface Transaction {
  type: 'send' | 'receive';
  amount: string;
  timestamp: string;
  account: string;
  hash: string;
}

interface WalletInfo {
  address: string;
  balance: string;
  transactions: Transaction[];
}

export function WalletDashboard() {
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  useEffect(() => {
    fetchWalletInfo();
  }, []);

  const fetchWalletInfo = async () => {
    try {
      setIsLoading(true);
      // For now, use mock data directly instead of fetching
      const mockData = {
        address: "nano_3rropjiqfxpmrrkooej4qtmm1pueu36f9ghinpho4esfdor8785a455d16nf",
        balance: "133.7",
        transactions: [
          {
            type: "receive" as const,
            amount: "10.0",
            timestamp: "2024-01-20T14:30:00Z",
            account: "nano_1ipx847tk8o46pwxt5qjdbncjqcbwcc1rrmqnkztrfjy5k7z4imsrata9est",
            hash: "ABC123"
          },
          {
            type: "send" as const,
            amount: "5.0",
            timestamp: "2024-01-19T10:15:00Z",
            account: "nano_3wm37qz19zhei7nzscjcopbrbnnachs4p1gnwo5oroi3qonw6inwgoeuufdp",
            hash: "DEF456"
          }
        ]
      };
      
      setWalletInfo(mockData);
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load wallet');
      setIsLoading(false);
    }
  };

  const handleWithdraw = async () => {
    setWithdrawError(null);
    
    // Basic validation
    if (!withdrawAddress.startsWith('nano_')) {
      setWithdrawError('Invalid Nano address');
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      setWithdrawError('Invalid amount');
      return;
    }

    if (walletInfo && amount > parseFloat(walletInfo.balance)) {
      setWithdrawError('Insufficient balance');
      return;
    }

    setIsWithdrawing(true);
    try {
      // Mock withdrawal for now
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Clear form after successful withdrawal
      setWithdrawAddress('');
      setWithdrawAmount('');
      
      // Update balance (in real implementation, fetch new balance)
      if (walletInfo) {
        setWalletInfo({
          ...walletInfo,
          balance: (parseFloat(walletInfo.balance) - amount).toString(),
          transactions: [
            {
              type: 'send',
              amount: amount.toString(),
              timestamp: new Date().toISOString(),
              account: withdrawAddress,
              hash: Math.random().toString(36).substring(7),
            },
            ...walletInfo.transactions,
          ],
        });
      }
    } catch (err) {
      setWithdrawError('Failed to process withdrawal');
    } finally {
      setIsWithdrawing(false);
    }
  };

  if (isLoading) return <div className="loading-spinner"></div>;
  if (error) return <div className="error-message">{error}</div>;
  if (!walletInfo) return <div className="error-message">No wallet data available</div>;

  return (
    <div className="wallet-dashboard">
      <h1 className="wallet-title">My Nano Wallet</h1>
      
      <div className="wallet-card">
        <div className="wallet-balance">
          <h2>Balance</h2>
          <p className="balance-amount">{walletInfo.balance} NANO</p>
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

        <div className="withdraw-section">
          <h2>Withdraw</h2>
          <div className="withdraw-form">
            <div className="form-group">
              <label htmlFor="withdraw-address">Recipient Address</label>
              <input
                id="withdraw-address"
                type="text"
                value={withdrawAddress}
                onChange={(e) => setWithdrawAddress(e.target.value)}
                placeholder="nano_..."
                className="withdraw-input"
                disabled={isWithdrawing}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="withdraw-amount">Amount (NANO)</label>
              <div className="amount-input-container">
                <input
                  id="withdraw-amount"
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0.00"
                  className="withdraw-input"
                  disabled={isWithdrawing}
                  min="0"
                  step="0.000001"
                />
                <button
                  className="max-button"
                  onClick={() => walletInfo && setWithdrawAmount(walletInfo.balance)}
                  disabled={isWithdrawing}
                >
                  MAX
                </button>
              </div>
            </div>

            {withdrawError && (
              <div className="withdraw-error">
                {withdrawError}
              </div>
            )}

            <button
              onClick={handleWithdraw}
              disabled={isWithdrawing || !withdrawAddress || !withdrawAmount}
              className="withdraw-button"
            >
              {isWithdrawing ? 'Processing...' : 'Withdraw'}
            </button>
          </div>
        </div>
      </div>

      <div className="transactions-section">
        <h2>Transaction History</h2>
        <div className="transactions-container">
          {walletInfo.transactions.map((tx) => (
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
        </div>
      </div>
    </div>
  );
} 