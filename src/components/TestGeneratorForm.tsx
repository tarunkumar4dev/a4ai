import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { TestFormValues } from "@/utils/testGeneratorOptions";
import { Loader2 } from "lucide-react";

import TestFormSection from "./TestFormSection";
import ErrorMessage from "./ErrorMessage";
import GeneratedTest from "./GeneratedTest";

interface TestGeneratorFormProps {
  onGenerate: (formData: {
    subject: string;
    topic?: string;
    difficulty: string;
    questionType: string;
    questionCount: number;
    outputFormat: string;
    additionalRequirements?: string;
  }) => Promise<{
    test: string;
    provider: string;
  }>;
}

const TestGeneratorForm = ({ onGenerate }: TestGeneratorFormProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [generatedTest, setGeneratedTest] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);

  const [formValues, setFormValues] = useState<TestFormValues>({
    subject: "",
    topic: "",
    difficulty: "",
    questionType: "",
    questionCount: "",
    outputFormat: "plain text",
    additionalRequirements: "",
  });

  const handleChange = (field: string, value: string) => {
    setFormValues({ ...formValues, [field]: value });
    if (error) setError(null);
  };

  const isFormValid =
    formValues.subject &&
    formValues.difficulty &&
    formValues.questionType &&
    formValues.questionCount &&
    formValues.outputFormat;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setIsLoading(true);
    setGeneratedTest("");
    setError(null);
    setProvider(null);

    try {
      toast({
        title: "Test Generation Started",
        description: "Your test paper is being generated. Please wait...",
      });

      const formData = {
        subject: formValues.subject,
        topic: formValues.topic || undefined,
        difficulty: formValues.difficulty,
        questionType: formValues.questionType,
        questionCount: parseInt(formValues.questionCount),
        outputFormat: formValues.outputFormat,
        additionalRequirements: formValues.additionalRequirements || undefined,
      };

      console.log("Form Data Sent:", formData);

      const result = await onGenerate(formData);

      if (result?.test) {
        setGeneratedTest(result.test);
        setProvider(result.provider || null);

        toast({
          title: "✅ Test Generated",
          description: "Your test has been generated successfully!",
        });
      } else {
        throw new Error("No test content received.");
      }
    } catch (err: any) {
      console.error("Test generation error:", err);
      const errorMessage =
        err?.message || "Something went wrong while generating the test.";
      setError(errorMessage);
      toast({
        title: "❌ Test generation failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    setIsLoading(false);
    setGeneratedTest("");
    setProvider(null);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        <TestFormSection formValues={formValues} handleChange={handleChange} />

        <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
          <Button
            type="submit"
            className={`w-full sm:w-auto min-w-[200px] transition-all ${
              !isFormValid || isLoading
                ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white shadow-md"
            }`}
            disabled={!isFormValid || isLoading}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </div>
            ) : (
              "Generate Test Paper"
            )}
          </Button>

          <p className="text-sm text-gray-500 text-center sm:text-left">
            This will use 1 of your 10 free generations this month
          </p>
        </div>
      </form>

      {error && (
        <ErrorMessage
          error={error}
          onRetry={handleRetry}
          isLoading={isLoading}
        />
      )}

      {generatedTest && !error && (
        <GeneratedTest
          generatedTest={generatedTest}
          provider={provider}
          subject={formValues.subject}
        />
      )}
    </div>
  );
};

export default TestGeneratorForm;
