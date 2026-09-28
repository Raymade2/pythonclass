"use client";

// Client-side PDF helpers built on jsPDF. Dynamically imported to keep the
// initial bundle small.

type TableSpec = {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: (string | number)[][];
};

export async function exportTableToPdf(spec: TableSpec, filename: string): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: spec.columns.length > 6 ? "landscape" : "portrait" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("SURE FOUNDATION GROUP OF SCHOOLS", 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text("School Fee Management System", 14, 22);
  doc.setFontSize(12);
  doc.setTextColor(20);
  doc.text(spec.title, 14, 32);
  if (spec.subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(spec.subtitle, 14, 38);
  }

  autoTable(doc, {
    startY: spec.subtitle ? 44 : 38,
    head: [spec.columns],
    body: spec.rows.map((r) => r.map((c) => String(c))),
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    headStyles: { fillColor: [11, 26, 75], textColor: 255 },
    alternateRowStyles: { fillColor: [244, 247, 252] },
    margin: { left: 14, right: 14 },
  });

  doc.save(filename);
}

export type ReceiptPdfData = {
  school: { name: string; address: string; phone: string; email: string };
  receiptNumber: string;
  paymentReference: string;
  transactionReference: string | null;
  paymentDate: string;
  method: string;
  studentName: string;
  studentCode: string;
  className: string;
  session: string;
  term: string;
  invoiceNumber: string | null;
  description: string;
  amountPaid: number;
  previousBalance: number;
  remainingBalance: number;
  totalPaid: number;
  invoiceTotal: number;
  authorizedBy: string;
};

export async function exportReceiptToPdf(d: ReceiptPdfData): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a5" });
  const W = doc.internal.pageSize.getWidth();

  doc.setFillColor(11, 26, 75);
  doc.rect(0, 0, W, 4, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(11, 26, 75);
  doc.text(d.school.name.toUpperCase(), W / 2, 16, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(80);
  doc.text(d.school.address, W / 2, 21.5, { align: "center" });
  doc.text(`Tel: ${d.school.phone}  ·  ${d.school.email}`, W / 2, 26, { align: "center" });

  doc.setDrawColor(11, 26, 75);
  doc.setLineWidth(0.6);
  doc.line(14, 29, W - 14, 29);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(11, 26, 75);
  doc.text("OFFICIAL PAYMENT RECEIPT", W / 2, 36, { align: "center" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40);
  const rows: [string, string][] = [
    ["Receipt No.", d.receiptNumber],
    ["Payment Date", d.paymentDate],
    ["Student", d.studentName],
    ["Student ID", d.studentCode],
    ["Class", d.className],
    ["Session / Term", `${d.session} · ${d.term}`],
    ["Invoice", d.invoiceNumber ?? "—"],
    ["Payment Reference", d.paymentReference],
    ...(d.transactionReference ? ([["Transaction Ref.", d.transactionReference]] as [string, string][]) : []),
    ["Payment Method", d.method],
    ["Description", d.description],
  ];

  autoTable(doc, {
    startY: 40,
    body: rows,
    theme: "plain",
    styles: { fontSize: 8.5, cellPadding: 1.6 },
    columnStyles: { 0: { fontStyle: "bold", textColor: [80, 80, 80], cellWidth: 42 } },
    margin: { left: 14, right: 14 },
  });

  // @ts-expect-error lastAutoTable is attached by the plugin
  const afterRowsY = (doc.lastAutoTable?.finalY ?? 90) + 4;

  autoTable(doc, {
    startY: afterRowsY,
    head: [["", "Amount (₦)"]],
    body: [
      ["Amount Paid", d.amountPaid.toLocaleString("en-NG")],
      ["Previous Balance", d.previousBalance.toLocaleString("en-NG")],
      ["Remaining Balance", d.remainingBalance.toLocaleString("en-NG")],
      ["Total Paid to Date", d.totalPaid.toLocaleString("en-NG")],
      ["Invoice Total", d.invoiceTotal.toLocaleString("en-NG")],
    ],
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [11, 26, 75], textColor: 255 },
    columnStyles: { 1: { halign: "right" } },
    margin: { left: 14, right: 14 },
  });

  // @ts-expect-error lastAutoTable is attached by the plugin
  const signY = (doc.lastAutoTable?.finalY ?? 140) + 14;

  doc.setFontSize(8.5);
  doc.setTextColor(60);
  doc.text("Authorized Officer:", 14, signY);
  doc.setDrawColor(120);
  doc.line(14, signY + 8, 80, signY + 8);
  doc.text(d.authorizedBy, 14, signY + 12.5);

  doc.text("This receipt is computer generated.", W / 2, signY + 20, { align: "center" });
  doc.text(`Powered by Sure Foundation School Fee Management System`, W / 2, signY + 24.5, { align: "center" });

  doc.save(`Receipt-${d.receiptNumber}.pdf`);
}
