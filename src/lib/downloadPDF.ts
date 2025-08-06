import { jsPDF } from "jspdf";

export const downloadPDF = (text: string, filename = "Test.pdf") => {
  const doc = new jsPDF();
  const lines = text.split("\n");
  let y = 20;

  lines.forEach((line) => {
    doc.text(line, 10, y);
    y += 10;
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
  });

  doc.save(filename);
};
