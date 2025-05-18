
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorMessageProps {
  error: string;
  onRetry: () => void;
  isLoading: boolean;
}

const ErrorMessage = ({ error, onRetry, isLoading }: ErrorMessageProps) => {
  // Custom error message for API account balance issues
  const displayError = error === "API account has insufficient balance. Please check your DeepSeek subscription." 
    ? "The AI service is currently unavailable. Please try again later or contact support if the problem persists." 
    : error;
    
  return (
    <div className="mt-8">
      <Alert variant="destructive" className="bg-red-50 border-red-200">
        <AlertCircle className="h-5 w-5" />
        <AlertTitle>Generation Failed</AlertTitle>
        <AlertDescription className="mt-2">
          {displayError}
        </AlertDescription>
        <div className="mt-4">
          <Button 
            variant="outline" 
            className="bg-white hover:bg-gray-50" 
            onClick={onRetry}
            disabled={isLoading}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Try Again
          </Button>
        </div>
      </Alert>
    </div>
  );
};

export default ErrorMessage;
