"use client";

import React, { useEffect, useRef, useState } from "react";
import { Send, BarChart3, DollarSign, Globe, MessageCircle, Circle, CheckCircle, Edit3 } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useActiveAccount, useSendTransaction, useReadContract, ConnectButton } from "thirdweb/react";
import { getContract, prepareContractCall, readContract } from "thirdweb";
import { client, chain, wallets } from "@/lib/thirdweb";
import Link from "next/link";
import { useWalletAuth } from "@/app/hooks/useWalletAuth";
import { PixelCoins } from "./ui";
import MobileBottomNav from "./ui/MobileBottomNav";
import { useSearchParams } from "next/navigation";

// Contract addresses
const MARKET_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_MARKET_CONTRACT_ADDRESS!;
const USDT_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_USDT_CONTRACT_ADDRESS!;

interface Message {
  role: "user" | "ai";
  content: string;
}

interface Suggestion {
  ai_probability: number;
  category: string;
  confidence: number;
  context: string;
  description: string;
  end_date: string;
  key_factors: string[];
  question: string;
  resolution_criteria: string;
  sentiment_score: number;
  sources: string[];
  title: string;
}

const CreateMarket = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggestedReply, setSuggestedReply] = useState<string>("");
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [progress, setProgress] = useState<string>("");
  const [marketProposal, setMarketProposal] = useState<any>("");
  const [initialLiquidity, setInitialLiquidity] = useState<number>(10);
  const [error, setError] = useState("");
  const [creatingCustomMarket, setCreatingCustomMarket] = useState(false);
  const [marketCreated, setMarketCreated] = useState(false);
  const [createdMarketTitle, setCreatedMarketTitle] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [editingMarket, setEditingMarket] = useState(false);
  // const [hasAutoSentHeadline, setHasAutoSentHeadline] = useState(false);
  const [marketProposalStartIndex, setMarketProposalStartIndex] = useState<number>(-1);

  const searchParams = useSearchParams();
  const headlineFromUrl = searchParams?.get("headline");
  const hasAutoSentHeadlineRef = useRef(false);

  const account = useActiveAccount();
  const { mutate: sendTransaction } = useSendTransaction();
  const router = useRouter();
  const { user } = useWalletAuth();

  const userId = "Creator";

  // Get contracts
  const marketContract = getContract({
    client,
    chain,
    address: MARKET_CONTRACT_ADDRESS,
  });

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

  // Read minimum liquidity requirement
  const { data: minLiquidity } = useReadContract({
    contract: marketContract,
    method: "function minInitialLiquidity() view returns (uint256)",
    params: [],
  });

  // Read market creation fee
  const { data: creationFee } = useReadContract({
    contract: marketContract,
    method: "function marketCreationFee() view returns (uint256)",
    params: [],
  });

  const balance = usdtBalance ? Number(usdtBalance) / 1e18 : 0;
  const minLiquidityFormatted = minLiquidity ? Number(minLiquidity) / 1e18 : 2;
  const creationFeeFormatted = creationFee ? Number(creationFee) / 1e18 : 0;

  const [suggestedQuestions] = useState([
    "Will Bitcoin fall below $100,000 before January 1, 2026?",
    "Will Singapore establish an official national Bitcoin reserve in 2025?",
    "Will SpaceX successfully land humans on Mars by 2030?",
  ]);

  // Auto-send headline when component mounts and headline is present
  useEffect(() => {
    if (headlineFromUrl && !hasAutoSentHeadlineRef.current && messages.length === 0) {
      hasAutoSentHeadlineRef.current = true;
      const decodedHeadline = decodeURIComponent(headlineFromUrl);
      const predictionMarketPrompt = `Based on this headline: "${decodedHeadline}", suggest some questions`;
      console.log(currentStep, progress)
      setInput(predictionMarketPrompt);
      handleSendHeadline(predictionMarketPrompt, decodedHeadline);
    }
  }, [headlineFromUrl, messages.length]);

  // Separate function to handle sending the headline
  const handleSendHeadline = async (prompt: string, originalHeadline: string) => {
    const newMessage: Message = { role: "user", content: prompt };
    setMessages((prev) => [...prev, newMessage]);
    setInput("");
    setLoading(true);

    try {
      let response;

      if (!sessionId) {
        response = await fetch("https://pivot-tst.onrender.com/api/market/search-suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: prompt,
            user_id: userId,
            context: `Original headline: ${originalHeadline}`,
          }),
        });
      } else {
        response = await fetch("https://pivot-tst.onrender.com/api/market/continue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            response: prompt,
            context: `Original headline: ${originalHeadline}`,
          }),
        });
      }

      const data = await response.json();

      if (data.success !== false && response.ok) {
        if (data.session_id && !sessionId) {
          setSessionId(data.session_id);
        }

        if (data.prediction_markets && data.prediction_markets.length > 0) {
          const formattedSuggestions = data.prediction_markets.map((market: any) => ({
            ai_probability: market.ai_probability,
            category: market.category,
            confidence: market.confidence,
            context: market.context,
            description: market.description,
            end_date: market.end_date,
            key_factors: market.key_factors || [],
            question: market.question,
            resolution_criteria: market.resolution_criteria,
            sentiment_score: market.sentiment_score,
            sources: market.sources || [],
            title: market.title,
          }));

          setSuggestions(formattedSuggestions);
          setShowSuggestions(true);
          setCurrentStep(1);
          setProgress("Select Market Suggestion");

          const suggestionMessage = `I found these prediction markets based on the headline "${originalHeadline}". Please select one to customize, or create a custom market.`;
          setMessages((prev) => [...prev, { role: "ai", content: suggestionMessage }]);
        } else if (data.suggestions && data.suggestions.length > 0) {
          setSuggestions(data.suggestions);
          setShowSuggestions(true);
          setCurrentStep(1);
          setProgress("Select Market Suggestion");

          if (data.message) {
            setMessages((prev) => [...prev, { role: "ai", content: data.message }]);
          }
        } else if (data.ai_suggestion) {
          let reply = data.ai_suggestion;
          if (reply.includes("Everything looks good")) {
            reply = "confirm";
          }
          setSuggestedReply(reply);
        }

        if (data.proposal) {
          setMarketProposal(data.proposal);
        }

        if (data.current_step) {
          setCurrentStep(data.current_step);
        }
        if (data.progress) {
          setProgress(data.progress);
        }

        if (data.prompt && !data.prediction_markets) {
          const aiMessage = data.prompt;
          if (aiMessage) {
            setMessages((prev) => [...prev, { role: "ai", content: aiMessage }]);
          }
        }
      } else {
        const errorMessage = data.message || "Something went wrong. Please try again.";
        setMessages((prev) => [...prev, { role: "ai", content: `⚠️ ${errorMessage}` }]);
      }
    } catch (err) {
      console.error("Request error:", err);
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: "⚠️ Network error. Please check your connection and try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const newMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, newMessage]);
    setInput("");
    setLoading(true);

    try {
      let response;

      if (!sessionId) {
        response = await fetch("https://pivot-tst.onrender.com/api/market/search-suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: input, user_id: userId }),
        });
      } else {
        response = await fetch("https://pivot-tst.onrender.com/api/market/continue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId, response: input }),
        });
      }

      const data = await response.json();

      if (data.success !== false && response.ok) {
        if (data.session_id && !sessionId) {
          setSessionId(data.session_id);
        }

        if (data.prediction_markets && data.prediction_markets.length > 0) {
          const formattedSuggestions = data.prediction_markets.map((market: any) => ({
            ai_probability: market.ai_probability,
            category: market.category,
            confidence: market.confidence,
            context: market.context,
            description: market.description,
            end_date: market.end_date,
            key_factors: market.key_factors || [],
            question: market.question,
            resolution_criteria: market.resolution_criteria,
            sentiment_score: market.sentiment_score,
            sources: market.sources || [],
            title: market.title,
          }));

          setSuggestions(formattedSuggestions);
          setShowSuggestions(true);
          setCurrentStep(1);
          setProgress("Select Market Suggestion");

          const suggestionMessage = `I found these predictions based on your query "${data.query || input}". Please select one to customize, or create a custom market.`;
          setMessages((prev) => [...prev, { role: "ai", content: suggestionMessage }]);
        } else if (data.suggestions && data.suggestions.length > 0) {
          setSuggestions(data.suggestions);
          setShowSuggestions(true);
          setCurrentStep(1);
          setProgress("Select Market Suggestion");

          if (data.message) {
            setMessages((prev) => [...prev, { role: "ai", content: data.message }]);
          }
        } else if (data.ai_suggestion) {
          let reply = data.ai_suggestion;
          if (reply.includes("Everything looks good")) {
            reply = "confirm";
          }
          setSuggestedReply(reply);
        }

        if (data.proposal) {
          setMarketProposal(data.proposal);
        }

        if (data.current_step) {
          setCurrentStep(data.current_step);
        }
        if (data.progress) {
          setProgress(data.progress);
        }

        if (data.prompt && !data.prediction_markets) {
          const aiMessage = data.prompt;
          if (aiMessage) {
            setMessages((prev) => [...prev, { role: "ai", content: aiMessage }]);
          }
        }
      } else {
        const errorMessage = data.message || "Something went wrong. Please try again.";
        setMessages((prev) => [...prev, { role: "ai", content: `⚠️ ${errorMessage}` }]);
      }
    } catch (err) {
      console.error("Request error:", err);
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: "⚠️ Network error. Please check your connection and try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleLiquidityChange = (e: { target: { value: any } }) => {
    let value = e.target.value;

    const totalRequired = parseFloat(value) + creationFeeFormatted;

    if (value && totalRequired > balance) {
      value = Math.max(minLiquidityFormatted, balance - creationFeeFormatted - 0.05).toFixed(2);
      setInitialLiquidity(value);
    } else {
      setInitialLiquidity(value);
    }

    if (value && parseFloat(value) < minLiquidityFormatted) {
      setError(`Min ${minLiquidityFormatted} USDT`);
    } else if (value && totalRequired > balance) {
      setError("Insufficient USDT balance");
    } else {
      setError("");
    }
  };

  const handleSelectSuggestion = async (index: number) => {
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      currentSessionId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setSessionId(currentSessionId);
    }

    setLoading(true);

    try {
      setSelectedSuggestion(suggestions[index]);
      setShowSuggestions(false);
      setEditingMarket(true);
      setCurrentStep(2);
      setProgress("Editing Market Proposal");

      setMarketProposalStartIndex(messages.length);

      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content: `You've selected: "${suggestions[index].title}". Now you can make any changes before creating the market.`,
        },
      ]);

      setMarketProposal(suggestions[index]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content: `Selected: "${suggestions[index].title}". Note: Using offline mode - you can still edit and create the market.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onCreateMarket = async () => {
    if (!account) {
      // Insert at the end if no market proposal is active
      const messageIndex = marketProposalStartIndex >= 0 ? marketProposalStartIndex + 1 : messages.length;
      setMessages((prev) => [
        ...prev.slice(0, messageIndex),
        { role: "ai", content: "Please connect your wallet first." },
        ...prev.slice(messageIndex)
      ]);
      return;
    }
  
    // === VALIDATION ===
    if (creatingCustomMarket) {
      const validationMessages = {
        noQuestion: "Enter a market question.",
        noCategory: "Enter a category.",
        noEndDate: "Select an end date.",
        noResolution: "Add resolution criteria."
      };
  
      let errorMessage = "";
      if (!marketProposal.question?.trim()) errorMessage = validationMessages.noQuestion;
      else if (!marketProposal.category?.trim()) errorMessage = validationMessages.noCategory;
      else if (!marketProposal.end_date) errorMessage = validationMessages.noEndDate;
      else if (!marketProposal.resolution_criteria?.trim()) errorMessage = validationMessages.noResolution;
  
      if (errorMessage) {
        const validationIndex = marketProposalStartIndex >= 0 ? marketProposalStartIndex + 1 : messages.length;
        setMessages((prev) => [
          ...prev.slice(0, validationIndex),
          { role: "ai", content: errorMessage },
          ...prev.slice(validationIndex)
        ]);
        return;
      }
    }
  
    const title = marketProposal.question;
    const description = marketProposal.resolution_criteria;
    const resolution_criteria = marketProposal.resolution_criteria || "Resolved via official sources.";
    const oracle = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd" as `0x${string}`;
  
    let formattedEndTime: bigint;
    try {
      const [datePart, timePart] = marketProposal.end_date.split(" ");
      const [day, month, year] = datePart.split("/");
      const iso = `${year}-${month}-${day}T${timePart || "23:59:59"}Z`;
      const date = new Date(iso);
      if (isNaN(date.getTime())) throw new Error();
      formattedEndTime = BigInt(Math.floor(date.getTime() / 1000));
      if (formattedEndTime <= BigInt(Math.floor(Date.now() / 1000))) {
        const dateIndex = marketProposalStartIndex >= 0 ? marketProposalStartIndex + 1 : messages.length;
        setMessages((prev) => [
          ...prev.slice(0, dateIndex),
          { role: "ai", content: "End time must be in the future!" },
          ...prev.slice(dateIndex)
        ]);
        return;
      }
    } catch {
      const dateErrorIndex = marketProposalStartIndex >= 0 ? marketProposalStartIndex + 1 : messages.length;
      setMessages((prev) => [
        ...prev.slice(0, dateErrorIndex),
        { role: "ai", content: "Invalid date format." },
        ...prev.slice(dateErrorIndex)
      ]);
      return;
    }
  
    try {
      setLoading(true);
      
      const preparingIndex = marketProposalStartIndex >= 0 ? marketProposalStartIndex + 1 : messages.length;
      setMessages((prev) => [
        ...prev.slice(0, preparingIndex),
        { role: "ai", content: "Preparing market..." },
        ...prev.slice(preparingIndex)
      ]);
  
      const liquidityInWei = BigInt(Math.floor(initialLiquidity * 1e18));
      const creationFeeInWei = BigInt(Math.floor(creationFeeFormatted * 1e18));
      const totalRequired = liquidityInWei + creationFeeInWei;
  
      // === CHECK USDT ALLOWANCE ===
      const allowance = await readContract({
        contract: usdtContract,
        method: "function allowance(address owner, address spender) view returns (uint256)",
        params: [account.address, MARKET_CONTRACT_ADDRESS],
      });
      const currentAllowance = BigInt(allowance);
  
      if (currentAllowance < totalRequired) {
        const approveTx = prepareContractCall({
          contract: usdtContract,
          method: "function approve(address spender, uint256 amount)",
          params: [MARKET_CONTRACT_ADDRESS, totalRequired],
        });
  
        await new Promise<void>((resolve, reject) => {
          sendTransaction(approveTx, {
            onSuccess: () => {
              // Insert "USDT approved!" after the market proposal
              const approvedIndex = marketProposalStartIndex >= 0 ? marketProposalStartIndex + 1 : messages.length;
              setMessages((prev) => [
                ...prev.slice(0, approvedIndex),
                { role: "ai", content: "USDT approved!" },
                ...prev.slice(approvedIndex)
              ]);
              resolve();
            },
            onError: (err) => {
              const approvalErrorIndex = marketProposalStartIndex >= 0 ? marketProposalStartIndex + 1 : messages.length;
              setMessages((prev) => [
                ...prev.slice(0, approvalErrorIndex),
                { role: "ai", content: "Approval failed." },
                ...prev.slice(approvalErrorIndex)
              ]);
              reject(err);
            },
          });
        });
  
        // Wait for indexer
        await new Promise((r) => setTimeout(r, 4000));
      }
  
      // === FINAL ALLOWANCE CHECK ===
      const finalAllowance = await readContract({
        contract: usdtContract,
        method: "function allowance(address owner, address spender) view returns (uint256)",
        params: [account.address, MARKET_CONTRACT_ADDRESS],
      });
      if (BigInt(finalAllowance) < totalRequired) {
        const allowanceErrorIndex = marketProposalStartIndex >= 0 ? marketProposalStartIndex + 1 : messages.length;
        return setMessages((prev) => [
          ...prev.slice(0, allowanceErrorIndex),
          { role: "ai", content: "Approval not successful. Try again." },
          ...prev.slice(allowanceErrorIndex)
        ]);
      }
  
      // === CREATE MARKET ===
      const creatingIndex = marketProposalStartIndex >= 0 ? marketProposalStartIndex + 1 : messages.length;
      setMessages((prev) => [
        ...prev.slice(0, creatingIndex),
        { role: "ai", content: "Creating market..." },
        ...prev.slice(creatingIndex)
      ]);
  
      const createTx = prepareContractCall({
        contract: marketContract,
        method:
          "function createMarket(string title, string description, string resolutionCriteria, uint64 endTime, address oracle, uint256 initialLiquidity)",
        params: [title, description, resolution_criteria, formattedEndTime, oracle, liquidityInWei],
      });
  
      let txResult: any;
      try {
        txResult = await new Promise<any>((resolve, reject) => {
          sendTransaction(createTx, {
            onSuccess: (result) => resolve(result),
            onError: (err) => reject(err),
          });
        });
      } catch (err: any) {
        const msg = err.message.includes("Invalid end time")
          ? "Market must be ≥1 hour long."
          : err.message.includes("Insufficient liquidity")
            ? `Need ≥ ${minLiquidityFormatted} USDT.`
            : "Failed to create market.";
        
        const createErrorIndex = marketProposalStartIndex >= 0 ? marketProposalStartIndex + 1 : messages.length;
        setMessages((prev) => [
          ...prev.slice(0, createErrorIndex),
          { role: "ai", content: msg },
          ...prev.slice(createErrorIndex)
        ]);
        return;
      }
  
      // Wait for confirmation (optional)
      await txResult.receipt;
  
      // === SUCCESS ===
      const successIndex = marketProposalStartIndex >= 0 ? marketProposalStartIndex + 1 : messages.length;
      setMessages((prev) => [
        ...prev.slice(0, successIndex),
        { role: "ai", content: `Market "${title}" created! Live now.` },
        ...prev.slice(successIndex)
      ]);
      
      setMarketCreated(true);
      setCreatedMarketTitle(title);
      setEditingMarket(false);
      setMarketProposal(null);
      setCurrentStep(3);
      setProgress("Market Created!");
      setMarketProposalStartIndex(-1); // Reset the index
      refetchUSDTBalance();
    } catch (err: any) {
      console.error("onCreateMarket error:", err);
      const catchErrorIndex = marketProposalStartIndex >= 0 ? marketProposalStartIndex + 1 : messages.length;
      setMessages((prev) => [
        ...prev.slice(0, catchErrorIndex),
        { role: "ai", content: "Transaction failed. Try again." },
        ...prev.slice(catchErrorIndex)
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    setInput(question);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const parseDate = (dateStr: string): string => {
    if (!dateStr) return "";

    try {
      const [datePart] = dateStr.split(" ");
      if (datePart.includes("/")) {
        const [day, month, year] = datePart.split("/");
        const formattedMonth = String(month).padStart(2, "0");
        const formattedDay = String(day).padStart(2, "0");
        return `${year}-${formattedMonth}-${formattedDay}`;
      }
      const date = new Date(datePart);
      return date.toISOString().split("T")[0];
    } catch (error) {
      return "";
    }
  };

  const formatDateForDisplay = (dateStr: string): string => {
    if (!dateStr) return "Invalid Date";

    try {
      const [datePart] = dateStr.split(" ");

      if (datePart.includes("/")) {
        const [day, month, year] = datePart.split("/");
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        return date.toLocaleDateString();
      }

      const date = new Date(datePart);
      return date.toLocaleDateString();
    } catch (error) {
      return "Invalid Date";
    }
  };

  const handleSuggestedReply = () => {
    if (suggestedReply) {
      setInput(suggestedReply);
      setSuggestedReply("");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#232328] via-[#1a1a1f] to-[#0f0f14]">
      <header className="bg-[#1c1b20] sticky top-0 z-40 overflow-hidden animate-fadeInUp border-b border-b-[var(--Stroke-Dark,#2c2c2f)] px-3 sm:px-4 lg:px-4">
        <div className="max-w-7xl mx-auto py-3 sm:py-4">
          <div className="flex items-center justify-between">
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
              <span className="text-gray-300 ml-6 hidden lg:flex font-medium transition-colors relative pb-1">
                Create
                <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-3/4 h-[2px] bg-[#d5a514]"></span>
              </span>
              <Link href="/leaderboard" className="hidden lg:block group relative ml-6">
                <span className="text-gray-300 transition-colors duration-200 font-medium">Leaderboard</span>
                <span className="absolute left-0 -bottom-0.5 h-[2px] w-0 bg-[#d5a514] transition-all duration-300 group-hover:w-full"></span>
              </Link>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              {user && (
                <div className="flex items-center gap-1.5 px-3 py-2 bg-[#d5a514]/10 border border-[#d5a514]/30 rounded-lg">
                  <PixelCoins className="w-4 h-4 text-[#d5a514]" />
                  <span className="text-sm font-semibold text-[#d5a514]">{(user.points ?? 0).toLocaleString()}</span>
                </div>
              )}

              <div className="flex gap-1 sm:gap-2 items-center">
                <ConnectButton
                  client={client}
                  chain={chain}
                  wallets={wallets}
                  connectButton={{
                    label: (
                      <>
                        {/* ✅ Proper wallet icon */}
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
                          style={{ marginRight: "2px" }}
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
                      position: "relative",
                      overflow: "hidden",
                      backgroundColor: "#d5a514",
                      color: "white",
                      fontWeight: 600,
                      padding: "0.75rem 0.35rem",
                      borderRadius: "0.375rem",
                      transition: "all 0.2s ease-in-out",
                      cursor: "pointer",
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
                    titleIcon: "",
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

      <div className="max-w-4xl mx-auto px-4 py-8 pb-24 lg:pb-24">
        {messages.length === 0 ? (
          <div className="text-center items-center space-y-8">
            <motion.div
              className="flex justify-center flex-col items-center"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <motion.div
                className="flex items-center justify-center gap-4 mb-8"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                {[
                  { icon: BarChart3, gradient: "from-emerald-500 to-green-600" },
                  { icon: DollarSign, gradient: "from-green-500 to-emerald-600" },
                  { icon: Globe, gradient: "from-teal-500 to-green-600" },
                  {
                    icon: MessageCircle,
                    gradient: "from-lime-600 to-emerald-700",
                    onClick: () => {
                      setShowSuggestions(false);
                      setInput("");

                      const emptyMarketProposal = {
                        title: "",
                        question: "",
                        category: "",
                        end_date: "",
                        resolution_criteria: "",
                        description: "",
                        ai_probability: 0.5,
                        confidence: 0.7,
                        sentiment_score: 0.5,
                        key_factors: [],
                        context: "Custom market",
                        sources: [],
                      };

                      setMarketProposal(emptyMarketProposal);
                      setSelectedSuggestion(null);
                      setEditingMarket(true);
                      setCreatingCustomMarket(true);
                      setCurrentStep(2);
                      setProgress("Creating Custom Market");

                      setMessages((prev) => [
                        ...prev,
                        {
                          role: "ai",
                          content:
                            "Let's create your custom market! Fill in the details below and I'll help you create a prediction market.",
                        },
                      ]);
                    },
                  },
                ].map(({ icon: Icon, onClick }, idx) => (
                  <motion.div
                    key={idx}
                    className={`w-12 h-12 rounded-2xl bg-[#29292e] flex mt-12 items-center justify-center shadow-sm shadow-black/30 ${onClick ? "cursor-pointer hover:shadow-lime-500/20" : ""}`}
                    initial={{ opacity: 0, rotate: -90 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 + idx * 0.1 }}
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    whileTap={onClick ? { scale: 0.95 } : {}}
                    onClick={onClick}
                  >
                    <Icon className="w-6 h-6 text-white" />
                  </motion.div>
                ))}
              </motion.div>

              <motion.h2
                className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold 
             bg-slate-300 bg-clip-text text-transparent text-center leading-tight pb-1"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                Greetings, {user?.username || account?.address.slice(0, 6)} 👋
              </motion.h2>

              <motion.p
                className="text-sm sm:text-base md:text-lg text-gray-300 mt-4 
             max-w-md sm:max-w-lg mx-auto flex flex-wrap items-center 
             justify-center gap-2 text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                Want to create a bet?
                <span
                  onClick={() => {
                    setShowSuggestions(false);
                    setInput("");

                    const emptyMarketProposal = {
                      title: "",
                      question: "",
                      category: "",
                      end_date: "",
                      resolution_criteria: "",
                      description: "",
                      ai_probability: 0,
                      confidence: 0,
                      sentiment_score: 0,
                      key_factors: [],
                      context: "--",
                      sources: [],
                    };

                    setMarketProposal(emptyMarketProposal);
                    setSelectedSuggestion(null);
                    setEditingMarket(true);
                    setCreatingCustomMarket(true);
                    setCurrentStep(2);
                    setProgress("Creating Custom Market");
                    setMarketProposalStartIndex(messages.length);
                    setMessages((prev) => [
                      ...prev,
                      {
                        role: "ai",
                        content: "Let's create your custom market! Fill in the details below and I'll help you create a prediction market.",
                      },
                    ]);
                  }}
                  className="text-[#d5a514] hover:text-[#c49712] cursor-pointer font-medium transition-all duration-200 flex items-center gap-1"
                >
                  <Edit3 className="w-4 h-4" />
                  Create Manually
                </span>
              </motion.p>
            </motion.div>

            <motion.div
              className="space-y-4"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              <p className="text-sm text-gray-400 mb-3 font-medium">
                Or, enter a prompt to get high-quality AI-suggested markets
              </p>
              <div
                className="flex flex-nowrap gap-4 overflow-x-auto lg:overflow-x-hidden lg:justify-between pb-4"
                style={{
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                }}
              >
                {suggestedQuestions?.map((question: any, idx: any) => (
                  <motion.button
                    key={idx}
                    onClick={() => handleSuggestedQuestion(question)}
                    className="group relative flex-shrink-0 w-64 lg:w-auto lg:flex-1 p-6 
                 bg-[#2a2a30]/90 backdrop-blur-sm rounded-2xl text-left 
                 hover:bg-[#323238]/80 transition-all duration-300 overflow-clip"
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.7 + idx * 0.1 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 
                   opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      initial={false}
                    />

                    <div className="relative flex items-start gap-3">
                      <motion.p
                        className="text-gray-300 group-hover:text-white transition-colors 
                     leading-relaxed text-sm break-words"
                        initial={{ opacity: 0.8 }}
                        whileHover={{ opacity: 1 }}
                      >
                        {question}
                      </motion.p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </div>
        ) : (
          <div className="space-y-6 mb-8">
            {messages.map((msg, idx) => (
              <motion.div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.1 }}
              >
                <div
                  className={`max-w-2xl px-6 py-4 rounded-2xl shadow-sm ${
                    msg.role === "user"
                      ? "bg-[#d5a514] text-white ml-12" // replaced emerald gradient
                      : "bg-[#2a2a30]/80 backdrop-blur-sm text-gray-100 border border-gray-600/50 mr-12"
                  }`}
                >
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
              </motion.div>
            ))}

            {marketCreated && (
              <motion.div
                className="mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="bg-[#d5a514]/20 backdrop-blur-sm border border-[#d5a514]/30 rounded-2xl p-8 text-center shadow-lg">
                  <div className="w-16 h-16 bg-[#d5a514] rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-white" />
                  </div>

                  <h3 className="text-2xl font-bold text-white mb-2">Market Created Successfully!</h3>
                  <p className="text-[#ecb62f] mb-6">"{createdMarketTitle}" is now live and ready for trading.</p>

                  <div className="flex gap-4 justify-center flex-wrap">
                    <button
                      onClick={() => router.push("/")}
                      className="px-8 py-3 bg-white text-black rounded-xl font-medium transition-all duration-200 flex items-center gap-2"
                    >
                      <Globe className="w-5 h-5 text-black" />
                      View All Markets
                    </button>

                    <button
                      onClick={() => {
                        setMarketCreated(false);
                        setCreatedMarketTitle("");
                        setEditingMarket(false);
                        setSelectedSuggestion(null);
                        setMarketProposal(null);
                        setCreatingCustomMarket(false);
                        setMessages([]);
                        setCurrentStep(0);
                        setProgress("");
                      }}
                      className="px-8 py-3 bg-[#d5a514] hover:bg-[#b8952e] text-white rounded-xl font-medium transition-all duration-200 flex items-center gap-2"
                    >
                      <Edit3 className="w-5 h-5" />
                      Create Another Market
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {loading && (
              <motion.div
                className="flex justify-start"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div className="bg-gray-800/80 backdrop-blur-sm border border-gray-700/60 rounded-2xl px-6 py-4 mr-12">
                  <div className="flex items-center gap-2 text-gray-400">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-slate-700 rounded-full animate-bounce"></div>
                      <div
                        className="w-2 h-2 bg-slate-700 rounded-full animate-bounce"
                        style={{ animationDelay: "0.1s" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-slate-700 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {showSuggestions && suggestions.length > 0 && !editingMarket && (
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="bg-[#232328] backdrop-blur-sm border border-gray-600/40 rounded-2xl p-4 shadow-lg">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Suggested markets:
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {suggestions.map((suggestion, index) => (
                  <motion.div
                    key={index}
                    className="bg-[#2a2a30]/80 backdrop-blur-sm border border-[#d5a514]/10 rounded-xl p-6 hover:border-[#d5a514]/60 transition-all duration-300"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span className="px-3 py-1 bg-yellow-600/20 text-[#ecb62f] rounded-full text-sm capitalize">
                        {suggestion.category}
                      </span>
                      <button
                        onClick={() => handleSelectSuggestion(index)}
                        disabled={loading}
                        className="px-4 py-2 bg-white text-black rounded-lg font-medium transition-all duration-200 flex items-center gap-2 disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Select
                      </button>
                    </div>

                    <h4 className="text-lg font-semibold text-white mb-2 line-clamp-2">{suggestion.title}</h4>

                    <p className="text-sm text-gray-100 mb-3 line-clamp-2">{suggestion.description}</p>

                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">AI Probability:</span>
                        <span className="text-[#ecb62f] font-medium">
                          {(suggestion.ai_probability * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Confidence:</span>
                        <span className="text-[#ecb62f] font-medium">{(suggestion.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">End Date:</span>
                        <span className="text-gray-100">{formatDateForDisplay(suggestion?.end_date)}</span>
                      </div>
                    </div>

                    {suggestion.key_factors.length > 0 && (
                      <div className="mb-3">
                        <h5 className="text-xs font-semibold text-[#ecb62f] mb-1">Key Factors</h5>
                        <ul className="text-xs text-gray-400 space-y-1">
                          {suggestion.key_factors.slice(0, 2).map((factor, idx) => (
                            <li key={idx} className="flex items-start gap-1">
                              <span className="text-[#ecb62f]">•</span>
                              <span className="line-clamp-1">{factor}</span>
                            </li>
                          ))}
                          {suggestion.key_factors.length > 2 && (
                            <li className="text-gray-500">... and {suggestion.key_factors.length - 2} more</li>
                          )}
                        </ul>
                      </div>
                    )}

                    <div className="text-xs text-gray-500 italic">{suggestion.context}</div>
                  </motion.div>
                ))}
              </div>

              <motion.div
                className="mt-6 p-4 bg-[#d5a514]/10 border border-[#d5a514]/30 rounded-xl"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setShowSuggestions(false);
                      setInput("");

                      const emptyMarketProposal = {
                        title: "",
                        question: "",
                        category: "",
                        end_date: "",
                        resolution_criteria: "",
                        description: "",
                        ai_probability: 0.5,
                        confidence: 0.7,
                        sentiment_score: 0.5,
                        key_factors: [],
                        context: "Custom market created by user",
                        sources: [],
                      };

                      setMarketProposal(emptyMarketProposal);
                      setSelectedSuggestion(null);
                      setEditingMarket(true);
                      setCreatingCustomMarket(true);
                      setCurrentStep(2);
                      setProgress("Creating Custom Market");

                      setMessages((prev) => [
                        ...prev,
                        {
                          role: "ai",
                          content:
                            "Let's create your custom market! Fill in the details below and I'll help you create a prediction market.",
                        },
                      ]);
                    }}
                    className="px-4 py-2 bg-[#d5a514] hover:bg-[#b8952e] text-white rounded-lg font-medium transition-all duration-200 flex items-center gap-2"
                  >
                    <Edit3 className="w-4 h-4" />
                    Create Manually
                  </button>
                  <div className="text-sm text-[#ecb62f]">Create your own market with custom parameters</div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}

        {(marketProposal || selectedSuggestion) && editingMarket && (
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
           <div className="bg-gradient-to-r from-[#2a2a30]/80 to-[#28282f]/80 backdrop-blur-sm border border-gray-600/40 rounded-2xl p-6 shadow-lg">
  <div className="flex justify-between items-center mb-4">
    <h3 className="text-xl font-bold text-white flex items-center gap-2">
      Market Proposal
      <Edit3 className="w-5 h-5 text-[#ecb62f]" />
    </h3>
    
    <div className="flex gap-3 flex-wrap">
      <button
        onClick={onCreateMarket}
        disabled={loading || !account || !!error}
        className="px-6 py-3 bg-[#d5a514] hover:bg-[#c49712] text-white rounded-xl font-medium transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <CheckCircle className="w-4 h-4" />
        {loading ? "Creating..." : "Create Market"}
      </button>
      <button
        onClick={() => {
          setEditingMarket(false);
          setSelectedSuggestion(null);
          setMarketProposal(null);
          setCreatingCustomMarket(false);

          if (creatingCustomMarket) {
            setMessages([]);
            setCurrentStep(0);
            setProgress("");
          } else {
            setShowSuggestions(true);
          }
        }}
        className="px-6 py-3 bg-gradient-to-r from-[#2a2a30] to-[#2f2f35] hover:from-[#2f2f35] hover:to-[#323238] text-white rounded-xl font-medium transition-all duration-200 flex items-center gap-2"
      >
        {creatingCustomMarket ? "Cancel" : "Back"}
      </button>
    </div>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-[#ecb62f] mb-1">Market Question</h4>
        <textarea
          defaultValue={marketProposal?.question || selectedSuggestion?.question || ""}
          className="w-full bg-[#2f2f35]/70 border border-gray-600/50 rounded-lg p-3 text-gray-100 text-sm resize-none focus:border-[#d5a514] focus:outline-none transition-colors"
          rows={3}
          onChange={(e) => {
            setMarketProposal((prev: any) => ({
              ...prev,
              question: e.target.value,
              title: e.target.value.slice(0, 100),
            }));
          }}
          placeholder="What would you like people to predict?"
        />
      </div>
      <div>
        <h4 className="text-sm font-semibold text-[#ecb62f] mb-1">Category</h4>
        <input
          defaultValue={marketProposal?.category || selectedSuggestion?.category || ""}
          onChange={(e) => {
            setMarketProposal((prev: any) => ({
              ...prev,
              category: e.target.value,
            }));
          }}
          className="w-full bg-[#2f2f35]/70 border border-gray-600/50 rounded-lg p-3 text-gray-100 text-sm focus:border-[#d5a514] focus:outline-none transition-colors"
          placeholder="Category (e.g., Crypto, Sports, Politics, Tech)"
        />
      </div>
      <div>
        <h4 className="text-sm font-semibold text-[#ecb62f] mb-1">End Date</h4>
        <input
          type="date"
          defaultValue={
            marketProposal?.end_date
              ? parseDate(marketProposal.end_date)
              : selectedSuggestion?.end_date
                ? parseDate(selectedSuggestion.end_date)
                : ""
          }
          onChange={(e) => {
            const existingDateTime = marketProposal?.end_date;
            let timePortion = "21:18";

            if (existingDateTime && existingDateTime.includes(" ")) {
              timePortion = existingDateTime.split(" ")[1];
            }

            const dateParts = e.target.value.split("-");
            const newDateTime = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]} ${timePortion}`;

            setMarketProposal((prev: any) => ({
              ...prev,
              end_date: newDateTime,
            }));
          }}
          className="w-full bg-[#2f2f35]/70 border border-gray-600/50 rounded-lg p-3 text-gray-100 text-sm focus:border-[#d5a514] focus:outline-none transition-colors"
        />
      </div>
      <div>
        <h4 className="text-sm font-semibold text-[#ecb62f] mb-1 flex items-center gap-2">
          Initial Liquidity (USDT)
          <span className="text-red-400">*</span>
          <div className="relative group">
            <div className="w-4 h-4 bg-gray-600 rounded-full flex items-center justify-center text-xs text-gray-300 cursor-pointer hover:bg-gray-500 transition-colors">
              i
            </div>

            <div className="absolute -left-20 lg:left-0 top-6 bg-gray-900 border border-gray-600 rounded-lg p-3 text-xs text-gray-200 w-64 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
              More liquidity = better trading experience. Min: {minLiquidityFormatted} USDT. Creation fee:{" "}
              {creationFeeFormatted} USDT. Your balance: {balance.toFixed(2)} USDT
            </div>
          </div>
        </h4>

        <div className="relative">
          <input
            type="number"
            min={minLiquidityFormatted}
            step="1"
            value={initialLiquidity}
            onChange={handleLiquidityChange}
            placeholder={`${minLiquidityFormatted}`}
            className={`
              w-full bg-[#2f2f35]/70 border ${
                error ? "border-red-500" : "border-gray-600/50"
              } rounded-lg p-3 text-gray-100 text-sm pr-16
              [appearance:textfield] 
              [&::-webkit-outer-spin-button]:appearance-none 
              [&::-webkit-inner-spin-button]:appearance-none
              focus:outline-none focus:border-[#d5a514] transition-colors
            `}
            required
          />
        </div>

        {error && <p className="text-red-400 text-xs mt-1 flex items-center">{error}</p>}
        <p className="text-xs text-gray-400 mt-1">
          Total required: {(initialLiquidity + creationFeeFormatted).toFixed(2)} USDT (includes{" "}
          {creationFeeFormatted} USDT fee)
        </p>
      </div>
    </div>

    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-[#ecb62f] mb-2">AI Analysis</h4>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-400">AI Probability:</span>
            <span className="text-[#ecb62f] font-medium">
              {((marketProposal?.ai_probability || selectedSuggestion?.ai_probability || 0) * 100).toFixed(
                1,
              )}
              %
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Confidence:</span>
            <span className="text-[#ecb62f] font-medium">
              {((marketProposal?.confidence || selectedSuggestion?.confidence || 0) * 100).toFixed(0)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Sentiment Score:</span>
            <span className="text-[#ecb62f] font-medium">
              {(
                (marketProposal?.sentiment_score || selectedSuggestion?.sentiment_score || 0) * 100
              ).toFixed(1)}
              %
            </span>
          </div>
        </div>
      </div>

      {(marketProposal?.key_factors || selectedSuggestion?.key_factors) && (
        <div>
          <h5 className="text-xs font-semibold text-[#ecb62f] mb-1">Key Factors</h5>
          <ul className="text-xs text-gray-300 space-y-1">
            {(marketProposal?.key_factors || selectedSuggestion?.key_factors || []).map(
              (factor: string, idx: number) => (
                <li key={idx} className="flex items-start gap-1">
                  <span className="text-[#ecb62f]">•</span>
                  {factor}
                </li>
              ),
            )}
          </ul>

          <div>
            <h5 className="text-xs mt-4 font-semibold text-[#ecb62f] mb-1">Context</h5>
            <div className="text-xs text-gray-400 italic">{marketProposal.context}</div>
          </div>
        </div>
      )}
    </div>
  </div>

  <div className="mt-4 pt-4 border-t border-gray-600/30">
    <h4 className="text-sm font-semibold text-[#ecb62f] mb-1">Resolution Criteria</h4>
    <textarea
      defaultValue={marketProposal?.resolution_criteria || selectedSuggestion?.resolution_criteria || ""}
      onChange={(e) => {
        setMarketProposal((prev: any) => ({
          ...prev,
          resolution_criteria: e.target.value,
        }));
      }}
      className="w-full bg-[#2f2f35]/70 border border-gray-600/50 rounded-lg p-3 text-gray-100 text-sm resize-none focus:border-[#d5a514] focus:outline-none transition-colors"
      rows={3}
      placeholder="Describe exactly how this market will be resolved. Be specific and include links to the sources that will determine the outcome."
    />
  </div>
</div>
          </motion.div>
        )}

        <motion.div
          className="sticky bottom-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          {suggestedReply && !showSuggestions && !editingMarket && (
            <motion.div
              className="mb-3 flex justify-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <button
                onClick={handleSuggestedReply}
                className="group px-4 py-2 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 backdrop-blur-sm border border-cyan-500/30 rounded-xl text-cyan-300 text-sm hover:from-cyan-600/30 hover:to-blue-600/30 hover:border-cyan-400/50 transition-all duration-200 flex items-center gap-2"
              >
                <span className="text-xs opacity-70">💡 Suggested:</span>
                <span className="font-medium">"{suggestedReply}"</span>
              </button>
            </motion.div>
          )}

          <div className="bg-gray-800/80 backdrop-blur-sm border border-gray-700/60 rounded-2xl shadow-lg shadow-gray-900/20 p-2 pt-0">
            <div className="flex items-end gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-gray-600 to-slate-600 flex items-center justify-center flex-shrink-0">
                <Circle className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-h-[40px] max-h-32">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={
                    showSuggestions
                      ? "Search suggestions..."
                      : editingMarket
                        ? "Edit market proposal..."
                        : "Ask a question..."
                  }
                  className="w-full resize-none border-none outline-none bg-transparent text-gray-100 placeholder-gray-400 pt-3 px-2 text-base leading-relaxed"
                  style={{ minHeight: "40px" }}
                  rows={1}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = "auto";
                    target.style.height = Math.min(target.scrollHeight, 128) + "px";
                  }}
                  disabled={showSuggestions || editingMarket}
                />
              </div>
              {!showSuggestions && !editingMarket && (
                <motion.button
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                  className="w-10 h-10 rounded-xl bg-[#d5a514] hover:bg-[#b8952e] disabled:bg-gray-600 flex items-center justify-center transition-all duration-200 flex-shrink-0"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Send className="w-4 h-4 text-white" />
                </motion.button>
              )}
            </div>
          </div>
          {!showSuggestions && !editingMarket && (
            <p className="text-xs text-gray-500 text-center mt-3">Press Enter to send, Shift + Enter for new line</p>
          )}
        </motion.div>
      </div>
      <MobileBottomNav />
    </div>
  );
};

export default CreateMarket;
