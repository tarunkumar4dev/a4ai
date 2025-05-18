
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { TestFormValues } from "@/utils/testGeneratorOptions";
import { generateTest } from "@/utils/testGeneratorService";
import TestFormSection from "./TestFormSection";
import ErrorMessage from "./ErrorMessage";
import GeneratedTest from "./GeneratedTest";

const TestGeneratorForm = () => {
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
    outputFormat: "",
    additionalRequirements: "",
  });

  const handleChange = (field: string, value: string) => {
    setFormValues({ ...formValues, [field]: value });
    // Clear error when user starts changing fields after an error
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setGeneratedTest("");
    setError(null);
    setProvider(null);
    
    try {
      toast({
        title: "Test Generation Started",
        description: "Your test paper is being generated. This may take a moment.",
      });
      
      const data = await generateTest(formValues);
      
      setGeneratedTest(data.test);
      setProvider(data.provider || null);
      
      toast({
        title: "Test Generated Successfully",
        description: data.provider === "openai" 
          ? "Your test was generated using OpenAI as a fallback." 
          : "Your test paper is ready to view and download.",
      });
    } catch (err) {
      console.error("Test generation error:", err);
      const errorMessage = err instanceof Error ? err.message : "There was an error generating your test. Please try again.";
      setError(errorMessage);
      toast({
        title: "Generation Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    handleSubmit(new Event('submit') as any);
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-6">
        <TestFormSection 
          formValues={formValues}
          handleChange={handleChange}
        />
        
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Button 
            type="submit" 
            className="w-full sm:w-auto bg-zolvio-purple hover:bg-zolvio-purple-hover"
            disabled={isLoading}
          >
            {isLoading ? "Generating..." : "Generate Test Paper"}
          </Button>
          <p className="text-sm text-gray-500">
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
