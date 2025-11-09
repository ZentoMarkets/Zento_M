import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, CandlestickChart, Users, Clock } from "lucide-react";

// Sample high-volume markets data
const highVolumeMarkets = [
  {
    id: 1,
    title: "Will GTA VI release before December 31, 2025?",
    description: "Bet on Rockstar's most anticipated game hitting its projected 2025 launch window as development updates continue.",
    yesPrice: 0.72,
    noPrice: 0.28,
    totalVolume: 35800000,
    participants: 4200,
    timeLeft: "235d left",
    heroImage: "/zento-h.png",
  },
  {
    id: 2,
    title: "Will Taylor Swift announce a new album before her 2025 tour?",
    description: "Trade on whether Swift will drop new music ahead of her global stadium tour, following her pattern of surprise releases.",
    yesPrice: 0.65,
    noPrice: 0.35,
    totalVolume: 28100000,
    participants: 8900,
    timeLeft: "180d left",
    heroImage: "/hero-slide2.png",
  },
  {
    id: 3,
    title: "Will 'Avatar 3' outgross 'Avatar: The Way of Water' worldwide?",
    description: "Predict if James Cameron's next installment can surpass the $2.3B benchmark set by the previous film in the franchise.",
    yesPrice: 0.42,
    noPrice: 0.58,
    totalVolume: 27000000,
    participants: 3200,
    timeLeft: "425d left",
    heroImage: "/zento-h.png",
  },
  {
    id: 4,
    title: "Will an AI-generated song win a Grammy in 2026?",
    description: "Bet on whether AI music will break into mainstream awards as the technology rapidly evolves and gains industry acceptance.",
    yesPrice: 0.38,
    noPrice: 0.62,
    totalVolume: 22600000,
    participants: 5100,
    timeLeft: "665d left",
    heroImage: "/hero-slide2.png",
  },
  {
    id: 5,
    title: "Will the PS5 Pro be announced before July 2025?",
    description: "Trade on Sony's hardware roadmap as industry rumors intensify about the mid-generation console refresh timing.",
    yesPrice: 0.55,
    noPrice: 0.45,
    totalVolume: 19200000,
    participants: 2800,
    timeLeft: "210d left",
    heroImage: "/zento-h.png",
  },
  {
    id: 6,
    title: "Will 'Dune: Part Three' get a greenlight in 2025?",
    description: "Predict the continuation of the sci-fi epic franchise following the critical and commercial success of Part Two.",
    yesPrice: 0.78,
    noPrice: 0.22,
    totalVolume: 15800000,
    participants: 1900,
    timeLeft: "365d left",
    heroImage: "/hero-slide2.png",
  }
];

const HeroSlideshow = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % highVolumeMarkets.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % highVolumeMarkets.length);
    setIsAutoPlaying(false);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + highVolumeMarkets.length) % highVolumeMarkets.length);
    setIsAutoPlaying(false);
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
    setIsAutoPlaying(false);
  };

  const currentMarket = highVolumeMarkets[currentSlide];

  return (
    <div className="bg-[#1a1a1d]">
      {/* Hero Slideshow */}
      <div className="w-full bg-[#2a2a2d] overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 mb-4 pt-8 pb-2 md:pt-8 md:pb-2 lg:py-20">
          <div className="flex flex-col md:flex-row items-start justify-between gap-8 relative">
            {/* Left Content */}
            <div className="flex-1 z-10">
              {/* Market Title */}
              <h1 className="text-3xl md:text-xl lg:text-3xl font-bold text-white mb-4 leading-tight">
                {currentMarket.title}
              </h1>

              {/* Market Description */}
              <p className="text-[#c6c6c7] text-sm md:text-lg max-w-2xl mb-6">{currentMarket.description}</p>

              {/* Volume Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#d5a514]/10 border border-[#d5a514]/30 rounded-lg mb-4">
                <CandlestickChart className="w-4 h-4 text-[#d5a514]" />
                <span className="text-[#d5a514] text-sm font-semibold">
                  {(Number(currentMarket.totalVolume) / 1e6).toFixed(1)}K USDT
                </span>
              </div>

              <div className="flex items-center gap-6 mt-2 mb-5 text-sm text-gray-400">
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {currentMarket.participants?.toLocaleString()} traders
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {currentMarket.timeLeft}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-start">
                {/* <button className="w-40 sm:w-auto px-6 py-2.5 bg-[#d5a514] hover:bg-[#b8952e] text-white rounded-xl font-semibold text-lg transition-all duration-200">
                  Predict
                </button> */}
              </div>

              {/* Market Stats */}
            </div>

            {/* Hero Image - positioned at bottom right */}
            <div
              key={currentSlide}
              className="absolute lg:-bottom-[330px] -bottom-[149px] md:-bottom-[330px] -right-[130px] lg:-right-[280px] w-full md:w-auto md:max-w-md lg:max-w-[49.5rem] transition-opacity duration-500"
              style={{
                animation: "fadeIn 0.5s ease-in-out",
              }}
            >
              <img src={currentMarket.heroImage} alt={currentMarket.title} className="w-full h-auto rounded-lg" />
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between mt-4 relative z-10">
            <div className="flex gap-2">
              {highVolumeMarkets.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    index === currentSlide ? "w-8 bg-[#d5a514]" : "w-2 bg-gray-600 hover:bg-gray-500"
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={prevSlide}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg backdrop-blur-sm transition-colors border border-gray-700"
                aria-label="Previous slide"
              >
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={nextSlide}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg backdrop-blur-sm transition-colors border border-gray-700"
                aria-label="Next slide"
              >
                <ChevronRight className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default HeroSlideshow;
