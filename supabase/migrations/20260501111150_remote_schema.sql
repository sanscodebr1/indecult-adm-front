-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.admin_audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  actor_user_id uuid,
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT admin_audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT admin_audit_logs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.app_users(id)
);
CREATE TABLE public.admins (
  user_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT admins_pkey PRIMARY KEY (user_id),
  CONSTRAINT admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_users(id),
  CONSTRAINT admins_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.app_users(id)
);
CREATE TABLE public.app_users (
  id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  display_name text,
  account_status USER-DEFINED NOT NULL DEFAULT 'active'::account_status,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT app_users_pkey PRIMARY KEY (id),
  CONSTRAINT app_users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.cities (
  ogc_fid integer NOT NULL DEFAULT nextval('cities_ogc_fid_seq'::regclass),
  cd_mun character varying,
  nm_mun character varying,
  cd_rgi character varying,
  nm_rgi character varying,
  cd_rgint character varying,
  nm_rgint character varying,
  cd_uf character varying,
  nm_uf character varying,
  sigla_uf character varying,
  cd_regia character varying,
  nm_regia character varying,
  sigla_rg character varying,
  cd_concu character varying,
  nm_concu character varying,
  area_km2 numeric,
  wkb_geometry USER-DEFINED,
  qtd_pessoas bigint,
  state_id bigint NOT NULL,
  CONSTRAINT cities_pkey PRIMARY KEY (ogc_fid),
  CONSTRAINT cities_state_id_fkey FOREIGN KEY (state_id) REFERENCES public.states(id)
);
CREATE TABLE public.election_candidates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  election_id uuid NOT NULL,
  talent_profile_id uuid NOT NULL,
  candidate_number integer,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  added_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  category_id uuid,
  CONSTRAINT election_candidates_pkey PRIMARY KEY (id),
  CONSTRAINT election_candidates_election_id_fkey FOREIGN KEY (election_id) REFERENCES public.elections(id),
  CONSTRAINT election_candidates_talent_profile_id_fkey FOREIGN KEY (talent_profile_id) REFERENCES public.talent_profiles(id),
  CONSTRAINT election_candidates_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.app_users(id),
  CONSTRAINT election_candidates_category_fk FOREIGN KEY (election_id) REFERENCES public.election_categories(id),
  CONSTRAINT election_candidates_category_fk FOREIGN KEY (category_id) REFERENCES public.election_categories(id),
  CONSTRAINT election_candidates_category_fk FOREIGN KEY (election_id) REFERENCES public.election_categories(election_id),
  CONSTRAINT election_candidates_category_fk FOREIGN KEY (category_id) REFERENCES public.election_categories(election_id)
);
CREATE TABLE public.election_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  election_id uuid NOT NULL,
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT election_categories_pkey PRIMARY KEY (id),
  CONSTRAINT election_categories_election_id_fkey FOREIGN KEY (election_id) REFERENCES public.elections(id),
  CONSTRAINT election_categories_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.app_users(id)
);
CREATE TABLE public.elections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  visibility USER-DEFINED NOT NULL DEFAULT 'public'::election_visibility,
  status USER-DEFINED NOT NULL DEFAULT 'draft'::election_status,
  starts_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone NOT NULL,
  published_at timestamp with time zone,
  allow_public_results boolean NOT NULL DEFAULT true,
  max_votes_per_ip_per_day integer,
  max_votes_per_fingerprint_per_day integer,
  created_by uuid NOT NULL,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT elections_pkey PRIMARY KEY (id),
  CONSTRAINT elections_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.app_users(id),
  CONSTRAINT elections_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.app_users(id)
);
CREATE TABLE public.profile_change_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  talent_profile_id uuid NOT NULL,
  requested_by uuid NOT NULL,
  request_type USER-DEFINED NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::change_request_status,
  proposed_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  proposed_media jsonb NOT NULL DEFAULT '[]'::jsonb,
  review_notes text,
  reviewed_at timestamp with time zone,
  reviewed_by uuid,
  rejection_reason text,
  applied_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT profile_change_requests_pkey PRIMARY KEY (id),
  CONSTRAINT profile_change_requests_talent_profile_id_fkey FOREIGN KEY (talent_profile_id) REFERENCES public.talent_profiles(id),
  CONSTRAINT profile_change_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.app_users(id),
  CONSTRAINT profile_change_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.app_users(id)
);
CREATE TABLE public.states (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name character varying NOT NULL UNIQUE,
  sigla character varying NOT NULL UNIQUE CHECK (char_length(sigla::text) = 2 AND sigla::text = upper(sigla::text)),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT states_pkey PRIMARY KEY (id)
);
CREATE TABLE public.talent_profile_media (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  talent_profile_id uuid NOT NULL,
  media_kind USER-DEFINED NOT NULL,
  source USER-DEFINED NOT NULL,
  storage_bucket text,
  storage_path text,
  external_url text,
  mime_type text,
  file_size_bytes bigint,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT talent_profile_media_pkey PRIMARY KEY (id),
  CONSTRAINT talent_profile_media_talent_profile_id_fkey FOREIGN KEY (talent_profile_id) REFERENCES public.talent_profiles(id)
);
CREATE TABLE public.talent_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  public_slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  full_name text NOT NULL,
  birth_date date,
  bio text,
  status USER-DEFINED NOT NULL DEFAULT 'draft'::profile_status,
  submitted_at timestamp with time zone,
  reviewed_at timestamp with time zone,
  reviewed_by uuid,
  rejection_reason text,
  approved_change_request_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  enrollment_number text NOT NULL DEFAULT generate_unique_enrollment_number() UNIQUE CHECK (enrollment_number ~ '^[0-9]{6}$'::text),
  state_id bigint NOT NULL,
  city_id integer NOT NULL,
  CONSTRAINT talent_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT talent_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_users(id),
  CONSTRAINT talent_profiles_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.app_users(id),
  CONSTRAINT talent_profiles_approved_change_request_fk FOREIGN KEY (approved_change_request_id) REFERENCES public.profile_change_requests(id),
  CONSTRAINT talent_profiles_state_id_fkey FOREIGN KEY (state_id) REFERENCES public.states(id),
  CONSTRAINT talent_profiles_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.cities(ogc_fid)
);
CREATE TABLE public.user_roles (
  user_id uuid NOT NULL,
  role USER-DEFINED NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_users(id)
);
CREATE TABLE public.vote_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  election_id uuid NOT NULL,
  election_candidate_id uuid NOT NULL,
  captcha_left smallint NOT NULL,
  captcha_operator text NOT NULL CHECK (captcha_operator = ANY (ARRAY['+'::text, '*'::text])),
  captcha_right smallint NOT NULL,
  captcha_answer integer NOT NULL,
  captcha_valid boolean NOT NULL,
  ip_hash text,
  user_agent_hash text,
  fingerprint_hash text,
  result USER-DEFINED NOT NULL,
  result_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  vote_challenge_id uuid,
  CONSTRAINT vote_attempts_pkey PRIMARY KEY (id),
  CONSTRAINT vote_attempts_election_id_fkey FOREIGN KEY (election_id) REFERENCES public.elections(id),
  CONSTRAINT vote_attempts_election_candidate_id_fkey FOREIGN KEY (election_candidate_id) REFERENCES public.election_candidates(id),
  CONSTRAINT vote_attempts_vote_challenge_id_fkey FOREIGN KEY (vote_challenge_id) REFERENCES public.vote_challenges(id)
);
CREATE TABLE public.vote_challenges (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  election_id uuid NOT NULL,
  operand_left smallint NOT NULL,
  operator text NOT NULL CHECK (operator = ANY (ARRAY['+'::text, '*'::text])),
  operand_right smallint NOT NULL,
  answer_value integer NOT NULL,
  ip_hash text,
  fingerprint_hash text,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT vote_challenges_pkey PRIMARY KEY (id),
  CONSTRAINT vote_challenges_election_id_fkey FOREIGN KEY (election_id) REFERENCES public.elections(id)
);
CREATE TABLE public.votes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  vote_attempt_id uuid NOT NULL UNIQUE,
  election_id uuid NOT NULL,
  election_candidate_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT votes_pkey PRIMARY KEY (id),
  CONSTRAINT votes_vote_attempt_id_fkey FOREIGN KEY (vote_attempt_id) REFERENCES public.vote_attempts(id),
  CONSTRAINT votes_election_id_fkey FOREIGN KEY (election_id) REFERENCES public.elections(id),
  CONSTRAINT votes_election_candidate_id_fkey FOREIGN KEY (election_candidate_id) REFERENCES public.election_candidates(id)
);