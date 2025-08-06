import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  subjects,
  difficulties,
  questionTypes,
  questionCounts,
  outputFormats,
  TestFormValues,
} from "@/utils/testGeneratorOptions";

interface TestFormSectionProps {
  formValues: TestFormValues;
  handleChange: (field: string, value: string) => void;
}

const TestFormSection = ({ formValues, handleChange }: TestFormSectionProps) => {
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

        {/* Difficulty */}
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

        {/* Question Type */}
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

        {/* Question Count */}
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
      </div>

      {/* Additional Requirements */}
      <div className="space-y-2">
        <label htmlFor="additionalRequirements" className="text-sm font-medium">
          Additional Requirements (Optional)
        </label>
        <Textarea
          id="additionalRequirements"
          placeholder="Any specific requirements or notes for the test paper"
          value={formValues.additionalRequirements}
          onChange={(e) =>
            handleChange("additionalRequirements", e.target.value)
          }
          rows={4}
        />
      </div>
    </div>
  );
};

export default TestFormSection;
