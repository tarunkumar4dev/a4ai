import React, { useRef, memo, useCallback, forwardRef } from "react";
import { useFieldArray, useFormContext, UseFormSetValue, UseFormWatch, FieldValues } from "react-hook-form";
import { GripVertical, Paperclip, Trash2, PlusCircle, Check, FileText, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ==================== TYPES ====================
interface SimpleRowData {
  id: string;
  topic: string;
  subtopic?: string;
  quantity: number;
  difficulty: "Easy" | "Medium" | "Hard" | "Mixed";
  format: "PDF" | "DOC";
  refFile?: File;
}

interface RefUploadButtonProps {
  index: number;
  setValue: UseFormSetValue<FieldValues>;
  watch: UseFormWatch<FieldValues>;
}

interface TableRowProps {
  index: number;
  field: { id: string };
  availableTopics: string[];
  remove: (index: number) => void;
}

interface FormValues {
  subject: string;
  useNCERT: boolean;
  ncertChapters: string[];
  simpleData: SimpleRowData[];
}

// ==================== DATA CONFIG ====================
const SUBJECT_TOPICS: Record<string, string[]> = {
  "Science": [
    "Chemical Reactions & Equations", "Acids, Bases & Salts", "Metals & Non-metals",
    "Carbon & Its Compounds", "Periodic Classification", "Life Processes",
    "Control & Coordination", "How do Organisms Reproduce", "Heredity & Evolution",
    "Light - Reflection & Refraction", "Human Eye & Colorful World", "Electricity",
    "Magnetic Effects of Electric Current", "Our Environment"
    
  ],
  "Physics": [
    "Electricity", "Magnetic Effects of Electric Current", "Light - Reflection & Refraction",
    "Human Eye & Colorful World", "Sources of Energy", "Motion", "Force & Laws of Motion",
    "Gravitation", "Work & Energy", "Sound", "Thermal Properties"
  ],
  "Chemistry": [
    "Chemical Reactions & Equations", "Acids, Bases & Salts", "Metals & Non-metals",
    "Carbon & Its Compounds", "Periodic Classification", "Matter in Our Surroundings",
    "Is Matter Around Us Pure", "Atoms & Molecules", "Structure of Atom"
  ],
  "Biology": [
    "Life Processes", "Control & Coordination", "How do Organisms Reproduce",
    "Heredity & Evolution", "Our Environment", "Management of Natural Resources",
    "Diversity in Living Organisms", "Tissues", "Why do We Fall Ill"
  ],
  "Math": [
    "Real Numbers", "Polynomials", "Pair of Linear Equations", "Quadratic Equations",
    "Arithmetic Progressions", "Triangles", "Coordinate Geometry", "Introduction to Trigonometry",
    "Some Applications of Trigonometry", "Circles", "Constructions", "Areas Related to Circles",
    "Surface Areas & Volumes", "Statistics", "Probability"
  ],
  "Social Science": [
    "The Rise of Nationalism in Europe", "Nationalism in India", "The Making of a Global World",
    "The Age of Industrialisation", "Print Culture & Modern World", "Resources & Development",
    "Forest & Wildlife Resources", "Water Resources", "Agriculture", "Minerals & Energy Resources",
    "Manufacturing Industries", "Lifelines of National Economy", "Power Sharing", "Federalism",
    "Democracy & Diversity", "Gender, Religion & Caste", "Popular Struggles & Movements",
    "Political Parties", "Outcomes of Democracy", "Development", "Sectors of Indian Economy",
    "Money & Credit", "Globalisation & Indian Economy", "Consumer Rights"
  ]
};

const COMMON_SUBTOPICS: Record<string, string[]> = {
  "Chemical Reactions & Equations": ["Chemical reactions", "Balanced chemical equations", "Types of reactions", "Oxidation and reduction", "Corrosion and rancidity"],
  "Acids, Bases & Salts": ["Properties of acids and bases", "pH scale", "Common salts", "Uses of acids, bases and salts"],
  "Metals & Non-metals": ["Physical and chemical properties", "Reactivity series", "Extraction of metals", "Corrosion and prevention"],
  "Carbon & Its Compounds": ["Covalent bonding", "Homologous series", "Functional groups", "Ethanol and ethanoic acid", "Soaps and detergents"],
  "Periodic Classification": ["Mendeleev's table", "Modern periodic table", "Trends in periodic table"],
  "Light - Reflection & Refraction": ["Reflection by mirrors", "Refraction", "Lenses", "Power of lens"],
  "Human Eye & Colorful World": ["Structure of eye", "Defects of vision", "Dispersion and scattering of light"],
  "Electricity": ["Electric current", "Ohm's law", "Resistance", "Electric power"],
  "Magnetic Effects of Electric Current": ["Magnetic field", "Electric motor", "Electromagnetic induction", "Generator"],
  "Life Processes": ["Nutrition", "Respiration", "Transportation", "Excretion"],
  "Control & Coordination": ["Nervous system", "Hormonal coordination", "Endocrine glands"],
  "How do Organisms Reproduce": ["Asexual reproduction", "Sexual reproduction", "Reproductive health"],
  "Heredity & Evolution": ["Mendel's experiments", "Inheritance of traits", "Evolution and speciation"],
  "Our Environment": ["Ecosystem", "Food chains", "Energy flow", "Pollution","Renewable and non-renewable sources", "Solar, wind, biogas, nuclear energy","Conservation", "Forest and wildlife", "Water resources", "Sustainable development"],
  
};

// ==================== UUID GENERATOR ====================
const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// ==================== FIXED FILE UPLOAD HANDLER ====================
const RefUploadButton: React.FC<RefUploadButtonProps> = memo(({ index, setValue, watch }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const file = watch(`simpleData.${index}.refFile`);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    
    // FIX: Reset input value to allow same file re-upload
    if (fileRef.current) {
      fileRef.current.value = '';
    }
    
    if (selectedFile) {
      setValue(`simpleData.${index}.refFile`, selectedFile);
    } else {
      setValue(`simpleData.${index}.refFile`, undefined);
    }
  }, [index, setValue]);

  const handleButtonClick = useCallback(() => {
    if (fileRef.current) {
      fileRef.current.click();
    }
  }, []);

  const handleClearFile = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setValue(`simpleData.${index}.refFile`, undefined);
  }, [index, setValue]);

  return (
    <div className="relative">
      <input 
        type="file" 
        ref={fileRef} 
        className="hidden" 
        onChange={handleFileChange}
        accept=".pdf,.doc,.docx,.txt,.md"
        aria-label={`Upload reference file for row ${index + 1}`}
      />
      <motion.button 
        whileHover={{ scale: 1.05 }} 
        whileTap={{ scale: 0.95 }}
        type="button" 
        onClick={handleButtonClick}
        className={`p-2.5 rounded-xl transition-all border shadow-sm ${
          file 
            ? 'bg-gray-800 text-white border-gray-800 hover:bg-gray-900' 
            : 'bg-white text-gray-400 border-[#E5E7EB] hover:border-gray-400 hover:text-gray-600'
        }`}
        title={file ? `Reference: ${file.name}` : "Upload Reference"}
        aria-label={file ? `Change reference file ${file.name}` : "Add reference file"}
      >
        <div className="flex items-center gap-2">
          {file ? <Check size={16} /> : <Paperclip size={16} />}
          {file && (
            <span className="text-xs max-w-[80px] truncate">
              {file.name.length > 10 ? `${file.name.substring(0, 8)}...` : file.name}
            </span>
          )}
        </div>
      </motion.button>
      
      {file && (
        <button
          type="button"
          onClick={handleClearFile}
          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
          aria-label={`Remove reference file ${file.name}`}
        >
          ×
        </button>
      )}
    </div>
  );
});

RefUploadButton.displayName = 'RefUploadButton';

// ==================== FORWARD REF TABLE ROW FOR ANIMATIONS ====================
const TableRow = memo(forwardRef<HTMLTableRowElement, TableRowProps>(({ 
  index, 
  field, 
  availableTopics, 
  remove 
}, ref) => {
  const { register, watch, setValue } = useFormContext<FormValues>();
  const currentTopic = watch(`simpleData.${index}.topic`);
  const subOptions = COMMON_SUBTOPICS[currentTopic] || 
    (currentTopic?.includes("Electricity") ? COMMON_SUBTOPICS["Electricity"] : []) ||
    (currentTopic?.includes("Carbon") ? COMMON_SUBTOPICS["Carbon & Its Compounds"] : []) ||
    [];
  
  const rowNumber = index + 1;

  return (
    <motion.tr 
      ref={ref}
      initial={{ opacity: 0, x: -20 }} 
      animate={{ opacity: 1, x: 0 }} 
      exit={{ opacity: 0, x: 20, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 120 }}
      className="group hover:bg-[#F9FAFB] transition-colors"
      layout // FIX: Enables proper layout animations
    >
      <td className="py-3 px-6 text-center">
        <GripVertical 
          size={16} 
          className="text-gray-300 cursor-grab hover:text-gray-600 transition-colors" 
          aria-label={`Drag to reorder row ${rowNumber}`}
        />
      </td>
      
      <td className="py-3 px-4">
        <div className="flex flex-col gap-2">
          <select 
            {...register(`simpleData.${index}.topic`, { 
              required: "Topic is required" 
            })}
            className="w-full bg-transparent text-sm font-bold text-[#111827] outline-none border-b border-dashed border-gray-300 focus:border-gray-500 py-1 cursor-pointer appearance-none hover:text-gray-600"
            aria-label={`Select topic for row ${rowNumber}`}
          >
            <option value="">Select Chapter/Topic...</option>
            {availableTopics.map(topic => (
              <option key={topic} value={topic}>{topic}</option>
            ))}
          </select>
          
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#E5E7EB] group-hover:bg-gray-400 transition-colors" aria-hidden="true" />
            <select 
              {...register(`simpleData.${index}.subtopic`)}
              className="w-full bg-transparent text-xs font-semibold text-gray-500 outline-none cursor-pointer disabled:opacity-50 hover:text-gray-700 appearance-none"
              disabled={!currentTopic}
              aria-label={`Select subtopic for ${currentTopic || 'topic'} in row ${rowNumber}`}
            >
              <option value="">Select Subtopic (Optional)...</option>
              {subOptions.map(subtopic => (
                <option key={subtopic} value={subtopic}>{subtopic}</option>
              ))}
            </select>
          </div>
        </div>
      </td>
      
      <td className="py-3 px-4 text-center">
        <input 
          type="number" 
          {...register(`simpleData.${index}.quantity`, { 
            valueAsNumber: true,
            min: { value: 1, message: "Minimum 1 question" },
            max: { value: 50, message: "Maximum 50 questions" },
            required: "Quantity is required"
          })}
          className="w-16 bg-[#F3F4F6] border-none rounded-xl py-2 text-center text-sm font-bold text-[#111827] focus:ring-2 focus:ring-gray-400/20 transition-all outline-none" 
          aria-label={`Number of questions for row ${rowNumber}`}
        />
      </td>
      
      <td className="py-3 px-4">
        <select 
          {...register(`simpleData.${index}.difficulty`)} 
          className="w-full bg-white border border-[#E5E7EB] text-xs font-bold text-gray-600 rounded-xl py-2 px-3 outline-none cursor-pointer hover:border-gray-400 transition-colors shadow-sm appearance-none"
          aria-label={`Select difficulty for row ${rowNumber}`}
        >
          <option value="Easy">Easy</option>
          <option value="Medium">Medium</option>
          <option value="Hard">Hard</option>
          <option value="Mixed">Mixed</option>
        </select>
      </td>
      
      <td className="py-3 px-4">
        <div className="inline-flex bg-[#F3F4F6] p-1 rounded-xl" role="presentation">
          <div className="px-3 py-1.5 text-[10px] font-bold bg-gray-800 shadow-sm rounded-lg text-white flex items-center gap-1.5 border border-gray-800">
            <FileText size={10} aria-hidden="true" /> PDF
          </div>
        </div>
      </td>
      
      <td className="py-3 px-4 text-center">
        <RefUploadButton index={index} setValue={setValue} watch={watch} />
      </td>
      
      <td className="py-3 px-4 text-center">
        <motion.button 
          whileHover={{ scale: 1.1 }} 
          whileTap={{ scale: 0.9 }} 
          type="button" 
          onClick={() => remove(index)} 
          className="p-2 rounded-full bg-white border border-transparent hover:border-red-100 hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all shadow-sm"
          aria-label={`Remove row ${rowNumber}`}
        >
          <Trash2 size={16} aria-hidden="true" />
        </motion.button>
      </td>
    </motion.tr>
  );
}));

TableRow.displayName = 'TableRow';

// ==================== SIMPLE MODE VIEW ====================
const SimpleModeView: React.FC = () => {
  const { control, watch } = useFormContext<FormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "simpleData",
  });

  const currentSubject = watch("subject") || "Science";
  const useNCERT = watch("useNCERT");
  const ncertChapters = watch("ncertChapters") || [];

  const getTopicsForSubject = useCallback((): string[] => {
    if (useNCERT && ncertChapters.length > 0) {
      return ncertChapters;
    }
    return SUBJECT_TOPICS[currentSubject] || SUBJECT_TOPICS["Science"];
  }, [currentSubject, useNCERT, ncertChapters]);

  const availableTopics = getTopicsForSubject();

  const handleAddRow = useCallback(() => {
    append({
      id: generateUUID(),
      topic: "",
      quantity: 5,
      difficulty: "Medium",
      format: "PDF",
    });
  }, [append]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.3 }}
      className="bg-white rounded-[24px] shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-white/50 backdrop-blur-sm p-2"
    >
      {/* Info Banner */}
      <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 rounded-t-[22px]">
        <div className="flex items-center gap-2 text-sm text-blue-800">
          <BookOpen size={16} aria-hidden="true" />
          <div>
            <span className="font-semibold">Subject:</span> {currentSubject}
            {useNCERT && ncertChapters.length > 0 && (
              <span className="ml-3">
                <span className="font-semibold">NCERT Chapters:</span> {ncertChapters.slice(0, 3).join(", ")}
                {ncertChapters.length > 3 && ` +${ncertChapters.length - 3} more`}
              </span>
            )}
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <caption className="sr-only">Test configuration table with chapters and questions</caption>
          <thead>
            <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-[#F3F4F6]">
              <th scope="col" className="py-4 px-6 w-12 text-center" aria-label="Drag handle"></th>
              <th scope="col" className="py-4 px-4">Chapter & Topics</th>
              <th scope="col" className="py-4 px-4 w-28 text-center">Quantity</th>
              <th scope="col" className="py-4 px-4 w-40">Difficulty</th>
              <th scope="col" className="py-4 px-4 w-28">Format</th>
              <th scope="col" className="py-4 px-4 w-20 text-center">Reference</th>
              <th scope="col" className="py-4 px-4 w-12 text-center" aria-label="Actions"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            <AnimatePresence>
              {fields.map((field, index) => (
                <TableRow
                  key={field.id}
                  index={index}
                  field={field}
                  availableTopics={availableTopics}
                  remove={remove}
                />
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
      
      <motion.button 
        whileHover={{ backgroundColor: "#F3F4F6" }} 
        whileTap={{ scale: 0.99 }}
        type="button" 
        onClick={handleAddRow}
        className="w-full py-5 mt-2 bg-[#F9FAFB] text-sm font-bold text-gray-400 hover:text-gray-600 rounded-b-[22px] flex items-center justify-center gap-2 transition-all group"
        aria-label="Add new chapter section"
      >
        <PlusCircle size={18} className="group-hover:scale-110 transition-transform" aria-hidden="true" /> 
        Add Chapter Section
      </motion.button>
    </motion.div>
  );
};

// ==================== MAIN COMPONENT ====================
export const TestRowEditor = ({ activeMode }: { activeMode: string }) => {
  if (activeMode !== "Simple") {
    return (
      <div 
        className="p-16 text-center text-gray-400 font-bold bg-white rounded-[24px] border border-white shadow-sm"
        aria-live="polite"
      >
        Coming Soon
      </div>
    );
  }
  
  return <SimpleModeView />;
};