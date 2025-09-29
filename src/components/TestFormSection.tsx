import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  subjects,
  difficulties,
  questionTypes,
  questionCounts,
  outputFormats,
  TestFormValues,
} from "@/utils/testGeneratorOptions";

/* ---------------------- Local helpers (sections) ---------------------- */
type Section = {
  id: string; // "A" | "B" | "C" | "D" | ...
  marksPerQuestion: 1 | 2 | 3 | 4;
  count: number;
  difficultyMix: { easy: number; medium: number; hard: number };
};

const nextId = (arr: Section[]) => {
  const base = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const used = new Set(arr.map((s) => s.id));
  for (let i = 0; i < base.length; i++) {
    const ch = base[i];
    if (!used.has(ch)) return ch;
  }
  return String(arr.length + 1);
};

const makeDefaultSection = (id: string, marks: 1 | 2 | 3 | 4, count = 5): Section => ({
  id,
  marksPerQuestion: marks,
  count,
  difficultyMix: { easy: 40, medium: 40, hard: 20 },
});

interface TestFormSectionProps {
  formValues: TestFormValues;
  handleChange: (field: string, value: string) => void;
}

const TestFormSection = ({ formValues, handleChange }: TestFormSectionProps) => {
  /* --------------------------- Section Mode --------------------------- */
  const sectionModeOn = formValues.sectionMode === "on";
  const initialSections: Section[] = useMemo(() => {
    try {
      return formValues.sectionsJSON ? (JSON.parse(formValues.sectionsJSON) as Section[]) : [];
    } catch {
      return [];
    }
  }, [formValues.sectionsJSON]);

  const [sections, setSections] = useState<Section[]>(
    initialSections.length
      ? initialSections
      : [
          makeDefaultSection("A", 1, 6),
          makeDefaultSection("B", 2, 4),
          makeDefaultSection("C", 3, 3),
          makeDefaultSection("D", 4, 2),
        ]
  );

  const totalMarks = useMemo(
    () => sections.reduce((sum, s) => sum + s.count * s.marksPerQuestion, 0),
    [sections]
  );

  const syncSectionsToParent = (next: Section[]) => {
    setSections(next);
    handleChange("sectionsJSON", JSON.stringify(next)); // parent expects string
  };

  /* ------------------------------ Render ------------------------------ */
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Subject */}
        <div className="space-y-2">
          <label htmlFor="subject" className="text-sm font-medium">
            Subject
          </label>
          <Select
            value={formValues.subject}
            onValueChange={(value) => handleChange("subject", value)}
          >
            <SelectTrigger id="subject" className="w-full">
              <SelectValue placeholder="Select subject" />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((subject) => (
                <SelectItem key={subject} value={subject.toLowerCase()}>
                  {subject}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Topic */}
        <div className="space-y-2">
          <label htmlFor="topic" className="text-sm font-medium">
            Topic (Optional)
          </label>
          <Input
            id="topic"
            placeholder="e.g., Algebra, Newton's Laws"
            value={formValues.topic}
            onChange={(e) => handleChange("topic", e.target.value)}
          />
        </div>

        {/* Output Format */}
        <div className="space-y-2">
          <label htmlFor="outputFormat" className="text-sm font-medium">
            Output Format
          </label>
          <Select
            value={formValues.outputFormat}
            onValueChange={(value) => handleChange("outputFormat", value)}
          >
            <SelectTrigger id="outputFormat" className="w-full">
              <SelectValue placeholder="Select output format" />
            </SelectTrigger>
            <SelectContent>
              {outputFormats.map((format) => (
                <SelectItem key={format} value={format.toLowerCase()}>
                  {format}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ======= Mode Toggle ======= */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Mode</label>
          <Select
            value={formValues.sectionMode ?? "off"}
            onValueChange={(v) => handleChange("sectionMode", v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="off">Simple (Single Type)</SelectItem>
              <SelectItem value="on">Advanced (Sections)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ======= Simple Mode (legacy) ======= */}
        {!sectionModeOn && (
          <>
            <div className="space-y-2">
              <label htmlFor="difficulty" className="text-sm font-medium">
                Difficulty Level
              </label>
              <Select
                value={formValues.difficulty}
                onValueChange={(value) => handleChange("difficulty", value)}
              >
                <SelectTrigger id="difficulty" className="w-full">
                  <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent>
                  {difficulties.map((difficulty) => (
                    <SelectItem key={difficulty} value={difficulty.toLowerCase()}>
                      {difficulty}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor="questionType" className="text-sm font-medium">
                Question Type
              </label>
              <Select
                value={formValues.questionType}
                onValueChange={(value) => handleChange("questionType", value)}
              >
                <SelectTrigger id="questionType" className="w-full">
                  <SelectValue placeholder="Select question type" />
                </SelectTrigger>
                <SelectContent>
                  {questionTypes.map((type) => (
                    <SelectItem
                      key={type}
                      value={type.toLowerCase().replace(/\s+/g, "-")}
                    >
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor="questionCount" className="text-sm font-medium">
                Number of Questions
              </label>
              <Select
                value={formValues.questionCount}
                onValueChange={(value) => handleChange("questionCount", value)}
              >
                <SelectTrigger id="questionCount" className="w-full">
                  <SelectValue placeholder="Select count" />
                </SelectTrigger>
                <SelectContent>
                  {questionCounts.map((count) => (
                    <SelectItem key={count} value={count}>
                      {count}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>

      {/* ======= Advanced Mode: Sections ======= */}
      {sectionModeOn && (
        <div className="rounded-xl border p-4 space-y-3">
          <div className="font-semibold">Sections & Difficulty</div>
          <div className="grid gap-3">
            {sections.map((sec, i) => (
              <div key={sec.id} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-1 text-sm font-medium">Sec {sec.id}</div>

                <div className="col-span-2">
                  <Label>Marks/Q</Label>
                  <Select
                    value={String(sec.marksPerQuestion)}
                    onValueChange={(v) => {
                      const mpq = Number(v) as 1 | 2 | 3 | 4;
                      const copy = sections.slice();
                      copy[i] = { ...sec, marksPerQuestion: mpq };
                      syncSectionsToParent(copy);
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="4">4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <Label>Count</Label>
                  <Input
                    type="number"
                    min={1}
                    value={sec.count}
                    onChange={(e) => {
                      const val = Math.max(1, Number(e.target.value || 1));
                      const copy = sections.slice();
                      copy[i] = { ...sec, count: val };
                      syncSectionsToParent(copy);
                    }}
                  />
                </div>

                <div className="col-span-2">
                  <Label>Easy %</Label>
                  <Input
                    type="number"
                    value={sec.difficultyMix.easy}
                    onChange={(e) => {
                      const copy = sections.slice();
                      copy[i] = {
                        ...sec,
                        difficultyMix: {
                          ...sec.difficultyMix,
                          easy: Number(e.target.value || 0),
                        },
                      };
                      syncSectionsToParent(copy);
                    }}
                  />
                </div>

                <div className="col-span-2">
                  <Label>Medium %</Label>
                  <Input
                    type="number"
                    value={sec.difficultyMix.medium}
                    onChange={(e) => {
                      const copy = sections.slice();
                      copy[i] = {
                        ...sec,
                        difficultyMix: {
                          ...sec.difficultyMix,
                          medium: Number(e.target.value || 0),
                        },
                      };
                      syncSectionsToParent(copy);
                    }}
                  />
                </div>

                <div className="col-span-2">
                  <Label>Hard %</Label>
                  <Input
                    type="number"
                    value={sec.difficultyMix.hard}
                    onChange={(e) => {
                      const copy = sections.slice();
                      copy[i] = {
                        ...sec,
                        difficultyMix: {
                          ...sec.difficultyMix,
                          hard: Number(e.target.value || 0),
                        },
                      };
                      syncSectionsToParent(copy);
                    }}
                  />
                </div>

                <div className="col-span-1 flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const copy = sections.slice();
                      copy.splice(i, 1);
                      syncSectionsToParent(copy.length ? copy : [makeDefaultSection("A", 1, 5)]);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-sm opacity-70">Total Marks (auto): {totalMarks}</div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => syncSectionsToParent([...sections, makeDefaultSection(nextId(sections), 1, 5)])}
              >
                + Add Section
              </Button>
              <Button
                type="button"
                onClick={() => {
                  // push computed total to parent for PDF header
                  handleChange("computedTotalMarks", String(totalMarks));
                }}
              >
                Update Total
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Additional Requirements */}
      <div className="space-y-2">
        <label htmlFor="additionalRequirements" className="text-sm font-medium">
          Additional Requirements (Optional)
        </label>
        <Textarea
          id="additionalRequirements"
          placeholder="Any specific requirements or notes for the test paper"
          value={formValues.additionalRequirements}
          onChange={(e) => handleChange("additionalRequirements", e.target.value)}
          rows={4}
        />
      </div>
    </div>
  );
};

export default TestFormSection;
