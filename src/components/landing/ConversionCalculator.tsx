import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { Rocket } from "lucide-react";

const YOUTUBE_RATE = 0.07;
const NFLOW_RATE = 0.17;

const useAnimatedNumber = (target: number, ms = 600) => {
  const [val, setVal] = useState(target);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setVal(target);
      return;
    }
    const start = val;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(start + (target - start) * eased);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return Math.round(val);
};

export const ConversionCalculator = () => {
  const [prospects, setProspects] = useState(100);
  const youtubeResults = useAnimatedNumber(Math.round(prospects * YOUTUBE_RATE));
  const nFlowResults = useAnimatedNumber(Math.round(prospects * NFLOW_RATE));
  const extra = nFlowResults - youtubeResults;
  const yearly = extra * 12;

  const fillPct = ((prospects - 10) / (500 - 10)) * 100;

  return (
    <section className="py-24 relative">
      <div className="container max-w-3xl">
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-3 text-white">
            Calculate Your <span className="gradient-text">Lost Conversions</span>
          </h2>
          <p style={{ color: "#8896B3" }}>
            See exactly how many sales you're leaving on the table.
          </p>
        </motion.div>

        <motion.div
          className="rounded-2xl p-6 md:p-8"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <label className="block text-sm font-medium text-white mb-4">
            How many prospects do you share videos with per month?
            <span className="ml-2 gradient-text font-bold">{prospects}</span>
          </label>

          <div className="relative h-2 rounded-full mb-2" style={{ background: "rgba(255,255,255,0.08)" }}>
            <div
              className="absolute h-2 rounded-full"
              style={{
                width: `${fillPct}%`,
                background: "linear-gradient(90deg, #00C896, #0066FF)",
              }}
            />
            <input
              type="range"
              min={10}
              max={500}
              step={10}
              value={prospects}
              onChange={(e) => setProspects(Number(e.target.value))}
              className="absolute inset-0 w-full h-2 opacity-0 cursor-pointer"
            />
            <div
              className="absolute -top-1.5 w-5 h-5 rounded-full bg-white pointer-events-none"
              style={{
                left: `calc(${fillPct}% - 10px)`,
                boxShadow: "0 0 12px rgba(0,200,150,0.7)",
              }}
            />
          </div>
          <div className="flex justify-between text-xs mb-8" style={{ color: "#8896B3" }}>
            <span>10</span>
            <span>500</span>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div
              className="rounded-xl p-5"
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#EF4444" }}>
                ❌ YouTube
              </div>
              <div className="mt-3 text-xs" style={{ color: "#8896B3" }}>Conversion rate</div>
              <div className="text-sm text-white">6–8%</div>
              <div className="mt-3 text-xs" style={{ color: "#8896B3" }}>Results per month</div>
              <div className="text-5xl font-extrabold mt-1" style={{ color: "#EF4444" }}>
                {youtubeResults}
              </div>
            </div>

            <div
              className="rounded-xl p-5 relative"
              style={{
                background: "rgba(0,200,150,0.08)",
                border: "1px solid rgba(0,200,150,0.3)",
              }}
            >
              <div
                className="absolute -top-3 right-4 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #00C896, #0066FF)" }}
              >
                Most Results
              </div>
              <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#00C896" }}>
                ✅ nFlow
              </div>
              <div className="mt-3 text-xs" style={{ color: "#8896B3" }}>Conversion rate</div>
              <div className="text-sm text-white">16–18%</div>
              <div className="mt-3 text-xs" style={{ color: "#8896B3" }}>Results per month</div>
              <div className="text-5xl font-extrabold mt-1 gradient-text">{nFlowResults}</div>
            </div>
          </div>

          <div
            className="mt-6 rounded-xl p-5 text-center"
            style={{
              background: "linear-gradient(135deg, rgba(0,200,150,0.12), rgba(0,102,255,0.12))",
              border: "1px solid rgba(0,200,150,0.3)",
            }}
          >
            <div className="flex items-center justify-center gap-2 text-white">
              <Rocket size={18} className="text-[#00C896]" />
              <span>
                With nFlow you get <span className="gradient-text font-extrabold text-xl">+{extra}</span>{" "}
                extra results per month
              </span>
            </div>
            <div className="text-sm mt-1" style={{ color: "#C8D0E0" }}>
              That's <span className="font-semibold text-white">+{yearly}</span> extra results per year — from
              the same prospects, with zero extra effort.
            </div>
          </div>

          <div className="text-center mt-6">
            <Link to="/auth?tab=signup">
              <Button
                size="xl"
                className="rounded-full text-white font-semibold border-0"
                style={{
                  background: "linear-gradient(135deg, #00C896, #0066FF)",
                  boxShadow: "0 0 30px rgba(0,200,150,0.35)",
                }}
              >
                Start Free — Get These Results
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
