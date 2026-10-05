import { notFound } from "next/navigation";
import InstrumentGallery from "./gallery";
import "../../instrument-gallery.css";

export const dynamic = "force-dynamic";

export default function InstrumentGalleryPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <InstrumentGallery />;
}
