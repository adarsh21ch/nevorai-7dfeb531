
-- Create live_sessions table
CREATE TABLE public.live_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  slug TEXT NOT NULL UNIQUE,
  session_type TEXT NOT NULL DEFAULT 'zoom',
  meeting_url TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'draft',
  access_type TEXT NOT NULL DEFAULT 'public',
  replay_url TEXT,
  replay_enabled BOOLEAN DEFAULT false,
  replay_expires_at TIMESTAMP WITH TIME ZONE,
  thumbnail_url TEXT,
  cover_image_url TEXT,
  payment_amount INTEGER DEFAULT 0,
  upi_id TEXT,
  qr_code_url TEXT,
  payment_instructions TEXT,
  lead_form_enabled BOOLEAN DEFAULT true,
  show_name BOOLEAN DEFAULT true,
  show_phone BOOLEAN DEFAULT true,
  show_email BOOLEAN DEFAULT true,
  show_city BOOLEAN DEFAULT false,
  max_attendees INTEGER,
  registration_count INTEGER DEFAULT 0,
  attendee_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create live_registrations table
CREATE TABLE public.live_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT,
  email TEXT,
  city TEXT,
  status TEXT NOT NULL DEFAULT 'registered',
  payment_status TEXT DEFAULT 'none',
  payment_screenshot_url TEXT,
  upi_transaction_id TEXT,
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  attended BOOLEAN DEFAULT false,
  attended_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_registrations ENABLE ROW LEVEL SECURITY;

-- Live sessions policies
CREATE POLICY "Owners can manage own sessions"
ON public.live_sessions FOR ALL
USING (auth.uid() = owner_id);

CREATE POLICY "Anyone can view published sessions"
ON public.live_sessions FOR SELECT
USING (status IN ('scheduled', 'live', 'ended'));

-- Live registrations policies
CREATE POLICY "Anyone can register for published sessions"
ON public.live_registrations FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.live_sessions
  WHERE live_sessions.id = live_registrations.session_id
  AND live_sessions.status IN ('scheduled', 'live')
));

CREATE POLICY "Owners can view registrations"
ON public.live_registrations FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.live_sessions
  WHERE live_sessions.id = live_registrations.session_id
  AND live_sessions.owner_id = auth.uid()
));

CREATE POLICY "Owners can update registrations"
ON public.live_registrations FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.live_sessions
  WHERE live_sessions.id = live_registrations.session_id
  AND live_sessions.owner_id = auth.uid()
));

CREATE POLICY "Owners can delete registrations"
ON public.live_registrations FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.live_sessions
  WHERE live_sessions.id = live_registrations.session_id
  AND live_sessions.owner_id = auth.uid()
));

-- Trigger for updated_at
CREATE TRIGGER update_live_sessions_updated_at
BEFORE UPDATE ON public.live_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
