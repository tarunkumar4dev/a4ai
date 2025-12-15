import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FileText, Calendar, School } from "lucide-react";

interface PreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: any;
}

export const PreviewModal = ({ isOpen, onClose, data }: PreviewModalProps) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-[#111827]/60 backdrop-blur-sm"
                onClick={onClose} 
            />
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }} 
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-[24px] shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col relative z-10"
            >
                {/* Header */}
                <div className="p-6 border-b border-[#E5E7EB] flex justify-between items-center bg-[#F9FAFB]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#E0E7FF] rounded-lg text-[#2563EB]">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-[#111827]">Test Preview</h3>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Review Configuration</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-[#111827]">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 overflow-y-auto space-y-8">
                    {/* Exam Meta */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-5 bg-gradient-to-br from-[#F9FAFB] to-white rounded-[20px] border border-[#E5E7EB] shadow-sm">
                            <span className="text-[10px] font-bold text-[#2563EB] uppercase tracking-wider mb-2 block">Exam Title</span>
                            <p className="font-bold text-[#111827] text-lg">{data.examTitle || "Untitled Exam"}</p>
                        </div>
                        <div className="p-5 bg-gradient-to-br from-[#F9FAFB] to-white rounded-[20px] border border-[#E5E7EB] shadow-sm space-y-1">
                             <div className="flex items-center gap-2 text-sm font-semibold text-gray-600">
                                <School size={14} /> {data.board} • {data.classGrade}
                             </div>
                             <div className="flex items-center gap-2 text-sm font-semibold text-gray-600">
                                <Calendar size={14} /> {data.subject}
                             </div>
                        </div>
                    </div>

                    {/* Table Data */}
                    <div>
                        <h4 className="text-sm font-bold text-[#111827] mb-4 uppercase tracking-wide">Section Structure</h4>
                        <div className="border border-[#E5E7EB] rounded-[16px] overflow-hidden shadow-sm">
                             <table className="w-full text-sm text-left">
                                <thead className="bg-[#F9FAFB] text-gray-400 font-bold uppercase text-[10px] tracking-wider">
                                    <tr>
                                        <th className="p-4">Topic</th>
                                        <th className="p-4 text-center">Qty</th>
                                        <th className="p-4">Difficulty</th>
                                        <th className="p-4">Format</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#F3F4F6]">
                                    {data.simpleData?.map((row: any, i: number) => (
                                        <tr key={i} className="hover:bg-[#F9FAFB]">
                                            <td className="p-4 font-bold text-[#111827]">
                                                {row.topic || <span className="text-gray-300 italic">No Topic</span>}
                                                {row.subtopic && <span className="block text-xs font-medium text-gray-400 mt-0.5">{row.subtopic}</span>}
                                            </td>
                                            <td className="p-4 text-center font-semibold">{row.quantity}</td>
                                            <td className="p-4"><span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-gray-100 text-gray-600`}>{row.difficulty}</span></td>
                                            <td className="p-4 text-gray-500 font-medium">{row.format}</td>
                                        </tr>
                                    ))}
                                </tbody>
                             </table>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-[#E5E7EB] bg-[#F9FAFB] flex justify-end">
                    <button onClick={onClose} className="px-8 py-3 bg-[#111827] text-white rounded-xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
                        Close Preview
                    </button>
                </div>
            </motion.div>
        </div>
    );
};