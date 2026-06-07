ALTER TABLE public.testimonials
  ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
