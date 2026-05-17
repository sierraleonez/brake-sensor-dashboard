import { router, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type SensorStatus = 'AMAN' | 'PERINGATAN' | 'BAHAYA';

interface CurrentState {
    device_id: string;
    suhu: number;
    unit: string;
    status: SensorStatus;
    time: string;
}

interface HistoryPoint {
    time: string;
    value: number | null;
}

interface LogEntry {
    time: string;
    device_id: string;
    suhu: number | null;
    status: string;
    unit: string;
}

interface Props {
    current: CurrentState | null;
    history: HistoryPoint[];
    logs: LogEntry[];
    range: string;
}

// ---- SVG Gauge ----
function SensorGauge({ current }: { current: CurrentState | null }) {
    const [secondsAgo, setSecondsAgo] = useState(0);

    useEffect(() => {
        if (!current) return;
        const tick = () => setSecondsAgo(Math.floor((Date.now() - new Date(current.time).getTime()) / 1000));
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [current]);

    const R = 90, cx = 120, cy = 120;
    const arc = Math.PI * R;
    const pct = current ? Math.min(Math.max(current.suhu / 100, 0), 1) : 0;
    const color = pct < 0.5 ? '#22c55e' : pct < 0.75 ? '#eab308' : '#ef4444';
    const D = `M ${cx - R},${cy} A ${R},${R} 0 0 1 ${cx + R},${cy}`;
    const ago = (s: number) => s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`;

    return (
        <div className="flex flex-col items-center gap-3 py-8">
            <svg width="240" height="130" viewBox="0 0 240 130" aria-label="Temperature gauge">
                <path d={D} fill="none" stroke="#1e293b" strokeWidth="18" strokeLinecap="round" />
                <path
                    d={D} fill="none" stroke={color} strokeWidth="18" strokeLinecap="round"
                    strokeDasharray={`${pct * arc} ${arc}`}
                    style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.4s ease' }}
                />
                {current ? (
                    <>
                        <text x={cx} y={cy - 8} textAnchor="middle" fill="white" fontSize="30" fontWeight="bold">
                            {current.suhu.toFixed(2)}
                        </text>
                        <text x={cx} y={cy + 20} textAnchor="middle" fill="#94a3b8" fontSize="15">
                            °{current.unit}
                        </text>
                    </>
                ) : (
                    <text x={cx} y={cy + 4} textAnchor="middle" fill="#475569" fontSize="14">No data</text>
                )}
            </svg>
            <p className="text-sm text-slate-400">
                {current ? `Last updated: ${ago(secondsAgo)}` : 'Waiting for sensor data…'}
            </p>
        </div>
    );
}

// ---- Main Page ----
const RANGES = ['1h', '24h', '7d'] as const;

const statusStyle: Record<SensorStatus, string> = {
    AMAN:       'bg-green-500 text-white',
    PERINGATAN: 'bg-yellow-500 text-black',
    BAHAYA:     'bg-red-500 text-white',
};

const fmtTick = (t: string) => {
    try { return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
};

export default function Dashboard() {
    const { current, history, logs, range } = usePage<Props>().props;
    const [tab, setTab] = useState<'gauge' | 'chart'>('gauge');
    const status: SensorStatus = (current?.status as SensorStatus) ?? 'AMAN';

    useEffect(() => {
        const id = setInterval(() => router.reload({ only: ['current', 'history', 'logs'] }), 3000);
        return () => clearInterval(id);
    }, []);

    const changeRange = (r: string) =>
        router.get('/', { range: r }, { preserveState: true, only: ['history', 'range'] });

    return (
        <div className="min-h-screen bg-slate-950 p-4 md:p-8">
            <div className="mx-auto max-w-3xl flex flex-col gap-4">

                {/* Header */}
                <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <span className="relative flex h-3 w-3">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                                <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
                            </span>
                            <span className="font-mono text-sm text-slate-300">{current?.device_id ?? '—'}</span>
                        </div>
                        <span className={`rounded-full px-4 py-1 text-sm font-bold tracking-wide ${statusStyle[status]}`}>
                            {status}
                        </span>
                    </div>
                </div>

                {/* Tab switcher */}
                <div className="flex w-fit gap-1 rounded-xl border border-slate-700 bg-slate-900 p-1">
                    {(['gauge', 'chart'] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
                                tab === t ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            {t === 'gauge' ? 'Live Monitor' : 'Historical Trends'}
                        </button>
                    ))}
                </div>

                {/* Panel */}
                <div className="rounded-xl border border-slate-700 bg-slate-900">
                    {tab === 'gauge' ? (
                        <SensorGauge current={current} />
                    ) : (
                        <div className="p-4">
                            <div className="mb-4 flex gap-2">
                                {RANGES.map((r) => (
                                    <button
                                        key={r}
                                        onClick={() => changeRange(r)}
                                        className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                                            range === r
                                                ? 'bg-blue-600 text-white'
                                                : 'border border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200'
                                        }`}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>

                            {history.length === 0 ? (
                                <div className="flex h-48 items-center justify-center text-slate-500">
                                    No historical data for this range.
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height={300}>
                                    <AreaChart data={history} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                        <XAxis dataKey="time" tickFormatter={fmtTick}
                                            tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false}
                                            axisLine={{ stroke: '#1e293b' }} interval="preserveStartEnd" />
                                        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false}
                                            axisLine={false} tickFormatter={(v) => `${v}°`} />
                                        <Tooltip
                                            contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                                            labelStyle={{ color: '#94a3b8', fontSize: 11 }}
                                            itemStyle={{ color: '#93c5fd' }}
                                            formatter={(v: number) => [`${v.toFixed(2)} °C`, 'Temperature']}
                                            labelFormatter={(l) => new Date(l).toLocaleString()}
                                        />
                                        <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2}
                                            fill="url(#grad)" dot={false} activeDot={{ r: 4, fill: '#3b82f6' }}
                                            connectNulls={false} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    )}
                </div>
                {/* Data logs table */}
                <div className="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-700">
                        <h2 className="text-sm font-semibold text-slate-300">Data Logs</h2>
                    </div>
                    {logs.length === 0 ? (
                        <div className="flex h-24 items-center justify-center text-slate-500 text-sm">
                            No log data available.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-700 text-left text-xs text-slate-500">
                                        <th className="px-4 py-2">Time</th>
                                        <th className="px-4 py-2">Device ID</th>
                                        <th className="px-4 py-2">Suhu</th>
                                        <th className="px-4 py-2">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((row, i) => (
                                        <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/50">
                                            <td className="px-4 py-2 text-slate-400 whitespace-nowrap">
                                                {new Date(row.time).toLocaleString()}
                                            </td>
                                            <td className="px-4 py-2 font-mono text-slate-300">{row.device_id}</td>
                                            <td className="px-4 py-2 text-slate-300">
                                                {row.suhu !== null ? `${row.suhu.toFixed(2)} °${row.unit}` : '—'}
                                            </td>
                                            <td className="px-4 py-2">
                                                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                                    row.status === 'BAHAYA'     ? 'bg-red-500/20 text-red-400' :
                                                    row.status === 'PERINGATAN' ? 'bg-yellow-500/20 text-yellow-400' :
                                                                                  'bg-green-500/20 text-green-400'
                                                }`}>
                                                    {row.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
