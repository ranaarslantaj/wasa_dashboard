"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface WorkloadPoint {
  name: string;
  active: number;
}

const GRID_STROKE = "rgb(148 163 184 / 0.2)";
const AXIS_TICK = { fill: "currentColor", fontSize: 11 } as const;

const TOOLTIP_STYLE = {
  background: "rgb(15 23 42)",
  border: "none",
  borderRadius: 8,
  color: "white",
  fontSize: 12,
  padding: "8px 10px",
} as const;

const barColor = (active: number): string => {
  if (active < 5) return "#10b981"; // emerald
  if (active < 10) return "#f59e0b"; // amber
  return "#ef4444"; // red
};

export function WorkloadChart({
  employees,
}: {
  employees: WorkloadPoint[];
}) {
  return (
    <div className="h-[320px] w-full text-slate-500 dark:text-slate-400">
      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={employees}
          margin={{ top: 8, right: 12, left: 0, bottom: 48 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
          <XAxis
            dataKey="name"
            tick={AXIS_TICK}
            stroke={GRID_STROKE}
            tickLine={false}
            axisLine={false}
            interval={0}
            angle={-30}
            textAnchor="end"
            height={70}
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
            labelStyle={{ color: "rgb(226 232 240)" }}
            itemStyle={{ color: "white" }}
            cursor={{ fill: "rgb(148 163 184 / 0.1)" }}
          />
          <Bar dataKey="active" radius={[6, 6, 0, 0]}>
            {employees.map((e) => (
              <Cell key={e.name} fill={barColor(e.active)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default WorkloadChart;
