"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const TOOLTIP_STYLE = {
  background: "rgb(15 23 42)",
  border: "none",
  borderRadius: 8,
  color: "white",
  fontSize: 12,
  padding: "8px 10px",
} as const;

const TOOLTIP_LABEL_STYLE = { color: "rgb(226 232 240)" } as const;
const TOOLTIP_ITEM_STYLE = { color: "white" } as const;

const AXIS_TICK = {
  fill: "currentColor",
  fontSize: 11,
} as const;

const GRID_STROKE = "rgb(148 163 184 / 0.2)";

/* -------------------------------------------------------------------------- */
/*  ComplaintsOverTimeChart                                                   */
/* -------------------------------------------------------------------------- */

export interface ComplaintsOverTimePoint {
  date: string;
  count: number;
}

export function ComplaintsOverTimeChart({
  data,
}: {
  data: ComplaintsOverTimePoint[];
}) {
  return (
    <div className="h-[280px] w-full text-slate-500 dark:text-slate-400">
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
          <XAxis
            dataKey="date"
            tick={AXIS_TICK}
            stroke={GRID_STROKE}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={AXIS_TICK}
            stroke={GRID_STROKE}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            itemStyle={TOOLTIP_ITEM_STYLE}
            cursor={{ fill: "rgb(148 163 184 / 0.1)" }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#2563eb"
            strokeWidth={2}
            fill="url(#colorCount)"
            fillOpacity={1}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  ByTypeChart                                                               */
/* -------------------------------------------------------------------------- */

export interface ByTypePoint {
  type: string;
  count: number;
  color: string;
}

export function ByTypeChart({ data }: { data: ByTypePoint[] }) {
  return (
    <div className="h-[280px] w-full text-slate-500 dark:text-slate-400">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
          <XAxis
            dataKey="type"
            tick={AXIS_TICK}
            stroke={GRID_STROKE}
            tickLine={false}
            axisLine={false}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={60}
          />
          <YAxis
            tick={AXIS_TICK}
            stroke={GRID_STROKE}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            itemStyle={TOOLTIP_ITEM_STYLE}
            cursor={{ fill: "rgb(148 163 184 / 0.1)" }}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.type} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  ByTehsilChart                                                             */
/* -------------------------------------------------------------------------- */

export interface ByTehsilPoint {
  name: string;
  count: number;
}

export function ByTehsilChart({ data }: { data: ByTehsilPoint[] }) {
  const top = data.slice(0, 10);
  return (
    <div className="h-[280px] w-full text-slate-500 dark:text-slate-400">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={top}
          margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
          layout="vertical"
        >
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
          <XAxis
            type="number"
            tick={AXIS_TICK}
            stroke={GRID_STROKE}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={AXIS_TICK}
            stroke={GRID_STROKE}
            tickLine={false}
            axisLine={false}
            width={110}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            itemStyle={TOOLTIP_ITEM_STYLE}
            cursor={{ fill: "rgb(148 163 184 / 0.1)" }}
          />
          <Bar
            dataKey="count"
            fill="#2563eb"
            radius={[0, 6, 6, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  StatusPieChart                                                            */
/* -------------------------------------------------------------------------- */

export interface StatusPiePoint {
  status: string;
  count: number;
  color: string;
}

export function StatusPieChart({ data }: { data: StatusPiePoint[] }) {
  return (
    <div className="h-[280px] w-full text-slate-500 dark:text-slate-400">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="status"
            innerRadius={60}
            outerRadius={95}
            paddingAngle={2}
            stroke="none"
          >
            {data.map((entry) => (
              <Cell key={entry.status} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            itemStyle={TOOLTIP_ITEM_STYLE}
          />
          <Legend
            verticalAlign="bottom"
            height={28}
            wrapperStyle={{ fontSize: 12 }}
            iconType="circle"
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  TopEmployeesChart                                                         */
/* -------------------------------------------------------------------------- */

export interface TopEmployeePoint {
  name: string;
  resolved: number;
}

export function TopEmployeesChart({ data }: { data: TopEmployeePoint[] }) {
  return (
    <div className="h-[280px] w-full text-slate-500 dark:text-slate-400">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
          <XAxis
            dataKey="name"
            tick={AXIS_TICK}
            stroke={GRID_STROKE}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <YAxis
            tick={AXIS_TICK}
            stroke={GRID_STROKE}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            itemStyle={TOOLTIP_ITEM_STYLE}
            cursor={{ fill: "rgb(148 163 184 / 0.1)" }}
          />
          <Bar
            dataKey="resolved"
            fill="#10b981"
            radius={[6, 6, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
