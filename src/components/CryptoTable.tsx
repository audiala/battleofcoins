/** @jsxImportSource react */
import React, { useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { SortingState } from '@tanstack/react-table';

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

interface CryptoTableProps {
  data: CryptoData[];
  onSelectionChange?: (selectedCryptos: CryptoData[]) => void;
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

const columns = [
  columnHelper.accessor('selected', {
    header: ({ table }) => (
      <input
        type="checkbox"
        checked={table.getIsAllRowsSelected()}
        onChange={table.getToggleAllRowsSelectedHandler()}
        className="checkbox"
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        checked={row.getIsSelected()}
        onChange={row.getToggleSelectedHandler()}
        className="checkbox"
      />
    ),
  }),
  columnHelper.accessor('logo_local', {
    header: '',
    cell: info => (
      <img 
        src={`/${info.getValue()}`} 
        alt="" 
        className="w-8 h-8 rounded-full ring-1 ring-gray-700"
      />
    ),
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
        <span className="ml-2 text-gray-400 text-sm">{info.row.original.ticker}</span>
      </div>
    ),
  }),
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
];

function formatCurrency(value: string | null): string {
  if (!value) return '-';
  const num = Number(value.replace(/[$,]/g, ''));
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 2
  }).format(num);
  return `${formatted}`;
}

function formatNumber(value: string | null): string {
  if (!value) return '-';
  const num = Number(value.replace(/,/g, ''));
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2
  }).format(num);
}

// Update the RowSelection interface to include string index signature
interface RowSelection {
  [key: string]: boolean;
}

// Add type for the table's row selection state
type TableRowSelection = {
  [key: string]: boolean;
}

export default function CryptoTable({ data, onSelectionChange }: CryptoTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<TableRowSelection>({});
  const [selectedPreset, setSelectedPreset] = useState<string>('');

  const table = useReactTable({
    data,
    columns,
    state: { 
      sorting,
      rowSelection: rowSelection as TableRowSelection,
    },
    enableRowSelection: true,
    onRowSelectionChange: (updaterOrValue) => {
      if (typeof updaterOrValue === 'function') {
        setRowSelection(old => updaterOrValue(old) as TableRowSelection);
      } else {
        setRowSelection(updaterOrValue as TableRowSelection);
      }
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const handlePresetSelect = (preset: string) => {
    setSelectedPreset(preset);
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
    
    if (onSelectionChange) {
      const selectedCryptos = data.filter((_, index) => selectedRows[index.toString()]);
      onSelectionChange(selectedCryptos);
    }
  };

  const startBattle = () => {
    const selectedCryptos = data.filter((_, index) => rowSelection[index.toString()]);
    if (selectedCryptos.length < 8) {
      alert('Please select at least 8 cryptocurrencies for the battle');
      return;
    }

    try {
      localStorage.setItem('selectedCryptos', JSON.stringify(selectedCryptos));
      console.log('Stored selected cryptos:', selectedCryptos);
      window.location.href = '/crypto-battle';
    } catch (error) {
      console.error('Error storing selected cryptos:', error);
      alert('Failed to store selected cryptos. Please try again.');
    }
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
              onClick={() => handlePresetSelect('')}
              className="preset-button clear"
            >
              <span className="preset-icon">🔄</span>
              <span className="preset-text">
                <span className="preset-name">Clear</span>
                <span className="preset-description">Reset selection</span>
              </span>
            </button>
          </div>
        </div>

        <div className="battle-controls">
          <div className="selection-info">
            {Object.keys(rowSelection).length} coins selected
          </div>
          <button 
            onClick={startBattle}
            disabled={Object.keys(rowSelection).length < 8}
            className="start-battle-button"
          >
            <span className="battle-icon">⚔️</span>
            Start Battle
          </button>
        </div>
      </div>

      <table className="crypto-table">
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <th key={header.id} onClick={header.column.getToggleSortingHandler()}>
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
            <tr key={row.id}>
              {row.getVisibleCells().map(cell => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
} 