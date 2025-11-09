

import { notFound, redirect } from "next/navigation";
import MarketDetails from "@/components/MarketDetails";
import { getMarketSummary } from "@/app/view-functions/markets";

interface MarketPageProps {
  params: {
    id: string; 
    slug: string;
  };
}

export const dynamicParams = true;

export default async function MarketPage({ params }: MarketPageProps) {
  const { id: idStr, slug } = params;
  const id = parseInt(idStr, 10); 

  // Guard: Invalid ID → 404 early
  if (isNaN(id)) {
    notFound();
  }

  // Fetch the market data
  const market = await getMarketSummary(id);
  // console.log("market in page---", market);

  // If market doesn't exist, show 404
  // if (!market) {
  //   notFound();
  // }

  // Verify the slug matches
  const expectedSlug = market?.title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .trim();
  if (slug !== expectedSlug) {
    redirect(`/market/${id}/${expectedSlug}`);
  }

  return <MarketDetails market={market} />;
}