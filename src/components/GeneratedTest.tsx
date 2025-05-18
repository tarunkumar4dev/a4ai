
import { Button } from "@/components/ui/button";
import { Copy, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { downloadTestFile } from "@/utils/testGeneratorService";

interface GeneratedTestProps {
  generatedTest: string;
  provider: string | null;
  subject: string;
}

const GeneratedTest = ({ generatedTest, provider, subject }: GeneratedTestProps) => {
  const { toast } = useToast();
  
  const handleCopy = () => {
    navigator.clipboard.writeText(generatedTest);
    toast({
      title: "Copied to clipboard",
      description: "The test content has been copied to your clipboard"
    });
  };
  
  const handleDownload = () => {
    downloadTestFile(generatedTest, subject);
    toast({
      title: "Test Downloaded",
      description: "Your test has been downloaded successfully."
    });
  };
  
  return (
    <div className="mt-8 p-6 border rounded-lg bg-white">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Generated Test</h3>
        {provider === "openai" && (
          <span className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
            Generated with OpenAI (Fallback)
          </span>
        )}
      </div>
      <div className="whitespace-pre-wrap bg-gray-50 p-4 rounded-md max-h-[500px] overflow-y-auto">
        {generatedTest}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={handleCopy}
        >
          <Copy className="mr-2 h-4 w-4" /> Copy Text
        </Button>
        <Button onClick={handleDownload}>
          <FileDown className="mr-2 h-4 w-4" /> Download
        </Button>
      </div>
    </div>
  );
};

export default GeneratedTest;
