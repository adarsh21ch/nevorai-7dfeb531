import { useState, Fragment } from "react";
import { motion } from "framer-motion";

type Step = {
  icon: string;
  label: string;
  bad?: boolean;
  good?: boolean;
  leak?: string;
  isEnd?: boolean;
};

const youtubeRoute: Step[] = [
  { icon: "📱", label: "Gets link" },
  { icon: "🎬", label: "Opens YouTube" },
  { icon: "📺", label: "Sees recommendations", bad: true, leak: "23 leave" },
  { icon: "💬", label: "Comments distract", bad: true, leak: "18 leave" },
  { icon: "⏭", label: "Skips ahead", bad: true, leak: "21 miss pitch" },
  { icon: "📹", label: "Next video autoplays", bad: true, leak: "27 forget" },
  { icon: "✗", label: "Lost forever", bad: true, isEnd: true },
];

const nflowRoute: Step[] = [
  { icon: "📱", label: "Gets link" },
  { icon: "🎯", label: "Opens nFlow" },
  { icon: "🔒", label: "Can't skip", good: true },
  { icon: "📋", label: "Fills name + phone", good: true },
  { icon: "📱", label: "WhatsApp sent auto", good: true },
  { icon: "🔔", label: "Follow-up scheduled", good: true },
  { icon: "✓", label: "Converted!", good: true, isEnd: true },
];

const journeyStyles = `
@keyframes pulse-travel {
  0% { left: 0%; opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { left: 100%; opacity: 0; }
}
.route-line { position: relative; overflow: visible; }
.route-line::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 10px; height: 10px;
  border-radius: 50%;
  margin-top: -5px;
  animation: pulse-travel 3s linear infinite;
}
.youtube-route-line::after {
  background: #EF4444;
  box-shadow: 0 0 10px rgba(239,68,68,0.9);
  animation-duration: 4s;
}
.nflow-route-line::after {
  background: #00C896;
  box-shadow: 0 0 10px rgba(0,200,150,0.9);
  animation-duration: 2.5s;
}

.leak-badge {
  position: absolute;
  top: -22px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: 20px;
  padding: 2px 8px;
  font-size: 10px;
  color: #EF4444;
  white-space: nowrap;
  font-weight: 600;
  pointer-events: none;
}
.leak-badge::before { content: '↓ '; font-size: 9px; }

@keyframes failure-pulse {
  0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.6); }
  70% { box-shadow: 0 0 0 14px rgba(239,68,68,0); }
  100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
}
@keyframes success-pulse {
  0% { box-shadow: 0 0 0 0 rgba(0,200,150,0.6); }
  70% { box-shadow: 0 0 0 16px rgba(0,200,150,0); }
  100% { box-shadow: 0 0 0 0 rgba(0,200,150,0); }
}
.youtube-end-node { animation: failure-pulse 2s ease-out infinite; }
.nflow-end-node { animation: success-pulse 2s ease-out infinite; }

@media (prefers-reduced-motion: reduce) {
  .route-line::after, .youtube-end-node, .nflow-end-node {
    animation: none !important;
  }
}
`;

export const ProspectJourney = () => {
  const [activeRoute, setActiveRoute] = useState<"youtube" | "nflow">("youtube");

  const renderDesktopRoute = (route: Step[], variant: "youtube" | "nflow") => {
    const isYT = variant === "youtube";
    const nodeBase =
      "w-12 h-12 rounded-full flex items-center justify-center text-xl flex-shrink-0 transition-all";
    const lineGradient = isYT
      ? "from-red-500/60 to-red-500/40"
      : "from-emerald-500/60 to-blue-500/40";
    const arrowColor = isYT ? "border-l-red-500/60" : "border-l-emerald-500/60";

    return (
      <div className="flex items-start pb-12">
        {route.map((step, i) => {
          const endClass = step.isEnd
            ? isYT
              ? "youtube-end-node !w-14 !h-14 !bg-red-500/25 !text-red-400 font-bold !text-2xl"
              : "nflow-end-node !w-14 !h-14 !text-emerald-500 font-bold !text-2xl"
            : "";
          const nodeClass = isYT
            ? `${nodeBase} ${
                step.bad
                  ? "bg-red-500/15 border-2 border-red-500"
                  : "bg-red-500/10 border-2 border-red-500/50"
              } ${endClass}`
            : `${nodeBase} ${
                step.good
                  ? "bg-emerald-500/15 border-2 border-emerald-500"
                  : "bg-emerald-500/10 border-2 border-emerald-500/40"
              } ${endClass}`;
          return (
            <Fragment key={i}>
              <motion.div
                className="flex flex-col items-center relative"
                initial={{ opacity: 0, scale: 0.5 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                style={{ paddingTop: step.leak ? 26 : 0 }}
              >
                {step.leak && (
                  <span className="leak-badge">−{step.leak}</span>
                )}
                <div
                  className={nodeClass}
                  style={
                    !isYT && step.isEnd
                      ? {
                          background:
                            "linear-gradient(135deg, rgba(0,200,150,0.3), rgba(0,102,255,0.3))",
                        }
                      : undefined
                  }
                >
                  {step.icon}
                </div>
                <span
                  className="text-[11px] mt-2 text-center max-w-[80px] leading-tight"
                  style={{ color: "#1A202C" }}
                >
                  {step.label}
                </span>
              </motion.div>
              {i < route.length - 1 && (
                <div
                  className={`route-line ${isYT ? "youtube-route-line" : "nflow-route-line"} flex-1 h-[3px] bg-gradient-to-r ${lineGradient} mx-1 mt-6 min-w-[24px]`}
                >
                  <div
                    className={`absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[8px] ${arrowColor}`}
                  />
                </div>
              )}
            </Fragment>
          );
        })}
      </div>
    );
  };

  const activeSteps = activeRoute === "youtube" ? youtubeRoute : nflowRoute;
  const isYT = activeRoute === "youtube";

  return (
    <section
      className="py-24 px-4 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #F0FFF8, #EFF6FF)" }}
    >
      <style>{journeyStyles}</style>
      <div className="container max-w-6xl">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2
            className="text-3xl md:text-4xl font-heading font-bold mb-3"
            style={{ color: "#0A1628" }}
          >
            Same Prospect.{" "}
            <span
              style={{
                background: "linear-gradient(90deg, #00C896, #0066FF)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Two Very Different Routes.
            </span>
          </h2>
          <p style={{ color: "#4A5568" }} className="max-w-xl mx-auto">
            See exactly where the YouTube route goes wrong — and how nFlow keeps them on track.
          </p>
        </motion.div>

        {/* DESKTOP */}
        <div className="hidden md:block space-y-14">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="flex items-center gap-3 mb-6">
              <span className="font-bold text-lg" style={{ color: "#DC2626" }}>
                ❌ YouTube Route
              </span>
              <span className="text-sm" style={{ color: "rgba(220,38,38,0.7)" }}>
                — 6–8% conversion
              </span>
            </div>
            {renderDesktopRoute(youtubeRoute, "youtube")}
          </motion.div>

          <div className="flex items-center gap-3 my-2">
            <div className="flex-1 h-px" style={{ background: "rgba(0,0,0,0.08)" }} />
            <span className="text-xs uppercase tracking-widest" style={{ color: "#6B7A99" }}>vs</span>
            <div className="flex-1 h-px" style={{ background: "rgba(0,0,0,0.08)" }} />
          </div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="flex items-center gap-3 mb-6">
              <span
                className="font-bold text-lg"
                style={{
                  background: "linear-gradient(90deg, #00C896, #0066FF)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                ✅ nFlow Route
              </span>
              <span className="text-sm" style={{ color: "rgba(0,150,100,0.8)" }}>
                — 16–18% conversion
              </span>
            </div>
            {renderDesktopRoute(nflowRoute, "nflow")}
          </motion.div>
        </div>

        {/* MOBILE */}
        <div className="md:hidden">
          <div className="flex justify-center gap-3 mb-8">
            <button
              onClick={() => setActiveRoute("youtube")}
              className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                isYT
                  ? "bg-red-500/15 border border-red-500/50 text-red-600"
                  : "bg-white border border-gray-200 text-gray-500"
              }`}
            >
              ❌ YouTube
            </button>
            <button
              onClick={() => setActiveRoute("nflow")}
              className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                !isYT
                  ? "bg-emerald-500/15 border border-emerald-500/50 text-emerald-600"
                  : "bg-white border border-gray-200 text-gray-500"
              }`}
            >
              ✅ nFlow
            </button>
          </div>

          <div className="flex flex-col items-start px-6 max-w-sm mx-auto">
            {activeSteps.map((step, i, arr) => (
              <Fragment key={i}>
                <motion.div
                  className="flex items-center gap-4 w-full"
                  initial={{ opacity: 0, scale: 0.7 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${
                      isYT
                        ? `bg-red-500/10 border-2 border-red-500/50 ${
                            step.isEnd ? "youtube-end-node" : ""
                          }`
                        : `bg-emerald-500/10 border-2 border-emerald-500/50 ${
                            step.isEnd ? "nflow-end-node" : ""
                          }`
                    }`}
                  >
                    {step.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: "#0A1628" }}>
                      {step.label}
                    </p>
                    {step.leak && (
                      <p className="text-red-500 text-xs mt-0.5">↓ {step.leak}</p>
                    )}
                    {step.good && (
                      <p className="text-emerald-600 text-xs mt-0.5">✓ controlled</p>
                    )}
                  </div>
                </motion.div>
                {i < arr.length - 1 && (
                  <div
                    className={`w-0.5 h-6 my-1 ml-6 ${
                      isYT ? "bg-red-500/30" : "bg-emerald-500/30"
                    }`}
                  />
                )}
              </Fragment>
            ))}
          </div>

          <div
            className={`mx-6 mt-8 p-4 rounded-xl text-center ${
              isYT
                ? "bg-red-500/10 border border-red-500/20"
                : "bg-emerald-500/10 border border-emerald-500/20"
            }`}
          >
            <p
              className="text-2xl font-bold"
              style={{ color: isYT ? "#DC2626" : "#00C896" }}
            >
              {isYT ? "6–8%" : "16–18%"}
            </p>
            <p className="text-sm" style={{ color: "#4A5568" }}>
              {isYT ? "conversion rate 📉" : "conversion rate 📈"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
