import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type TabKey = "youtube" | "nFlow by Nevorai";

type Step = {
  count: number;
  label: string;
  sublabel: string | null;
  barWidth: number;
  isFinal?: boolean;
};

const youtubeSteps: Step[] = [
  { count: 100, label: "Prospects receive and open your YouTube link", sublabel: null, barWidth: 100 },
  { count: 74, label: "Still watching after YouTube recommends other videos", sublabel: "−26 leave immediately for recommended content", barWidth: 74 },
  { count: 52, label: "Didn't get distracted by comments below the video", sublabel: "−22 scroll down, start engaging with comments", barWidth: 52 },
  { count: 31, label: "Watched without skipping ahead to the end", sublabel: "−21 skip forward, miss your entire pitch", barWidth: 31 },
  { count: 8, label: "No follow-up system — only 8 accidentally convert", sublabel: "−23 YouTube autoplays next video, they forget you exist", barWidth: 8, isFinal: true },
];

const nflowSteps: Step[] = [
  { count: 100, label: "Prospects open your nFlow by Nevorai link", sublabel: "Clean player loads instantly — no distractions anywhere", barWidth: 100 },
  { count: 96, label: "Watch in a fully distraction-free environment", sublabel: "No recommendations. No comments. No autoplay. Just your video.", barWidth: 96 },
  { count: 91, label: "Watch your full message — skip is disabled", sublabel: "They hear every word of your pitch, not just the first 30 seconds", barWidth: 91 },
  { count: 71, label: "Enter their name + phone when prompted", sublabel: "Lead captured automatically — goes straight to your dashboard", barWidth: 71 },
  { count: 18, label: "Convert after your automated WhatsApp follow-up", sublabel: "WhatsApp sent the moment video ends. Follow-up reminders scheduled.", barWidth: 18, isFinal: true },
];

type Theme = {
  numberColor: string;
  numberFinalColor: string;
  labelColor: string;
  sublabelColor: string;
  sublabelPrefix: string;
  finalLabel: string;
  barClass: (i: number, isFinal: boolean) => string;
  barStyle?: (i: number, isFinal: boolean) => React.CSSProperties;
};

const youtubeTheme: Theme = {
  numberColor: "text-gray-900",
  numberFinalColor: "text-brand-red",
  labelColor: "text-gray-800",
  sublabelColor: "text-brand-red",
  sublabelPrefix: "↓",
  finalLabel: "8% converted 📉",
  barClass: (_i, isFinal) => isFinal ? "bg-gradient-danger" : "",
  barStyle: (i, isFinal) => isFinal ? {} : { background: `rgba(239, 68, 68, ${0.25 + i * 0.1})` },
};

const nflowTheme: Theme = {
  numberColor: "text-white",
  numberFinalColor: "text-emerald-400",
  labelColor: "text-gray-100",
  sublabelColor: "text-emerald-300",
  sublabelPrefix: "✓",
  finalLabel: "16–18% converted 📈",
  barClass: (_i, isFinal) => isFinal ? "bg-gradient-brand-soft" : "",
  barStyle: (i, isFinal) => isFinal ? {} : {
    background: `linear-gradient(90deg, rgba(0,200,150,${0.25 + i * 0.12}), rgba(0,102,255,${0.25 + i * 0.12}))`,
  },
};

const FunnelRow = ({ step, i, theme }: { step: Step; i: number; theme: Theme }) => {
  const isFinal = !!step.isFinal;
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: i * 0.08 }}
    >
      <div className="flex items-center gap-4 md:gap-6">
        <div className="w-16 md:w-24 shrink-0 text-right leading-none">
          <span
            className={`font-bold ${isFinal ? theme.numberFinalColor : theme.numberColor}`}
            style={{ fontSize: isFinal ? 48 : 32, lineHeight: 1 }}
          >
            {step.count}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <motion.div
            className={`funnel-bar rounded-r-lg flex items-center px-4 ${theme.barClass(i, isFinal)}`}
            style={{ height: 40, ...(theme.barStyle?.(i, isFinal) ?? {}) }}
            initial={{ width: 0 }}
            whileInView={{ width: `${step.barWidth}%` }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 + i * 0.08, ease: "easeOut" }}
          >
            {isFinal && (
              <span className="text-white text-xs md:text-sm font-bold whitespace-nowrap">
                {theme.finalLabel}
              </span>
            )}
          </motion.div>
        </div>
      </div>
      <div className="mt-2 pl-20 md:pl-[120px]">
        <div className={`text-sm md:text-base font-semibold ${theme.labelColor}`}>{step.label}</div>
        {step.sublabel && (
          <div className={`text-xs md:text-sm mt-0.5 ${theme.sublabelColor}`}>
            {theme.sublabelPrefix} {step.sublabel}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export const LeakyFunnel = () => {
  const [activeTab, setActiveTab] = useState<TabKey>("youtube");

  useEffect(() => {
    if (activeTab !== "youtube") return;
    const t = setTimeout(() => setActiveTab("nFlow by Nevorai"), 6000);
    return () => clearTimeout(t);
  }, [activeTab]);

  const isDark = activeTab === "nFlow by Nevorai";

  return (
    <section
      className={`relative overflow-hidden transition-colors duration-700 ease-out py-20 px-4 md:px-8 ${
        isDark ? "bg-hero-bg" : "bg-rose-50"
      }`}
    >
      {isDark && (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-32 -right-32 w-[480px] max-w-[60vw] h-[480px] rounded-full blur-3xl opacity-30"
            style={{ background: "radial-gradient(circle, #00C896 0%, transparent 70%)" }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-40 -left-40 w-[520px] max-w-[60vw] h-[520px] rounded-full blur-3xl opacity-25"
            style={{ background: "radial-gradient(circle, #0066FF 0%, transparent 70%)" }}
          />
        </>
      )}
      {!isDark && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 -left-32 w-[420px] max-w-[60vw] h-[420px] rounded-full blur-3xl opacity-30"
          style={{ background: "radial-gradient(circle, #ef4444 0%, transparent 70%)" }}
        />
      )}

      <div className="relative max-w-5xl mx-auto">
        {/* Tab switcher */}
        <div className="flex justify-center mb-4">
          <div
            className={`inline-flex items-center gap-1 p-1.5 rounded-2xl border transition-colors duration-700 ${
              isDark ? "bg-white/5 border-white/10" : "bg-white border-gray-200 shadow-sm"
            }`}
          >
            <button
              onClick={() => setActiveTab("youtube")}
              className={`flex items-center gap-2.5 px-5 md:px-6 py-3 rounded-xl text-sm md:text-base font-semibold transition-all duration-300 min-h-11 ${
                activeTab === "youtube"
                  ? "bg-white shadow-sm text-red-600"
                  : isDark ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <span className="text-lg">📺</span>
              Without nFlow by Nevorai
            </button>
            <button
              onClick={() => setActiveTab("nFlow by Nevorai")}
              className={`flex items-center gap-2.5 px-5 md:px-6 py-3 rounded-xl text-sm md:text-base font-semibold transition-all duration-300 min-h-11 ${
                activeTab === "nFlow by Nevorai"
                  ? "text-white shadow-lg bg-gradient-brand"
                  : isDark ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <span className="text-lg">🎯</span>
              With nFlow by Nevorai
            </button>
          </div>
        </div>

        {/* Auto-switch progress bar */}
        <div className="h-1 w-full max-w-xs mx-auto mb-12 overflow-hidden">
          {activeTab === "youtube" && (
            <div
              className="h-full bg-red-400/60 rounded-full"
              style={{ animation: "leakyFill 6s linear forwards" }}
            />
          )}
        </div>

        <style>{`@keyframes leakyFill { from { width: 0%; } to { width: 100%; } }`}</style>

        <AnimatePresence mode="wait">
          {activeTab === "youtube" ? (
            <motion.div
              key="youtube"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4 }}
            >
              <div className="text-center mb-12 max-w-3xl mx-auto">
                <div className="inline-block text-xs font-semibold tracking-wider uppercase text-red-600 bg-red-100 px-3 py-1.5 rounded-full mb-4">
                  The Leaky Funnel
                </div>
                <h2 className="text-3xl md:text-5xl font-bold text-gray-900 leading-tight">
                  Where Your Prospects
                  <br />
                  <span className="text-red-600">Are Leaking Right Now</span>
                </h2>
                <p className="mt-4 text-base md:text-lg text-gray-600">
                  Every time you send a YouTube link, this is what actually happens.
                </p>
              </div>

              <div className="space-y-4 md:space-y-5">
                {youtubeSteps.map((step, i) => (
                  <FunnelRow key={i} step={step} i={i} theme={youtubeTheme} />
                ))}
              </div>

              <div className="mt-14 text-center max-w-2xl mx-auto">
                <p className="text-xl md:text-2xl font-bold text-gray-900">
                  92 prospects lost. YouTube kept them — you didn't.
                </p>
                <p className="mt-2 text-sm md:text-base text-gray-600">
                  Not because your content is bad. Because YouTube works against you.
                </p>
                <button
                  onClick={() => setActiveTab("nFlow by Nevorai")}
                  className="mt-6 inline-flex items-center gap-2 bg-red-500 text-white text-sm md:text-base font-semibold px-6 py-3 rounded-xl hover:bg-red-600 transition-colors min-h-11"
                >
                  See what nFlow by Nevorai does differently →
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="nFlow by Nevorai"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4 }}
            >
              <div className="text-center mb-12 max-w-3xl mx-auto">
                <div className="inline-block text-xs font-semibold tracking-wider uppercase text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full mb-4">
                  The nFlow by Nevorai Difference
                </div>
                <h2 className="text-3xl md:text-5xl font-bold text-white leading-tight">
                  What Happens When You
                  <br />
                  Send an <span className="text-gradient-brand">nFlow by Nevorai Link</span> Instead
                </h2>
                <p className="mt-4 text-base md:text-lg text-gray-400">
                  Same prospect. Same video. Completely different outcome.
                </p>
              </div>

              <div className="space-y-4 md:space-y-5">
                {nflowSteps.map((step, i) => (
                  <FunnelRow key={i} step={step} i={i} theme={nflowTheme} />
                ))}
              </div>

              <p className="text-gray-500 text-xs mt-6 text-center max-w-sm mx-auto">
                Not every captured lead joins immediately — and that's normal.
                nFlow by Nevorai keeps following up automatically until they're ready.
              </p>

              <div className="mt-10 max-w-4xl mx-auto">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 p-6 md:p-8 rounded-2xl border border-white/10 bg-white/[0.03]">
                  <div className="text-center">
                    <p className="text-red-400 text-3xl md:text-4xl font-black">8</p>
                    <p className="text-gray-500 text-xs mt-1">YouTube conversions</p>
                    <p className="text-gray-600 text-xs">0 leads captured</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl md:text-4xl font-black text-gradient-brand">18</p>
                    <p className="text-gray-500 text-xs mt-1">nFlow by Nevorai conversions</p>
                    <p className="text-emerald-500 text-xs">71 leads captured</p>
                  </div>
                  <div className="text-center">
                    <p className="text-white text-3xl md:text-4xl font-black">+125%</p>
                    <p className="text-gray-500 text-xs mt-1">more conversions</p>
                    <p className="text-gray-600 text-xs">from same prospects</p>
                  </div>
                  <div className="text-center">
                    <p className="text-white text-3xl md:text-4xl font-black">Auto</p>
                    <p className="text-gray-500 text-xs mt-1">WhatsApp follow-up</p>
                    <p className="text-emerald-500 text-xs">zero manual work</p>
                  </div>
                </div>

                <p className="mt-8 text-center text-xl md:text-2xl font-bold text-white">
                  Same 100 prospects. Same content. 125% more conversions.
                </p>
                <p className="mt-2 text-center text-sm md:text-base text-gray-400">
                  The only difference is the link you share.
                </p>

                <div className="mt-8 text-center">
                  <a
                    href="/auth"
                    className="inline-flex items-center gap-2 text-white text-sm md:text-base font-semibold px-7 py-3.5 rounded-xl shadow-lg hover:opacity-90 transition-opacity bg-gradient-brand min-h-11"
                  >
                    Start Your Free 7-Day Trial →
                  </a>
                  <p className="mt-3 text-xs text-gray-500">No card needed. Full access for 7 days.</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};

export default LeakyFunnel;
