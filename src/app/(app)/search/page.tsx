import type { Metadata } from "next";
import { getTrending } from "@/lib/content/queries";
import { SearchExperience } from "@/components/search/search-experience";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage() {
  const suggestions = await getTrending(10);
  return <SearchExperience suggestions={suggestions} />;
}
