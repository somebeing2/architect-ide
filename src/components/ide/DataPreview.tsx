import { useMemo, CSSProperties } from 'react';
import { Table, Hash, Type } from 'lucide-react';
import { List } from 'react-window';

interface DataPreviewProps {
  csvData: string;
}

const ROW_HEIGHT    = 28;
const CONTAINER_MAX = 160;

// Row props passed via the react-window v2 rowProps API
interface RowExtraProps {
  rows: string[][];
  colWidth: number;
  colCount: number;
}

type RowComponentProps = {
  ariaAttributes: {
    'aria-posinset': number;
    'aria-setsize': number;
    role: 'listitem';
  };
  index: number;
  style: CSSProperties;
} & RowExtraProps;

function VirtualRow({ ariaAttributes, index, style, rows, colWidth, colCount }: RowComponentProps) {
  const row = rows[index];
  return (
    <div
      {...ariaAttributes}
      style={{ ...style, display: 'flex', width: colCount * colWidth }}
      className={`border-b border-border text-xs font-mono ${index % 2 === 0 ? '' : 'bg-secondary/30'} hover:bg-secondary/50 transition-colors`}
    >
      {Array.from({ length: colCount }).map((_, j) => (
        <div
          key={j}
          style={{ width: colWidth, minWidth: colWidth }}
          className="px-3 flex items-center text-foreground whitespace-nowrap overflow-hidden text-ellipsis"
        >
          {row?.[j] || '—'}
        </div>
      ))}
    </div>
  );
}

export function DataPreview({ csvData }: DataPreviewProps) {
  const { headers, allRows, stats } = useMemo(() => {
    const lines   = csvData.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const allRows = lines.slice(1).map(line => line.split(',').map(c => c.trim().replace(/^"|"$/g, '')));

    const stats = headers.map((h, i) => {
      const values      = allRows.map(r => r[i]).filter(Boolean);
      const numericVals = values.map(Number).filter(v => !isNaN(v));
      const isNumeric   = numericVals.length > values.length * 0.5;
      return {
        name   : h,
        type   : isNumeric ? 'numeric' : 'string',
        nonNull: values.length,
        total  : allRows.length,
        unique : new Set(values).size,
      };
    });

    return { headers, allRows, stats };
  }, [csvData]);

  // Column width: distribute equally, minimum 80px each
  const colWidth   = Math.max(80, Math.floor(800 / Math.max(headers.length, 1)));
  const listHeight = Math.min(CONTAINER_MAX, allRows.length * ROW_HEIGHT);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Table className="w-4 h-4" />
        <span>
          {allRows.length > 0
            ? `Preview (${allRows.length} row${allRows.length !== 1 ? 's' : ''})`
            : 'No data'}
        </span>
      </div>

      {/* Virtualized table */}
      <div className="overflow-x-auto scrollbar-thin rounded border border-border">
        {/* Sticky header row */}
        <div
          style={{ display: 'flex', width: headers.length * colWidth }}
          className="bg-secondary text-xs font-mono"
        >
          {headers.map(h => (
            <div
              key={h}
              style={{ width: colWidth, minWidth: colWidth }}
              className="px-3 py-2 text-left text-muted-foreground font-medium whitespace-nowrap overflow-hidden text-ellipsis"
            >
              {h}
            </div>
          ))}
        </div>

        {/* Virtualized rows via react-window v2 List */}
        {allRows.length > 0 && (
          <List
            rowCount={allRows.length}
            rowHeight={ROW_HEIGHT}
            rowComponent={VirtualRow}
            rowProps={{ rows: allRows, colWidth, colCount: headers.length }}
            style={{ height: listHeight, overflowX: 'hidden' }}
          />
        )}
      </div>

      {/* Column stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {stats.map(s => (
          <div key={s.name} className="p-2 rounded bg-secondary/50 border border-border">
            <div className="flex items-center gap-1.5 mb-1">
              {s.type === 'numeric'
                ? <Hash className="w-3 h-3 text-primary" />
                : <Type className="w-3 h-3 text-accent" />}
              <span className="text-xs font-medium text-foreground truncate">{s.name}</span>
            </div>
            <div className="text-[10px] text-muted-foreground space-y-0.5">
              <div>{s.nonNull}/{s.total} non-null</div>
              <div>{s.unique} unique</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
