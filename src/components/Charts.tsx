'use client';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#1f3147', '#2e7d32', '#e0a800', '#c62828', '#5c6bc0', '#00897b', '#8e24aa', '#6d4c41'];

export function Bars({ data, x, y }: { data: Record<string, unknown>[]; x: string; y: string }) {
  return <ResponsiveContainer width="100%" height={260}>
    <BarChart data={data}><XAxis dataKey={x} fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Bar dataKey={y} fill="#1f3147" radius={[4, 4, 0, 0]} /></BarChart>
  </ResponsiveContainer>;
}

export function Lines({ data, x, y }: { data: Record<string, unknown>[]; x: string; y: string }) {
  return <ResponsiveContainer width="100%" height={260}>
    <LineChart data={data}><XAxis dataKey={x} fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Line dataKey={y} stroke="#2e7d32" strokeWidth={2} dot={false} /></LineChart>
  </ResponsiveContainer>;
}

export function PieC({ data, nameKey, valKey }: { data: Record<string, unknown>[]; nameKey: string; valKey: string }) {
  return <ResponsiveContainer width="100%" height={260}>
    <PieChart><Pie data={data} nameKey={nameKey} dataKey={valKey} outerRadius={90} label>
      {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart>
  </ResponsiveContainer>;
}
