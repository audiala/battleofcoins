import React from 'react';
import type { CryptoData } from './CryptoTable';
import { useEffect, useState } from 'react';

interface Winner {
  coin: CryptoData;
  reason: string;
}

interface Round {
  name: string;
  pools: {
    id: number;
    cryptos: CryptoData[];
    winners?: Winner[];
  }[];
}

interface BattleHistory {
  id: string;
  date: string;
  rounds: Round[];
  winner?: CryptoData;
  prompt: string;
}

export default function BattleDashboard() {
  const [battleHistories, setBattleHistories] = useState<BattleHistory[]>([]);

  useEffect(() => {
    const savedHistories = localStorage.getItem('cryptoBattleHistories');
    if (savedHistories) {
      setBattleHistories(JSON.parse(savedHistories));
    }
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getRoundWinners = (round: Round) => {
    return round.pools
      .flatMap(pool => pool.winners?.map(w => w.coin.ticker) || [])
      .join(', ');
  };

  return (
    <div className="battle-dashboard">
      <h1 className="dashboard-title">Battle History</h1>
      <div className="dashboard-table-container">
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Prompt</th>
              <th>Final Winner</th>
              <th>Round Winners</th>
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
                  <div className="winner-cell">
                    <img 
                      src={`/${battle.winner?.logo_local}`} 
                      alt={battle.winner?.name}
                      className="winner-icon"
                    />
                    <span>{battle.winner?.name}</span>
                  </div>
                </td>
                <td>
                  <div className="rounds-cell">
                    {battle.rounds.map((round, index) => (
                      <div key={index} className="round-winners">
                        <strong>{round.name}:</strong> {getRoundWinners(round)}
                      </div>
                    ))}
                  </div>
                </td>
                <td>
                  <a 
                    href={`/crypto-battle?battle=${battle.id}`}
                    className="view-battle-link"
                  >
                    View Battle
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 