import { useEffect, useState } from "react";
import { Video, ClipboardList, MessageCircle, BarChart3, Radio, Bell, ChevronRight } from "lucide-react";

const features = [
  {
    Icon: Video,
    title: "Video Funnels",
    desc: "Share distraction-free videos. Skip disabled. CTA at the end.",
    color: "#00C896",
  },
  {
    Icon: ClipboardList,
    title: "Lead Capture",
    desc: "Collect name + phone at the right moment — mid-video or at end.",
    color: "#0066FF",
  },
  {
    Icon: MessageCircle,
    title: "WhatsApp Automation",
    desc: "Auto-send a WhatsApp message the moment they finish watching.",
    color: "#25D366",
  },
  {
    Icon: BarChart3,
    title: "Prospect Analytics",
    desc: "See who watched, how far, and who's ready to convert.",
    color: "#8B5CF6",
  },
  {
    Icon: Radio,
    title: "Live Sessions",
    desc: "Host live video sessions with real-time audience engagement.",
    color: "#EF4444",
  },
  {
    Icon: Bell,
    title: "Smart Reminders",
    desc: "Auto follow-up sequences for prospects who didn't respond.",
    color: "#F59E0B",
  },
];

const VideoFunnelDemo = () => (
  <div className="demo-box">
    <div className="demo-line" style={{ color: "#8896B3", fontSize: 12, marginBottom: 14 }}>▶ Business Opportunity Session</div>
    <div className="player-bar"><div className="player-fill" /></div>
    <div className="flex items-center justify-between mt-3">
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>4:23 / 18:45</span>
      <span className="skip-pill">🔒 Skip disabled</span>
    </div>
    <div className="grid grid-cols-3 gap-2 mt-5">
      {[["47", "watched"], ["31", "leads"], ["18%", "converted"]].map(([n, l]) => (
        <div key={l} className="stat-cell">
          <div className="stat-num">{n}</div>
          <div className="stat-lab">{l}</div>
        </div>
      ))}
    </div>
  </div>
);

const LeadCaptureDemo = () => (
  <div className="demo-box">
    <div className="capture-tag">🎯 Captured at 6:30 of 12:00</div>
    <label className="lbl">Your Name</label>
    <div className="inp">Rahul Sharma<span className="cursor" /></div>
    <label className="lbl mt-3">WhatsApp Number</label>
    <div className="inp flex items-center justify-between">+91 98765 43210<span className="dot-live" /></div>
    <button className="cta-btn">Continue Watching →</button>
  </div>
);

const WhatsAppDemo = () => (
  <div className="demo-box">
    <div className="flex items-center gap-2 mb-3">
      <div className="wa-avatar">N</div>
      <div>
        <div style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>nFlow Auto</div>
        <div style={{ fontSize: 10, color: "#25D366" }}>● online</div>
      </div>
    </div>
    <div className="wa-msg">Hi Rahul! 👋 Thanks for watching the Business Opportunity video.</div>
    <div className="wa-meta">9:41 AM ✓✓</div>
    <div className="wa-msg" style={{ animationDelay: "0.4s" }}>Ready to take the next step? Let's connect! 🚀</div>
    <div className="wa-meta">9:41 AM ✓✓</div>
    <div className="wa-foot">Sent automatically • 0 seconds after video ended</div>
  </div>
);

const AnalyticsDemo = () => (
  <div className="demo-box">
    <div style={{ fontSize: 12, color: "#fff", fontWeight: 600, marginBottom: 10 }}>Prospect Watch Activity</div>
    {[
      { name: "Rahul S.", pct: 94, status: "Hot", color: "#EF4444" },
      { name: "Priya M.", pct: 78, status: "Warm", color: "#F59E0B" },
      { name: "Anil K.", pct: 45, status: "Cold", color: "#60A5FA" },
    ].map((p) => (
      <div key={p.name} className="grid items-center gap-2 py-2" style={{ gridTemplateColumns: "70px 1fr 36px 50px" }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}>{p.name}</span>
        <div className="bar-wrap"><div className="bar-fill" style={{ width: `${p.pct}%` }} /></div>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", textAlign: "right" }}>{p.pct}%</span>
        <span className="status-pill" style={{ background: `${p.color}22`, color: p.color, borderColor: `${p.color}55` }}>{p.status}</span>
      </div>
    ))}
  </div>
);

const LiveSessionsDemo = () => (
  <div className="demo-box flex flex-col items-center justify-center" style={{ minHeight: 240 }}>
    <div className="live-avatar">🎙</div>
    <div style={{ fontSize: 14, color: "#fff", fontWeight: 600, marginTop: 12 }}>Adarsh — Live</div>
    <div className="flex items-center gap-3 mt-4">
      <div className="live-pill"><span className="live-dot-anim" /> LIVE</div>
      <div className="viewer-pill">👁 247 watching</div>
    </div>
  </div>
);

const RemindersDemo = () => (
  <div className="demo-box">
    <div style={{ fontSize: 12, color: "#fff", fontWeight: 600, marginBottom: 12 }}>Follow-up Sequence — Rahul S.</div>
    {[
      { time: "Immediately", msg: "WhatsApp sent auto", done: true },
      { time: "Day 1", msg: 'Reminder: "Any questions?"', done: true },
      { time: "Day 3", msg: "Check-in message", done: false },
      { time: "Day 7", msg: "Final follow-up", done: false },
    ].map((r) => (
      <div key={r.time} className="flex items-start gap-3 py-2">
        <div className={`step-check ${r.done ? "done" : ""}`}>{r.done ? "✓" : ""}</div>
        <div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{r.time}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.9)" }}>{r.msg}</div>
        </div>
      </div>
    ))}
  </div>
);

const demos = [VideoFunnelDemo, LeadCaptureDemo, WhatsAppDemo, AnalyticsDemo, LiveSessionsDemo, RemindersDemo];

export const FeaturesSection = () => {
  const [activeFeature, setActiveFeature] = useState(0);
  const [userSelected, setUserSelected] = useState(false);

  useEffect(() => {
    if (userSelected) return;
    const t = setInterval(() => setActiveFeature((p) => (p + 1) % features.length), 4000);
    return () => clearInterval(t);
  }, [userSelected]);

  const ActiveDemo = demos[activeFeature];
  const active = features[activeFeature];

  return (
    <section id="features" className="features-section relative" style={{ background: "#080F20" }}>
      <style>{showcaseStyles}</style>
      <div className="container relative z-10 max-w-6xl px-4">
        <div className="text-center mb-10">
          <span className="features-badge">Everything in one platform</span>
          <h2 className="features-h2">
            Built to Convert.{" "}
            <span style={{ background: "linear-gradient(90deg, #00C896, #0066FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Not Just to Play Videos.
            </span>
          </h2>
          <p className="features-p">
            Every feature works together — from share to lead to follow-up to conversion.
          </p>
        </div>

        {/* Desktop: list + demo */}
        <div className="hidden md:grid showcase-grid">
          <div className="feature-list">
            {features.map((f, i) => {
              const Icon = f.Icon;
              const isActive = activeFeature === i;
              return (
                <button
                  key={f.title}
                  onClick={() => { setActiveFeature(i); setUserSelected(true); }}
                  className={`feature-row ${isActive ? "active" : ""}`}
                  style={isActive ? { borderLeftColor: f.color, background: `${f.color}14` } : undefined}
                >
                  <div className="feature-icon" style={{ background: `${f.color}22`, borderColor: `${f.color}55`, color: f.color }}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="feature-title" style={isActive ? { color: "#fff" } : undefined}>{f.title}</div>
                    <div className="feature-desc">{f.desc}</div>
                  </div>
                  {isActive && <ChevronRight size={18} style={{ color: f.color }} />}
                </button>
              );
            })}
          </div>

          <div className="demo-panel" style={{ ["--glow" as string]: `${active.color}22` }}>
            <div className="demo-glow" />
            <div className="demo-content" key={activeFeature}>
              <ActiveDemo />
            </div>
          </div>
        </div>

        {/* Mobile: tabs + demo */}
        <div className="md:hidden">
          <div className="mobile-tabs">
            {features.map((f, i) => {
              const Icon = f.Icon;
              const isActive = activeFeature === i;
              return (
                <button
                  key={f.title}
                  onClick={() => { setActiveFeature(i); setUserSelected(true); }}
                  className={`mobile-tab ${isActive ? "active" : ""}`}
                  style={isActive ? { background: `${f.color}22`, borderColor: `${f.color}66`, color: f.color } : undefined}
                >
                  <Icon size={14} />
                  {f.title}
                </button>
              );
            })}
          </div>
          <div className="demo-panel mt-4">
            <div className="demo-content" key={`m-${activeFeature}`}>
              <ActiveDemo />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const showcaseStyles = `
.features-section { padding: 100px 0; }
.features-badge {
  display: inline-block;
  font-size: 12px;
  color: #00C896;
  background: rgba(0,200,150,0.1);
  border: 1px solid rgba(0,200,150,0.25);
  border-radius: 20px;
  padding: 5px 16px;
  margin-bottom: 16px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  font-weight: 600;
}
.features-h2 { font-size: 36px; font-weight: 800; color: #fff; line-height: 1.2; margin-bottom: 10px; }
.features-p { font-size: 15px; color: #6B7A99; max-width: 520px; margin: 0 auto; }

.showcase-grid {
  grid-template-columns: 320px 1fr;
  gap: 28px;
  background: #0D1526;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 24px;
  padding: 12px;
  align-items: stretch;
}

.feature-list { display: flex; flex-direction: column; }
.feature-row {
  display: flex; align-items: flex-start; gap: 14px;
  padding: 16px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  border-left: 2px solid transparent;
  background: transparent;
  transition: all 0.2s ease;
  border-radius: 8px;
}
.feature-row:last-child { border-bottom: none; }
.feature-row:hover { background: rgba(255,255,255,0.03); }
.feature-icon {
  width: 36px; height: 36px;
  border-radius: 10px;
  border: 1px solid;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.feature-title { font-size: 14px; font-weight: 600; color: #C8D0E0; margin-bottom: 3px; }
.feature-desc { font-size: 12px; color: #6B7A99; line-height: 1.45; }

.demo-panel {
  position: relative;
  background: #0A1120;
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 18px;
  padding: 22px;
  min-height: 360px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.demo-glow {
  position: absolute; inset: 0;
  background: radial-gradient(circle at 30% 20%, var(--glow), transparent 60%);
  pointer-events: none;
}
.demo-content {
  position: relative; z-index: 1; width: 100%;
  animation: demo-in 0.4s ease-out;
}
@keyframes demo-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

.demo-box {
  background: rgba(0,0,0,0.35);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px;
  padding: 18px;
  width: 100%;
  max-width: 460px;
  margin: 0 auto;
}

/* Video demo */
.player-bar { height: 5px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden; }
.player-fill {
  height: 100%; width: 40%;
  background: linear-gradient(90deg, #00C896, #0066FF);
  animation: bar-bounce 3s ease-in-out infinite;
}
@keyframes bar-bounce { 0%,100% { width: 40%; } 50% { width: 70%; } 65% { width: 40%; } }
.skip-pill {
  font-size: 11px; color: #00C896;
  background: rgba(0,200,150,0.12);
  padding: 3px 10px; border-radius: 20px;
  border: 1px solid rgba(0,200,150,0.3);
}
.stat-cell { background: rgba(255,255,255,0.04); border-radius: 8px; padding: 10px; text-align: center; }
.stat-num { font-size: 18px; font-weight: 700; color: #fff; }
.stat-lab { font-size: 10px; color: rgba(255,255,255,0.5); margin-top: 2px; }

/* Capture form */
.capture-tag {
  font-size: 11px; color: #0066FF;
  background: rgba(0,102,255,0.1);
  border: 1px solid rgba(0,102,255,0.3);
  border-radius: 12px;
  padding: 4px 10px;
  display: inline-block;
  margin-bottom: 14px;
}
.lbl { display: block; font-size: 10px; color: rgba(255,255,255,0.5); margin-bottom: 4px; margin-top: 0; }
.inp {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  color: rgba(255,255,255,0.9);
  margin-bottom: 6px;
}
.cursor { display: inline-block; width: 2px; height: 12px; background: #0066FF; margin-left: 2px; vertical-align: middle; animation: blink 1s infinite; }
@keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
.dot-live { width: 8px; height: 8px; border-radius: 50%; background: #00C896; box-shadow: 0 0 8px #00C896; animation: blink 1.5s infinite; }
.cta-btn {
  width: 100%; margin-top: 14px;
  background: linear-gradient(90deg, #00C896, #0066FF);
  color: #fff; font-size: 13px; font-weight: 600;
  padding: 10px; border-radius: 8px; border: 0;
}

/* WhatsApp */
.wa-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  background: linear-gradient(135deg, #25D366, #128C7E);
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 700;
}
.wa-msg {
  background: #1A2942;
  border-radius: 12px 12px 12px 2px;
  padding: 8px 12px;
  font-size: 12px;
  color: #C8D0E0;
  max-width: 85%;
  margin-bottom: 2px;
  animation: msg-in 0.5s ease-out backwards;
}
@keyframes msg-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
.wa-meta { font-size: 9px; color: rgba(255,255,255,0.4); margin-bottom: 8px; }
.wa-foot { font-size: 10px; color: rgba(255,255,255,0.4); margin-top: 10px; text-align: center; font-style: italic; }

/* Analytics */
.bar-wrap { height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden; }
.bar-fill { height: 100%; background: linear-gradient(90deg, #00C896, #0066FF); border-radius: 3px; animation: grow 1s ease-out; }
@keyframes grow { from { width: 0; } }
.status-pill { font-size: 10px; padding: 2px 6px; border-radius: 10px; border: 1px solid; text-align: center; }

/* Live */
.live-avatar {
  width: 64px; height: 64px; border-radius: 50%;
  background: linear-gradient(135deg, #EF4444, #F59E0B);
  display: flex; align-items: center; justify-content: center;
  font-size: 28px;
  box-shadow: 0 0 0 4px rgba(239,68,68,0.2);
  animation: live-glow 2s ease-in-out infinite;
}
@keyframes live-glow {
  0%,100% { box-shadow: 0 0 0 4px rgba(239,68,68,0.2); }
  50% { box-shadow: 0 0 0 10px rgba(239,68,68,0.05); }
}
.live-pill {
  display: inline-flex; align-items: center; gap: 6px;
  background: rgba(239,68,68,0.15); color: #EF4444;
  border: 1px solid rgba(239,68,68,0.4);
  padding: 4px 10px; border-radius: 20px;
  font-size: 11px; font-weight: 700; letter-spacing: 0.5px;
}
.live-dot-anim { width: 6px; height: 6px; border-radius: 50%; background: #EF4444; animation: blink 1s infinite; }
.viewer-pill {
  background: rgba(255,255,255,0.06); color: #C8D0E0;
  border: 1px solid rgba(255,255,255,0.1);
  padding: 4px 10px; border-radius: 20px; font-size: 11px;
}

/* Reminders */
.step-check {
  width: 22px; height: 22px; border-radius: 50%;
  border: 1.5px solid rgba(255,255,255,0.2);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; color: rgba(255,255,255,0.4);
  flex-shrink: 0; margin-top: 2px;
}
.step-check.done { background: #00C896; border-color: #00C896; color: #fff; }

/* Mobile tabs */
.mobile-tabs {
  display: flex; gap: 8px;
  overflow-x: auto;
  padding-bottom: 8px;
  scrollbar-width: none;
}
.mobile-tabs::-webkit-scrollbar { display: none; }
.mobile-tab {
  flex-shrink: 0;
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px;
  border-radius: 20px;
  font-size: 13px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  color: #6B7A99;
  white-space: nowrap;
}

@media (max-width: 767px) {
  .features-h2 { font-size: 28px; }
  .demo-panel { min-height: 320px; padding: 16px; }
}
`;
