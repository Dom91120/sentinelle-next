-- Recherche globale insensible aux accents : l'extension unaccent, et une fonction
-- immuable qui l'enveloppe (unaccent() seule est STABLE, donc inutilisable dans un
-- index ; celle-ci peut l'être si le besoin vient). Le dictionnaire est figé.
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION sans_accent(text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$ SELECT lower(public.unaccent('public.unaccent', $1)) $$;
