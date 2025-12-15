import React from "react";
import { useFormContext, useWatch } from "react-hook-form";

export const SummaryStats = () => {
    const { control } = useFormContext();
    const simpleData = useWatch({ control, name: "simpleData" }) || [];

    const totalQuestions = simpleData.reduce((acc: number, row: any) => acc + (row.quantity || 0), 0);
    // Assuming 1 question = 1 mark for now, or you can add a 'marks per question' field
    const estimatedMarks = totalQuestions * 4; // Mock calculation

    return (
        <div className="flex items-center gap-6 text-[#111827]">
            <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Marks</span>
                <span className="text-2xl font-bold">{estimatedMarks}</span>
            </div>
            <div className="h-10 w-px bg-[#E5E7EB]" />
            <div className="flex flex-col items-start">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Questions</span>
                <span className="text-2xl font-bold">{totalQuestions}</span>
            </div>
        </div>
    );
};