import { useMemo } from 'react';
import { Table, Hash, Type, Calendar } from 'lucide-react';

interface DataPreviewProps {
  csvData: string;
}

export function DataPreview({ csvData }: DataPreviewProps) {
  const { headers, rows, stats } = useMemo(() => {
    const lines = csvData.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const allRows = lines.slice(1).map(line => line.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
    const rows = allRows.slice(0, 5);

    const stats = headers.map((h, i) => {
      const values = allRows.map(r => r[i]).filter(Boolean);
      const numericVals = values.map(Number).filter(v => !isNaN(v));
      const isNumeric = numericVals.length > values.length * 0.5;
      return {
        name: h,
        type: isNumeric ? 'numeric' : 'string',
        nonNull: values.length,
        total: allRows.length,
        unique: new Set(values).size,
      };
    });

    return { headers, rows, stats };
  }, [csvData]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Table className="w-4 h-4" />
        <span>{rows.length > 0 ? `Preview (first 5 of ${rows.length + (csvData.trim().split('\n').length - 6 > 0 ? csvData.trim().split('\n').length - 1 : rows.length)} rows)` : 'No data'}</span>
      </div>

      <div className="overflow-x-auto scrollbar-thin rounded border border-border">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="bg-secondary">
              {headers.map(h => (
                <th key={h} className="px-3 py-2 text-left text-muted-foreground font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-border hover:bg-secondary/50 transition-colors">
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-1.5 text-foreground whitespace-nowrap">{cell || '—'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {stats.map(s => (
          <div key={s.name} className="p-2 rounded bg-secondary/50 border border-border">
            <div className="flex items-center gap-1.5 mb-1">
              {s.type === 'numeric' ? <Hash className="w-3 h-3 text-primary" /> : <Type className="w-3 h-3 text-accent" />}
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
