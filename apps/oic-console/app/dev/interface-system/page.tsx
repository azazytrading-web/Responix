import { notFound } from "next/navigation";
import InterfaceSystemGallery from "./gallery";
import "../../components/interface/interface-system.css";

export const dynamic = "force-dynamic";

export default function InterfaceSystemPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <InterfaceSystemGallery />;
}
