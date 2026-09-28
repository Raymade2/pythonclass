import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/toast";

export const metadata: Metadata = {
  title: {
    default: "Sure Foundation School Fee Management System",
    template: "%s · SFGS Fee Manager",
  },
  description:
    "School fee payment management system for Sure Foundation Group of Schools — fees, invoicing, payments, receipts, debtors and reports.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
