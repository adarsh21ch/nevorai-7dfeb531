// Static tutorial library for the Help Center.
// To add a new tutorial: append an entry below. No DB or deploy step required.
// Use a YouTube/Vimeo *embed* URL (https://www.youtube.com/embed/ID) so the
// modal player works inside an iframe.

export type Tutorial = {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl?: string;
  category: TutorialCategory;
};

export type TutorialCategory =
  | "getting-started"
  | "videos"
  | "funnels"
  | "landing-pages"
  | "sharing"
  | "billing";

export const tutorialCategoryLabels: Record<TutorialCategory, string> = {
  "getting-started": "Getting started",
  videos: "Videos",
  funnels: "Funnels",
  "landing-pages": "Landing pages",
  sharing: "Share & WhatsApp",
  billing: "Billing & plans",
};

export const tutorials: Tutorial[] = [
  {
    id: "welcome",
    title: "Welcome to nFlow by Nevorai",
    description:
      "A 60-second tour of what Flow does and how to get your first lead in under 5 minutes.",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    category: "getting-started",
  },
  {
    id: "first-video",
    title: "Upload your first video",
    description:
      "How to upload a video, get a public link, and share it on WhatsApp.",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    category: "videos",
  },
  {
    id: "first-funnel",
    title: "Build your first funnel",
    description:
      "Turn a video into a lead-capturing funnel in under 3 minutes.",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    category: "funnels",
  },
  {
    id: "landing-page",
    title: "Create a landing page",
    description:
      "Use a landing page when you want a registration form before the video.",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    category: "landing-pages",
  },
  {
    id: "whatsapp-share",
    title: "Share on WhatsApp the smart way",
    description:
      "Best practices for sending your Flow link to prospects so more of them watch.",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    category: "sharing",
  },
  {
    id: "plans",
    title: "Choose the right plan",
    description: "How views, leads, and team seats work across our plans.",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    category: "billing",
  },
];
