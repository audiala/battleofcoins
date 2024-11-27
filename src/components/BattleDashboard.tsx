import React from 'react';
import { useEffect, useState } from 'react';
import { getAllBattleHistories } from '../services/BattleDatabase';

interface CryptoData {
  id: number;
  name: string;
  ticker: string;
  logo_local: string;
}

interface Winner {
  coin: CryptoData;
  reason: string;
}

interface Pool {
  id: number;
  cryptos: CryptoData[];
  winners?: Winner[];
  losers?: Winner[];
}

interface Round {
  name: string;
  pools: Pool[];
}

interface ModelResult {
  rounds: Round[];
  winner: CryptoData;
}

interface BattleResults {
  modelResults: {
    [modelId: string]: ModelResult;
  };
  globalWinner: {
    coin: CryptoData;
    score: number;
  } | null;
  scores: {
    [ticker: string]: {
      coin: CryptoData;
      score: number;
    };
  };
}

interface BattleHistory {
  id: string;
  date: string;
  results: BattleResults;
  prompt: string;
}

export default function BattleDashboard() {
  const [battleHistories, setBattleHistories] = useState<BattleHistory[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalBattles, setTotalBattles] = useState(0);
  const battlesPerPage = 20;

  useEffect(() => {
    const loadBattleHistories = async () => {
      try {
        const { battles, total } = await getAllBattleHistories(currentPage, battlesPerPage);
        setBattleHistories(battles);
        setTotalBattles(total);
      } catch (error) {
        console.error('Error loading battle histories:', error);
      }
    };

    loadBattleHistories();
  }, [currentPage]);

  const totalPages = Math.ceil(totalBattles / battlesPerPage);

  // Add pagination controls
  const Pagination = () => (
    <div className="pagination">
      <button 
        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
        disabled={currentPage === 1}
        className="pagination-button"
      >
        Previous
      </button>
      <span className="page-info">
        Page {currentPage} of {totalPages} ({totalBattles} total)
      </span>
      <button 
        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
        disabled={currentPage === totalPages}
        className="pagination-button"
      >
        Next
      </button>
    </div>
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const downloadBattleAsJson = (battle: BattleHistory) => {
    const dataStr = JSON.stringify(battle, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `battle-${battle.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="battle-dashboard">
      <h1 className="dashboard-title">Public Battle History</h1>
      <div className="dashboard-table-container">
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Prompt</th>
              <th>Models</th>
              <th>Winners</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {battleHistories.map((battle) => (
              <tr key={battle.id}>
                <td>{formatDate(battle.date)}</td>
                <td className="prompt-cell">
                  <div className="prompt-content">{battle.prompt}</div>
                </td>
                <td>
                  <div className="models-cell">
                    {Object.entries(battle.results.modelResults).map(([modelId, result]) => (
                      <div key={modelId} className="model-entry">
                        <span className="model-name">{modelId}</span>
                      </div>
                    ))}
                  </div>
                </td>
                <td>
                  <div className="winners-cell">
                    {Object.entries(battle.results.modelResults).map(([modelId, result]) => (
                      <div key={modelId} className="winner-entry">
                        <img 
                          src={`/${result.winner.logo_local}`} 
                          alt={result.winner.name}
                          className="winner-icon"
                        />
                        <span className="winner-name">{result.winner.name}</span>
                      </div>
                    ))}
                  </div>
                </td>
                <td>
                  <div className="actions-cell">
                    <a 
                      href={`/?battle=${battle.id}`}
                      className="view-battle-link"
                    >
                      View Battle
                    </a>
                    <button
                      onClick={() => downloadBattleAsJson(battle)}
                      className="download-button"
                    >
                      📥 Download
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {battleHistories.length === 0 && (
              <tr>
                <td colSpan={5} className="no-battles">
                  No battles found
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {totalBattles > battlesPerPage && <Pagination />}
      </div>
    </div>
  );
} 