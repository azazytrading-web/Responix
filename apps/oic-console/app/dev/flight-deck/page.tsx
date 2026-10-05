import { notFound } from "next/navigation";
import FlightDeckShowcase from "./showcase";

export const dynamic = "force-dynamic";
export default function FlightDeckShowcasePage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <FlightDeckShowcase />;
}
