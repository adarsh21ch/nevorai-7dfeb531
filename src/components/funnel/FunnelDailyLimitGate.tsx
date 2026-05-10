import { CalendarClock } from "lucide-react";

export const FunnelDailyLimitGate = () => {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md mx-auto rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-8 text-center space-y-5">
        <div className="w-12 h-12 mx-auto rounded-full bg-muted/40 flex items-center justify-center">
          <CalendarClock className="text-muted-foreground" size={24} strokeWidth={1.5} />
        </div>
        <h1 className="text-[20px] font-heading font-medium text-foreground leading-snug">Today's viewing slots are fully booked.</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">This content is currently at full capacity for today.<br />New slots open tomorrow.</p>
        <div className="h-px bg-border/60 mx-auto w-2/3" />
        <p className="text-[13px] text-muted-foreground leading-relaxed">In the meantime, feel free to reach out to the person who shared this with you.</p>
      </div>
    </div>
  );
};
