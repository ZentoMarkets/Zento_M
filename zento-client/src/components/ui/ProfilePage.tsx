"use client";

import React, { useEffect, useState } from "react";
import {
  BriefcaseBusiness,
  MessageCircle,
  CheckCircle,
  Presentation,
  Trophy,
  User,
  PackageOpen,
  Droplets,
} from "lucide-react";
import { truncateAddress } from "@aptos-labs/wallet-adapter-react";
import { AnimatePresence } from "framer-motion";
import MobileBottomNav from "./MobileBottomNav";
import Link from "next/link";

import {
  getUserPositionDetails,
  getMarketDetails,
  getAllMarketIds,
  getUserTradeHistory,
  MarketDetails,
  Position,
  client,
} from "@/app/view-functions/markets";
import { useWalletAuth } from "@/app/hooks/useWalletAuth";
import { PixelCoins } from ".";
import { ConnectButton, useActiveAccount, useReadContract } from "thirdweb/react";
import { chain, wallets } from "@/lib/thirdweb";
import { getContract } from "thirdweb";

const SHARES_DECIMALS = 6; // Updated to 6 for USDC
const PRICE_SCALE = 10000; // Basis points (0-10000 for 0-1)

const ProfilePage = () => {
  const [activeTab, setActiveTab] = useState("summary");

  const [loadingBalance, setLoadingBalance] = useState(false);
  const [netWorth, setNetWorth] = useState(0);
  const [invested, setInvested] = useState(0);
  const [profit, setProfit] = useState(0);
  const [winRate, setWinRate] = useState(0);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [avgHoldTime, setAvgHoldTime] = useState(0);
  const [createdMarkets, setCreatedMarkets] = useState<MarketDetails[]>([]);
  const [userPositionsByMarket, setUserPositionsByMarket] = useState<
    { marketId: number; positions: Position[]; marketDetails: MarketDetails }[]
  >([]);
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [loadingTrades, setLoadingTrades] = useState(false);
  const [loadingMarkets, setLoadingMarkets] = useState(false);

  const USDT_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_USDT_CONTRACT_ADDRESS!;

  const account = useActiveAccount();
  const { user } = useWalletAuth();
  

  // Generate slug from market title
  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  };

  const fetchProfileData = async () => {
    if (!account?.address) return;
  
    const user = account.address.toString();
  
    try {
      const marketIds = await getAllMarketIds();
      const numMarketIds = marketIds.map((id) => Number(id));
  
      setLoadingMarkets(true);
  
      const detailsPromises = numMarketIds.map((id) => getMarketDetails(id));
      const allMarketDetails = (await Promise.all(detailsPromises)).filter((d) => d !== null) as MarketDetails[];
      setCreatedMarkets(allMarketDetails.filter((m) => m.creator === user));
      setLoadingMarkets(false);
  
      setLoadingPositions(true);
      const positionsPromises = numMarketIds.map((id) => getUserPositionDetails(user, id));
      const positionsPerMarket = await Promise.all(positionsPromises);
      
      // Filter out empty arrays and create proper structure
      const positionsByMarket: any[] = [];
      for (let i = 0; i < numMarketIds.length; i++) {
        const positions: any = positionsPerMarket[i];
        if (positions.length > 0) {
          const marketId = numMarketIds[i];
          const marketDetails = allMarketDetails.find((m) => Number(m.id) === marketId);
          if (marketDetails) {
            positionsByMarket.push({ 
              marketId, 
              positions, // This is now guaranteed to be an array
              marketDetails 
            });
          }
        }
      }
      setUserPositionsByMarket(positionsByMarket);
      setLoadingPositions(false);
  
      setLoadingTrades(true);
      const tradesPromises = numMarketIds.map((id) => getUserTradeHistory(user, id, 50));
      let tradesResults = await Promise.all(tradesPromises);
  
      // Flatten and process trades with proper typing
      let allTrades: any[] = tradesResults
        .flat()
        .filter((t): t is any => t !== null && t !== undefined)
        .map(trade => ({
          ...trade,
          shares: Number(trade.shares),
          price: Number(trade.price),
          timestamp: Number(trade.timestamp),
          amount: trade.amount ? Number(trade.amount) : 0
        }))
        .sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
  
      setLoadingTrades(false);
      console.log("loadingTrades", loadingTrades);
      console.log("First trade after proper flattening:", allTrades[0]);
  
      // Calculate portfolio metrics from positions (source of truth)
      let totalInvested = 0;
      let positionsValue = 0;
      let unrealizedPnl = 0;
  
      positionsByMarket.forEach((pm) => {
        pm.positions.forEach((p: any) => {
          // Current market price
          const currentPriceBp = p.outcome === 1 ? Number(pm.marketDetails.yesPrice) : Number(pm.marketDetails.noPrice);
          const currentPrice = currentPriceBp / PRICE_SCALE;
          const shares = p.shares / 10 ** SHARES_DECIMALS;
  
          // Current value of position
          const value = shares * currentPrice;
          positionsValue += value;
  
          // Cost basis (what was actually paid including fees)
          const avgPrice = Number(p.avgPrice) / PRICE_SCALE;
          const cost = shares * avgPrice;
          totalInvested += cost;
  
          // Unrealized P&L
          unrealizedPnl += value - cost;
        });
      });
  
      // Calculate realized profit from closed positions
      const totalInflows = allTrades
        .filter((t) => t.tradeType === 2 || t.tradeType === 4 || t.tradeType === 5)
        .reduce((sum, t) => sum + Number(t.amount) / 10 ** SHARES_DECIMALS, 0);
  
      let totalOutflows = allTrades
        .filter((t) => t.tradeType === 1 || t.tradeType === 3)
        .reduce((sum, t) => sum + Number(t.amount) / 10 ** SHARES_DECIMALS, 0);
  
      // Fallback: If no trade history for buys, use position cost basis as invested
      if (totalOutflows === 0 && totalInvested > 0) {
        totalOutflows = totalInvested;
      }
  
      const realizedProfit = totalInflows - (totalOutflows - totalInvested);
      const totalProfit = realizedProfit + unrealizedPnl;
  
      setInvested(totalOutflows * 2);
      setProfit(totalProfit);
      setNetWorth(balance + positionsValue);
  
      let tempWins = 0;
      let tempLosses = 0;
      positionsByMarket.forEach((pm) => {
        if (pm.marketDetails.resolved) {
          const winningOutcome = pm.marketDetails.outcome;
          pm.positions.forEach((p: any) => {
            if (p.outcome === winningOutcome) tempWins++;
            else tempLosses++;
          });
        }
      });
      setWins(tempWins);
      setLosses(tempLosses);
      const totalResolved = tempWins + tempLosses;
      setWinRate(totalResolved > 0 ? (tempWins / totalResolved) * 100 : 0);
  
      const currentTime = Math.floor(Date.now() / 1000);
      const holdTimes = positionsByMarket.flatMap((pm) =>
        pm.positions.map((p: any) => (currentTime - Number(p.timestamp)) / 86400)
      );
      const avg = holdTimes.length > 0 ? holdTimes.reduce((sum, t) => sum + t, 0) / holdTimes.length : 0;
      setAvgHoldTime(avg);
    } catch (error) {
      console.error("Error fetching profile data:", error);
      setLoadingPositions(false);
      setLoadingTrades(false);
      setLoadingMarkets(false);
    }
  };

  const usdtContract = getContract({
    client,
    chain,
    address: USDT_CONTRACT_ADDRESS,
  });

  // Read USDT balance
const { data: usdtBalance, refetch: refetchUSDTBalance } = useReadContract({
  contract: usdtContract,
  method: "function balanceOf(address) view returns (uint256)",
  params: (account?.address ? [account.address] : []) as [string],
  queryOptions: { enabled: !!account?.address },
});

  useEffect(() => {
    if (account?.address) {
      refetchUSDTBalance(); 
      fetchProfileData();
      setLoadingBalance(false)
    }
  }, [account?.address]);

  const balance = usdtBalance ? Number(usdtBalance) / 1e18 : 0;


  console.log("balancee---", balance)
  // Overview Tab Component
  const OverviewTab = () => (
    <div className="space-y-6">
      <div className="bg-[#27272b] border border-gray-700/20 rounded-xl mb-5 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Portfolio</h2>
        </div>
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="rounded-full bg-blue-500 flex items-center justify-center">
              <img src="/icons/usdc-logo.png" alt="USDC Logo" className="w-8 h-8 rounded-full" />
            </div>
            <div>
              {loadingBalance || !account?.address ? (
                <div className="h-9 w-32 bg-gray-700/50 rounded-lg animate-pulse mb-1"></div>
              ) : (
                <div className="text-3xl font-bold text-white">{netWorth.toFixed(2)}</div>
              )}
              <div className="text-sm text-gray-400">net worth</div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-1">
              <div className="flex items-center justify-center flex-shrink-0">
                <img src="/icons/usdc-logo.png" alt="USDC Logo" className="w-4 h-4 sm:w-5 sm:h-5 rounded-full" />
              </div>
              {loadingBalance || !account?.address ? (
                <div className="h-5 w-16 bg-gray-700/50 rounded animate-pulse"></div>
              ) : (
                <span className="text-white font-bold text-sm sm:text-base truncate">{balance.toFixed(2)}</span>
              )}
            </div>
            <div className="text-xs text-gray-400">balance</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-1">
              <div className="flex items-center justify-center flex-shrink-0">
                <img src="/icons/usdc-logo.png" alt="USDC Logo" className="w-4 h-4 sm:w-5 sm:h-5 rounded-full" />
              </div>
              {loadingBalance || !account?.address ? (
                <div className="h-5 w-16 bg-gray-700/50 rounded animate-pulse"></div>
              ) : (
                <span className="text-white font-bold text-sm sm:text-base truncate">{invested.toFixed(2)}</span>
              )}
            </div>
            <div className="text-xs text-gray-400">invested</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-1">
              <div className="flex items-center justify-center flex-shrink-0">
                <img src="/icons/usdc-logo.png" alt="USDC Logo" className="w-4 h-4 sm:w-5 sm:h-5 rounded-full" />
              </div>
              {loadingBalance || !account?.address ? (
                <div className="h-5 w-16 bg-gray-700/50 rounded animate-pulse"></div>
              ) : (
                <span
                  className={`font-bold text-sm sm:text-base truncate ${profit >= 0 ? "text-green-400" : "text-red-400"}`}
                >
                  {profit >= 0 ? "+" : ""}
                  {profit.toFixed(2)}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-400">profit/loss</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-1">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                <Trophy className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-yellow-500" />
              </div>
              <span className="text-white font-bold text-sm sm:text-base">1</span>
            </div>
            <div className="text-xs text-gray-400">Copper</div>
          </div>
        </div>
      </div>
      <div className="bg-[#27272b] rounded-xl p-6 border border-gray-700/20">
        <h3 className="text-lg font-bold text-white mb-4">Stats</h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400 flex items-center">Win/Loss Record</span>
              {loadingBalance || !account?.address ? (
                <div className="h-5 w-16 bg-gray-700/50 rounded animate-pulse"></div>
              ) : (
                <span className="text-white font-medium">
                  {wins}W - {losses}L
                </span>
              )}
            </div>
            {loadingBalance || !account?.address ? (
              <div className="h-2 w-full bg-gray-700/50 rounded-full animate-pulse"></div>
            ) : (
              <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-gray-600">
                {wins === 0 && losses === 0 ? (
                  <div className="bg-gray-500 w-full" />
                ) : (
                  <>
                    <div className="bg-green-500" style={{ width: `${winRate}%` }} />
                    <div className="bg-red-500" style={{ width: `${100 - winRate}%` }} />
                  </>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm flex items-center">Win Rate</span>
            {loadingBalance || !account?.address ? (
              <div className="h-5 w-12 bg-gray-700/50 rounded animate-pulse"></div>
            ) : (
              <span className="text-white font-bold">{winRate.toFixed(0)}%</span>
            )}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm flex items-center">Total ROI</span>
            {loadingBalance || !account?.address ? (
              <div className="h-5 w-12 bg-gray-700/50 rounded animate-pulse"></div>
            ) : (
              <span className={`font-bold ${profit / invested >= 0 ? "text-green-400" : "text-red-400"}`}>
                {invested > 0 ? ((profit / invested) * 100).toFixed(0) : 0}%
              </span>
            )}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm flex items-center">Avg Hold Time</span>
            {loadingBalance || !account?.address ? (
              <div className="h-5 w-16 bg-gray-700/50 rounded animate-pulse"></div>
            ) : (
              <span className="text-white font-medium">{avgHoldTime.toFixed(0)} days</span>
            )}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm flex items-center">Total Trades</span>
            {loadingBalance || !account?.address ? (
              <div className="h-5 w-12 bg-gray-700/50 rounded animate-pulse"></div>
            ) : (
              <span className="text-white font-medium">{user?.games_played ?? 0}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Positions Tab Component
  const PositionsTab = () => (
    <div className="space-y-4">
      <div className="bg-[#1a191e] rounded-xl p-6 border-gray-700/20">
        <h3 className="text-lg font-bold text-white mb-4">Your Positions ({userPositionsByMarket.length})</h3>
        {loadingPositions ? (
          <div className="text-center text-gray-400">Loading positions...</div>
        ) : userPositionsByMarket.length === 0 ? (
          <div className="border-b border-gray-800 last:border-b-0 py-10 mb-2.5 first:pt-0 last:pb-0">
            <div className="flex flex-col items-center justify-center gap-3">
              <PackageOpen className="w-12 h-12 text-gray-600" />
              <div className="text-center space-y-1">
                {account?.address ? (
                  <p className="text-gray-400 text-sm font-medium">No active positions</p>
                ) : (
                  <p className="text-gray-400 text-sm font-medium">Sign in to view positions</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          userPositionsByMarket.map((pm) => {
            const isExpiringSoon = Number(pm.marketDetails.endTime) < Math.floor(Date.now() / 1000) + 86400;
            const slug = generateSlug(pm.marketDetails.title);
            return (
              <Link
                key={pm.marketId}
                href={`/market/${slug}/${pm.marketId}`}
                className="block border-b border-gray-700/20 last:border-b-0 p-2 rounded-md first:pt-0 last:pb-0 hover:bg-gray-700/20 transition-colors cursor-pointer"
              >
                <div className="flex justify-between items-center mb-2">
                  <p className="text-white font-medium text-sm">{pm.marketDetails.title}</p>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      pm.marketDetails.resolved
                        ? "bg-blue-500/20 text-blue-400"
                        : isExpiringSoon
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-green-500/20 text-green-400"
                    }`}
                  >
                    {pm.marketDetails.resolved ? "Resolved" : isExpiringSoon ? "Closed" : "Active"}
                  </span>
                </div>
                {pm.positions.map((pos, index) => {
                  const currentPriceBp =
                    pos.outcome === 1 ? Number(pm.marketDetails.yesPrice) : Number(pm.marketDetails.noPrice);
                  const currentPrice = currentPriceBp / PRICE_SCALE;
                  const shares = pos.shares / 10 ** SHARES_DECIMALS;
                  const value = shares * currentPrice;
                  const avgPrice = Number(pos.avgPrice) / PRICE_SCALE;
                  const cost = shares * avgPrice;
                  const pnl = value - cost;
                  const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;

                  return (
                    <div key={index} className="mb-3">
                      <div className="grid grid-cols-3 gap-4 mb-3">
                        <div>
                          <p className="text-gray-400 text-xs mb-1">Position</p>
                          <span
                            className={`px-2 py-1 rounded text-xs font-bold ${
                              pos.outcome === 1 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                            }`}
                          >
                            {pos.outcome === 1 ? "YES" : "NO"} {shares.toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs mb-1">P&L</p>
                          <p className={`font-bold text-sm ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {pnl >= 0 ? "+" : ""}
                            {pnl.toFixed(2)} ({pnlPercent >= 0 ? "+" : ""}
                            {pnlPercent.toFixed(1)}%)
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs mb-1">Current Price</p>
                          <p className="text-white font-medium">
                            {(currentPrice * 100).toFixed(2).replace(/\.00$/, "")}¢
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </Link>
            );
          })
        )}
      </div>
    </div>
  );

  // Markets Tab Component
  const MarketsTab = () => (
    <div className="space-y-4">
      <div className="bg-[#1a191e] rounded-xl p-6 border-gray-700/20">
        <h3 className="text-lg font-bold text-white mb-4">Created Markets</h3>
        {loadingMarkets ? (
          <div className="text-center text-gray-400">Loading markets...</div>
        ) : createdMarkets.length === 0 ? (
          <div className="border-b border-gray-700/70 last:border-b-0 p-3 py-10 mb-2.5 first:pt-0 last:pb-0">
            <div className="flex flex-col items-center justify-center gap-3">
              <PackageOpen className="w-12 h-12 text-gray-600" />
              <div className="text-center space-y-1">
                {account?.address ? (
                  <p className="text-gray-400 text-sm font-medium">No markets created yet</p>
                ) : (
                  <p className="text-gray-400 text-sm font-medium">Sign in to view your created markets</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          createdMarkets.map((market: any) => (
            <Link
              key={market.id}
              href={`/market/${generateSlug(market.title)}/${market.id}`}
              className="block border-b border-gray-700/20 last:border-b-0 p-2 rounded-md first:pt-0 last:pb-0 hover:bg-gray-700/20 transition-colors cursor-pointer"
            >
              <p className="text-white font-medium text-sm mb-3">{market.title}</p>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-400 text-xs">TVL</p>
                  <p className="text-white font-medium">
                    {(Number(market?.totalValueLocked) / 10 ** SHARES_DECIMALS).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Traders</p>
                  <p className="text-white font-medium">{market.participantCount}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Ends</p>
                  <p className="text-white font-medium">
                    {new Date(Number(market.endTime) * 1000).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case "summary":
        return <OverviewTab />;
      case "positions":
        return <PositionsTab />;
      case "markets":
        return <MarketsTab />;
      default:
        return <OverviewTab />;
    }
  };

  return (
    <div className="min-h-screen bg-[#1c1b20]">
      <header className="bg-[#1a1a1e2c] sticky top-0 z-40 overflow-hidden border-b border-b-[var(--Stroke-Dark,#2c2c2f)] px-3 sm:px-4 lg:px-4">
        <div className="max-w-7xl mx-auto py-3 sm:py-4">
          <div className="flex items-center justify-between">
            {/* Logo Section */}
            <div className="flex items-center gap-3 sm:gap-6">
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                <Link href="/" className="flex items-center">
                  <img
                    src="/zento.png"
                    alt="Zento Logo"
                    className="ml-1 sm:ml-2 h-10 w-auto sm:h-12 object-contain text-blue-400"
                  />
                </Link>
              </h1>

              <span className="text-gray-300 hidden lg:flex font-medium ml-6 transition-colors relative pb-1">
                Explore
                <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-3/4 h-[2px] bg-[#d5a514]"></span>
              </span>

              {/* Leaderboard Link - Desktop Only */}
              <Link href="/leaderboard" className="hidden lg:block group relative ml-6">
                <span className="text-gray-300 transition-colors duration-200 font-medium">Leaderboard</span>
                <span className="absolute rounded-lg left-2 -bottom-0.5 h-[2px] w-0 bg-[#d5a514] transition-all duration-300 group-hover:w-[80%]"></span>
              </Link>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-2 sm:gap-4">
              {/* User Coins Display */}
              {user && (
                <div className="flex items-center gap-1.5 px-3 py-2 bg-[#d5a514]/10 border border-[#d5a514]/30 rounded-lg shadow-sm">
                  <PixelCoins className="w-4 h-4 text-[#d5a514]" />
                  <span className="text-sm font-semibold text-[#d5a514]">{(user.points ?? 0).toLocaleString()}</span>
                </div>
              )}

              {/* Right Action Buttons */}
              <div className="flex items-center gap-2">
                {[
                  {
                    label: "Get Faucet",
                    icon: <Droplets className="w-4 h-4 sm:w-5 sm:h-5 text-[#d5a514]" />,
                    href: "https://www.bnbchain.org/en/testnet-faucet",
                    isLink: true,
                  },
                ].map((btn, i) =>
                  btn.isLink ? (
                    <a
                      key={i}
                      href={btn.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={btn.label}
                      className="flex items-center justify-center px-2 sm:px-3 py-2 rounded-lg bg-[#27272b] hover:bg-gray-700 text-gray-300 transition-all duration-200"
                    >
                      {btn.icon}
                    </a>
                  ) : (
                    <button
                      key={i}
                      // onClick={btn.onClick}
                      title={btn.label}
                      className="flex items-center justify-center px-2 sm:px-3 py-2 rounded-lg bg-[#27272b] hover:bg-gray-700 text-gray-300 transition-all duration-200"
                    >
                      {btn.icon}
                    </button>
                  ),
                )}
              </div>

              {/* Wallet Connect */}
              <div className="flex items-center">
                <ConnectButton
                  client={client}
                  chain={chain}
                  wallets={wallets}
                  connectButton={{
                    label: (
                      <>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="mr-1"
                        >
                          <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5z" />
                          <path d="M21 12h-4a2 2 0 0 0 0 4h4" />
                        </svg>
                        Sign In
                      </>
                    ),
                    style: {
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      whiteSpace: "nowrap",
                      fontSize: "14px",
                      gap: "0.4rem",
                      height: "2.5rem",
                      backgroundColor: "#d5a514",
                      color: "white",
                      fontWeight: 600,
                      padding: "0.75rem 0.75rem",
                      borderRadius: "0.5rem",
                      transition: "all 0.2s ease-in-out",
                      cursor: "pointer",
                      boxShadow: "0 0 8px rgba(213,165,20,0.3)",
                    },
                  }}
                  detailsButton={{
                    displayBalanceToken: {
                      [chain.id]: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd",
                    },
                  }}
                  connectModal={{
                    size: "wide",
                    title: "Sign in to your account",
                    showThirdwebBranding: true,
                  }}
                  accountAbstraction={{
                    chain: chain,
                    sponsorGas: true,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </header>
      <div className="max-w-6xl px-4 sm:mx-auto mt-12 lg:pb-8 mx-auto py-6 pb-32">
        <div className="flex flex-col items-center gap-4 mb-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#FFE900] to-[#d5a514] p-0.5 shadow-lg shadow-[#FFE900]/20">
              <div className="w-full h-full rounded-full bg-gray-700/90 flex items-center justify-center">
                <User className="w-10 h-10 text-gray-300" />
              </div>
            </div>
            <div className="absolute -bottom-1 -right-1 bg-gradient-to-br from-[#FFE900] to-[#d5a514] rounded-full p-1 shadow-lg shadow-[#FFE900]/30 ring-2 ring-[#b8952e]">
              <CheckCircle className="w-4 h-4 text-white" />
            </div>
          </div>

          <div className="text-center">
            <div className="flex items-center align-middle justify-center gap-2">
              <h1 className="text-2xl font-bold text-white">
                {user?.username ? (
                  user?.username
                ) : (
                  <div className="h-9 w-32 bg-gray-700/50 rounded-lg animate-pulse mb-1"></div>
                )}
              </h1>
              {/* <ChevronDown className="w-4 h-4 text-slate-200/70 mt-1" /> */}
            </div>
            <p className="text-gray-400">{truncateAddress(account?.address.toString())}</p>
          </div>
        </div>
        <div className="flex justify-center mb-6 pb-2 border-b border-gray-800">
          <div className="flex gap-1 w-full max-w-md">
            {[
              { id: "summary", icon: BriefcaseBusiness, label: "Summary" },
              { id: "positions", icon: Presentation, label: "Positions" },
              { id: "markets", icon: MessageCircle, label: "Markets" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center px-4 py-2 flex-1 transition-all ${
                  activeTab === tab.id ? "text-[#d5a514] border-b-2 border-[#d5a514]" : "text-gray-400 hover:text-white"
                }`}
              >
                <tab.icon className="w-5 h-5 mb-1" />
                <span className="text-xs font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
        <AnimatePresence mode="wait">{renderTabContent()}</AnimatePresence>
      </div>
      <MobileBottomNav />
    </div>
  );
};

export default ProfilePage;
