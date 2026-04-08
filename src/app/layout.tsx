import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "sonner"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Smart Intendance - Subscription Management",
  description: "Track and optimize your SaaS subscriptions with AI",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            style: { background: "white", border: "1px solid #e5e7eb" },
            className: "sonner-toast",
          }}
        />
      </body>
    </html>
  )
}