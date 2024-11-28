/** @jsxImportSource react */
import React, { useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  Row,
} from '@tanstack/react-table';
import type { SortingState } from '@tanstack/react-table';
// import { useBinanceWebSocket } from '../hooks/useBinanceWebSocket';
import coinsByTags from '../../data/coins_by_tags.json'; // Import the JSON file

export type CryptoData = {
  id: number;
  name: string;
  ticker: string;
  logo_local: string;
  marketcap: string;
  market_stats: {
    market_cap: string;
    market_cap_fdv_ratio: string;
    fully_diluted_valuation: string;
    trading_volume_24h: string;
    circulating_supply: string;
    total_supply: string;
    max_supply: string;
  };
  selected?: boolean;
};

interface TaggedCoinData {
  [key: string]: {
    name: string;
    ticker: string;
    tags: string[];
  };
}

interface CryptoTableProps {
  data: CryptoData[];
  onSelectionChange?: (selectedCryptos: CryptoData[]) => void;
  taggedCoins?: TaggedCoinData;
}

const columnHelper = createColumnHelper<CryptoData>();

// Add helper functions for sorting
function parseCurrencyValue(value: string | null): number {
  if (!value) return 0;
  // Remove currency symbols, commas and convert to number
  return Number(value.replace(/[$,]/g, ''));
}

function parseNumberValue(value: string | null): number {
  if (!value) return 0;
  // Remove commas and convert to number
  return Number(value.replace(/,/g, ''));
}

// Add these functions before the CryptoTable component definition

function formatCurrency(value: string | null): string {
  if (!value || value === 'NaN') return 'NaN';
  const num = Number(value.replace(/[$,]/g, ''));
  if (isNaN(num)) return 'NaN';
  
  // Handle small numbers
  if (Math.abs(num) < 0.01) {
    // Convert to scientific notation first
    const scientificStr = num.toExponential(6);
    
    // If it's extremely small (e < -20), keep scientific notation
    if (num < 1e-20) {
      return `$${scientificStr}`;
    }
    
    // Otherwise, show decimal notation with up to 8 decimal places
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 8,
      maximumFractionDigits: 8
    }).format(num);
  }
  
  // For normal numbers (≥ 0.01), use compact notation
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 2
  }).format(num);
}

function formatNumber(value: string | null): string {
  if (!value) return '-';
  const num = Number(value.replace(/,/g, ''));
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2
  }).format(num);
}

// Add these memoized components at the top level
const LogoCell = React.memo(({ logoPath }: { logoPath: string }) => {
  return (
    <img 
      src={`/${logoPath}`} 
      alt="" 
      className="w-8 h-8 rounded-full ring-1 ring-gray-700"
    />
  );
});

// const PriceCell = React.memo(({ symbol, marketData }: { 
//   symbol: string, 
//   marketData: Record<string, { price: string, lastUpdate: number }> 
// }) => {
//   const data = marketData[symbol];
//   const price = data?.price;

//   if (!price) {
//     return <span className="text-gray-400">NaN</span>;
//   }

//   return (
//     <div className="text-right">
//       {formatCurrency(price)}
//     </div>
//   );
// }, (prevProps, nextProps) => {
//   const prevData = prevProps.marketData[prevProps.symbol];
//   const nextData = nextProps.marketData[nextProps.symbol];
//   return prevData?.price === nextData?.price;
// });

// Add this type definition at the top of the file after the imports
type TableRowSelection = {
  [key: string]: boolean;
};

// Update the TableRow component
const TableRow = React.memo(({ row, isSelected }: { row: Row<CryptoData>, isSelected: boolean }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <tr 
      key={row.id}
      onClick={(e) => {
        e.preventDefault();
        row.toggleSelected();
      }}
      className={`
        cursor-pointer
        transition-all duration-200
        ${isSelected 
          ? '!bg-[rgba(245,62,152,0.15)] hover:!bg-[rgba(245,62,152,0.25)]' 
          : 'hover:bg-white/5'
        }
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {row.getVisibleCells().map(cell => (
        <td 
          key={cell.id}
          className={`
            px-4 py-3
            ${isSelected ? 'border-l-4 border-l-[#f53e98]' : 'border-l-4 border-l-transparent'}
          `}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  );
}, (prevProps, nextProps) => prevProps.isSelected === nextProps.isSelected);

const getUniqueTagsFromData = (taggedCoins: TaggedCoinData): string[] => {
  const tagsSet = new Set<string>();
  Object.values(taggedCoins).forEach(coin => {
    coin.tags.forEach(tag => {
      // Clean up the tag by removing leading/trailing spaces
      const cleanTag = tag.trim().replace(/^[, ]+|[, ]+$/g, '');
      if (cleanTag) tagsSet.add(cleanTag);
    });
  });
  return Array.from(tagsSet).sort();
};

export default function CryptoTable({ data, onSelectionChange, taggedCoins = {} }: CryptoTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<TableRowSelection>({});
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');

  const symbols = data.map(crypto => `${crypto.ticker}USDT`);
  // const marketData = useBinanceWebSocket(symbols);

  // Move columns definition inside component to access marketData
  const columns = React.useMemo(() => [
    columnHelper.accessor('logo_local', {
      header: '',
      cell: info => <LogoCell logoPath={info.getValue()} />,
    }),
    columnHelper.accessor('name', {
      header: 'Name',
      cell: info => (
        <div className="flex items-center">
          <span className="font-medium text-white">{info.getValue()}</span>
        </div>
      ),
    }),
    columnHelper.accessor('ticker', {
      header: 'Ticker',
      cell: info => (
        <div className="flex items-center">
          <span className="ml-2 text-gray-400 text-sm">{info.getValue()}</span>
        </div>
      ),
    }),
    // Add price column after ticker
    // columnHelper.accessor(row => {
    //   return `${row.ticker}USDT`.toUpperCase();
    // }, {
    //   id: 'price',
    //   header: 'Price',
    //   cell: info => (
    //     <PriceCell 
    //       symbol={info.getValue()} 
    //       marketData={marketData}
    //     />
    //   ),
    //   sortingFn: (rowA, rowB) => {
    //     const symbolA = `${rowA.original.ticker}USDT`.toUpperCase();
    //     const symbolB = `${rowB.original.ticker}USDT`.toUpperCase();
    //     const a = Number(marketData[symbolA]?.price || 0);
    //     const b = Number(marketData[symbolB]?.price || 0);
    //     return a - b;
    //   },
    // }),
    columnHelper.accessor(row => row.market_stats.market_cap, {
      id: 'market_cap',
      header: 'Market Cap',
      cell: info => formatCurrency(info.getValue()),
      sortingFn: (rowA, rowB) => {
        const a = parseCurrencyValue(rowA.original.market_stats.market_cap);
        const b = parseCurrencyValue(rowB.original.market_stats.market_cap);
        return a - b;
      },
    }),
    columnHelper.accessor(row => row.market_stats.fully_diluted_valuation, {
      id: 'fdv',
      header: 'Fully Diluted Valuation',
      cell: info => formatCurrency(info.getValue()),
      sortingFn: (rowA, rowB) => {
        const a = parseCurrencyValue(rowA.original.market_stats.fully_diluted_valuation);
        const b = parseCurrencyValue(rowB.original.market_stats.fully_diluted_valuation);
        return a - b;
      },
    }),
    columnHelper.accessor(row => row.market_stats.trading_volume_24h, {
      id: 'volume',
      header: '24h Volume',
      cell: info => formatCurrency(info.getValue()),
      sortingFn: (rowA, rowB) => {
        const a = parseCurrencyValue(rowA.original.market_stats.trading_volume_24h);
        const b = parseCurrencyValue(rowB.original.market_stats.trading_volume_24h);
        return a - b;
      },
    }),
    columnHelper.accessor(row => row.market_stats.circulating_supply, {
      id: 'circulating_supply',
      header: 'Circulating Supply',
      cell: info => formatNumber(info.getValue()),
      sortingFn: (rowA, rowB) => {
        const a = parseNumberValue(rowA.original.market_stats.circulating_supply);
        const b = parseNumberValue(rowB.original.market_stats.circulating_supply);
        return a - b;
      },
    }),
    columnHelper.accessor(row => row.market_stats.total_supply, {
      id: 'total_supply',
      header: 'Total Supply',
      cell: info => formatNumber(info.getValue()),
      sortingFn: (rowA, rowB) => {
        const a = parseNumberValue(rowA.original.market_stats.total_supply);
        const b = parseNumberValue(rowB.original.market_stats.total_supply);
        return a - b;
      },
    }),
    columnHelper.accessor(row => row.market_stats.max_supply, {
      id: 'max_supply',
      header: 'Max Supply',
      cell: info => formatNumber(info.getValue()),
      sortingFn: (rowA, rowB) => {
        const a = parseNumberValue(rowA.original.market_stats.max_supply);
        const b = parseNumberValue(rowB.original.market_stats.max_supply);
        return a - b;
      },
    }),
  ], []); // Add marketData as dependency

  const table = useReactTable({
    data,
    columns,
    state: { 
      sorting,
      rowSelection,
    },
    enableRowSelection: true,
    enableMultiRowSelection: true, // Make sure multiple selection is enabled
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const handlePresetSelect = (preset: string) => {
    // If clicking the same preset again, clear the selection
    if (selectedPreset === preset) {
      clearSelection();
      return;
    }

    setSelectedPreset(preset);
    setSelectedTag(''); // Clear any selected tag
    let selectedRows: TableRowSelection = {};

    switch (preset) {
      case 'top16':
        data.slice(0, 16).forEach((_, index) => {
          selectedRows[index.toString()] = true;
        });
        break;
      case 'top100':
        data.slice(0, 100).forEach((_, index) => {
          selectedRows[index.toString()] = true;
        });
        break;
      default:
        selectedRows = {};
    }

    setRowSelection(selectedRows);
    table.setRowSelection(selectedRows);
    
    if (onSelectionChange) {
      const selectedCryptos = data.filter((_, index) => selectedRows[index.toString()]);
      onSelectionChange(selectedCryptos);
    }
  };

  const handleTagSelect = (tag: string) => {
    // If clicking the same tag again, clear the selection
    if (selectedTag === tag) {
      clearSelection();
      return;
    }

    setSelectedTag(tag);
    setSelectedPreset(''); // Clear any selected preset
    let selectedRows: TableRowSelection = {};

    // Use the imported JSON data to find all coins that have the selected tag
    const tickers = coinsByTags[tag] || [];
    data.forEach((crypto, index) => {
      if (tickers.includes(crypto.ticker)) {
        selectedRows[index.toString()] = true;
      }
    });

    // Update both the row selection state and the table selection
    setRowSelection(selectedRows);
    table.setRowSelection(selectedRows);
    
    if (onSelectionChange) {
      const selectedCryptos = data.filter((_, index) => selectedRows[index.toString()]);
      onSelectionChange(selectedCryptos);
    }

    // Debug logging
    console.log('Selected tag:', tag);
    console.log('Found matches:', Object.keys(selectedRows).length);
  };

  const startBattle = () => {
    const selectedCryptos = data.filter((_, index) => rowSelection[index.toString()]);
    if (selectedCryptos.length < 2) {
      alert('Please select at least 2 cryptocurrencies for the battle');
      return;
    }

    try {
      localStorage.setItem('selectedCryptos', JSON.stringify(selectedCryptos));
      console.log('Stored selected cryptos:', selectedCryptos);
      window.location.href = '/';
    } catch (error) {
      console.error('Error storing selected cryptos:', error);
      alert('Failed to store selected cryptos. Please try again.');
    }
  };

  // Add a clear selection function
  const clearSelection = () => {
    setSelectedTag('');
    setSelectedPreset('');
    setRowSelection({});
    table.setRowSelection({});
  };

  return (
    <div className="crypto-table-container">
      <div className="table-controls">
        <div className="controls-section">
          <h2 className="presets-title">Quick Select</h2>
          <div className="presets">
            <button 
              onClick={() => handlePresetSelect('top16')}
              className={`preset-button ${selectedPreset === 'top16' ? 'active' : ''}`}
            >
              <span className="preset-icon">🏆</span>
              <span className="preset-text">
                <span className="preset-name">Top 16</span>
                <span className="preset-description">Highest market cap</span>
              </span>
            </button>
            <button 
              onClick={() => handlePresetSelect('top100')}
              className={`preset-button ${selectedPreset === 'top100' ? 'active' : ''}`}
            >
              <span className="preset-icon">💯</span>
              <span className="preset-text">
                <span className="preset-name">Top 100</span>
                <span className="preset-description">Most popular coins</span>
              </span>
            </button>
            <button 
              onClick={clearSelection}
              className="preset-button clear"
            >
              <span className="preset-icon">🔄</span>
              <span className="preset-text">
                <span className="preset-name">Clear</span>
                <span className="preset-description">Reset selection</span>
              </span>
            </button>
          </div>
          
          <h2 className="presets-title mt-4">Select by Category</h2>
          <div className="tag-buttons flex flex-wrap gap-2 mt-2">
            {Object.keys(coinsByTags).map(tag => (
              <button
                key={tag}
                onClick={() => handleTagSelect(tag)}
                className={`tag-button px-3 py-1 rounded-full text-sm transition-all duration-200
                  ${selectedTag === tag 
                    ? 'bg-blue-600 text-white ring-2 ring-blue-400 transform scale-105' 
                    : 'bg-gray-700 text-gray-200 hover:bg-gray-600 hover:transform hover:scale-105'}`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="battle-controls">
          <div className="selection-info">
            {Object.keys(rowSelection).length} coins selected
          </div>
          <button 
            onClick={startBattle}
            disabled={Object.keys(rowSelection).length < 2}
            className="start-battle-button"
          >
            <span className="battle-icon">⚔️</span>
            Start Battle
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th 
                    key={header.id} 
                    onClick={header.column.getToggleSortingHandler()}
                    className="px-4 py-3 text-left bg-gray-800/50 cursor-pointer hover:bg-gray-700/50 text-[#f53e98]"
                  >
                    <div className="flex items-center gap-2">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() && (
                        <span className="sort-indicator">
                          {header.column.getIsSorted() === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <TableRow key={row.id} row={row} isSelected={rowSelection[row.id]} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 