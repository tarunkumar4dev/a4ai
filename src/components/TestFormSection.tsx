import { useState } from "react";
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
  TestFormValues
} from "@/utils/testGeneratorOptions";

interface TestFormSectionProps {
  formValues: TestFormValues;
  handleChange: (field: string, value: string) => void;
}

const TestFormSection = ({ formValues, handleChange }: TestFormSectionProps) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label htmlFor="subject" className="text-sm font-medium">
            Subject
          </label>
          <Select 
            onValueChange={(value) => handleChange("subject", value)}
            required
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
        
        <div className="space-y-2">
          <label htmlFor="difficulty" className="text-sm font-medium">
            Difficulty Level
          </label>
          <Select 
            onValueChange={(value) => handleChange("difficulty", value)}
            required
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
            onValueChange={(value) => handleChange("questionType", value)}
            required
          >
            <SelectTrigger id="questionType" className="w-full">
              <SelectValue placeholder="Select question type" />
            </SelectTrigger>
            <SelectContent>
              {questionTypes.map((type) => (
                <SelectItem key={type} value={type.toLowerCase().replace(/\s+/g, "-")}>
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
            onValueChange={(value) => handleChange("questionCount", value)}
            required
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
        
        <div className="space-y-2">
          <label htmlFor="outputFormat" className="text-sm font-medium">
            Output Format
          </label>
          <Select 
            onValueChange={(value) => handleChange("outputFormat", value)}
            required
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