
import { supabase } from "@/integrations/supabase/client";
import { TestFormValues } from "./testGeneratorOptions";

export async function generateTest(formValues: TestFormValues) {
  const { data, error: functionError } = await supabase.functions.invoke('generate-test', {
    body: formValues
  });
  
  if (functionError) {
    throw new Error(functionError.message);
  }
  
  if (data.error) {
    throw new Error(data.error);
  }
  
  return data;
}

export function downloadTestFile(generatedTest: string, subject: string) {
  const element = document.createElement("a");
  const file = new Blob([generatedTest], {type: 'text/plain'});
  element.href = URL.createObjectURL(file);
  element.download = `test-${subject || 'generated'}-${new Date().toISOString().split('T')[0]}.txt`;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}
