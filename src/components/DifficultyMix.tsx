import React from "react";
import { motion } from "framer-motion";
import { useFormContext, useWatch } from "react-hook-form";

export const DifficultyMix = () => {
    const { control } = useFormContext();
    const simpleData = useWatch({ control, name: "simpleData" }) || [];

    // Calculate real stats
    const total = simpleData.reduce((acc: number, row: any) => acc + (row.quantity || 0), 0);
    const easy = simpleData.filter((r: any) => r.difficulty === "Easy").reduce((acc: number, r: any) => acc + (r.quantity || 0), 0);
    const medium = simpleData.filter((r: any) => r.difficulty === "Medium").reduce((acc: number, r: any) => acc + (r.quantity || 0), 0);
    const hard = simpleData.filter((r: any) => r.difficulty === "Hard").reduce((acc: number, r: any) => acc + (r.quantity || 0), 0);

    const easyPct = total ? (easy / total) * 100 : 0;
    const medPct = total ? (medium / total) * 100 : 0;
    const hardPct = total ? (hard / total) * 100 : 0;

    const barTransition = { type: "spring", stiffness: 80, damping: 15 };

    return (
        <div className="w-full space-y-4">
            <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider text-gray-400">
                <span>Difficulty Distribution</span>
                <span className="text-gray-600">Live Stats</span>
            </div>
            
            {/* The Bar */}
            <div className="h-4 w-full bg-[#F3F4F6] rounded-full flex overflow-hidden ring-1 ring-inset ring-black/5">
                <motion.div initial={{ width: 0 }} animate={{ width: `${easyPct}%` }} className="h-full bg-emerald-400" transition={barTransition} />
                <motion.div initial={{ width: 0 }} animate={{ width: `${medPct}%` }} className="h-full bg-amber-400" transition={barTransition} />
                <motion.div initial={{ width: 0 }} animate={{ width: `${hardPct}%` }} className="h-full bg-rose-400" transition={barTransition} />
            </div>

            {/* Legend */}
            <div className="flex gap-4">
                <LegendItem color="bg-emerald-400" label="Easy" pct={Math.round(easyPct)} />
                <LegendItem color="bg-amber-400" label="Medium" pct={Math.round(medPct)} />
                <LegendItem color="bg-rose-400" label="Hard" pct={Math.round(hardPct)} />
            </div>
        </div>
    );
};

const LegendItem = ({ color, label, pct }: { color: string, label: string, pct: number }) => (
    <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-xs font-bold text-gray-600">{label} {pct}%</span>
    </div>
);