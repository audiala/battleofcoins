import React from 'react';
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

export default function CryptoTable({ data }: { data: CryptoData[] }) {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
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
  );
} 