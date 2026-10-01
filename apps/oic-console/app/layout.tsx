import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Oi Intelligence Core · Operator Console",
  description: "Internal OIC intelligence engineering console"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
