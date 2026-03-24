-- Enable trigram extension for Korean/multilingual search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigger to auto-update search_vector on gifs insert/update
CREATE OR REPLACE FUNCTION gifs_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.alt, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gifs_search_vector_trigger
  BEFORE INSERT OR UPDATE ON gifs
  FOR EACH ROW EXECUTE FUNCTION gifs_search_vector_update();

CREATE INDEX gifs_search_vector_idx ON gifs USING GIN (search_vector);

-- Update gifs search_vector when tags change
CREATE OR REPLACE FUNCTION tags_update_search_vector() RETURNS trigger AS $$
BEGIN
  UPDATE gifs SET search_vector =
    setweight(to_tsvector('simple', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(alt, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(
      (SELECT string_agg(t.name, ' ') FROM tags t WHERE t.gif_uri = gifs.uri), ''
    )), 'C')
  WHERE uri = COALESCE(NEW.gif_uri, OLD.gif_uri);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tags_search_vector_trigger
  AFTER INSERT OR UPDATE OR DELETE ON tags
  FOR EACH ROW EXECUTE FUNCTION tags_update_search_vector();

-- Trigram index on tags for fuzzy/prefix search
CREATE INDEX tags_name_trgm_idx ON tags USING GIN (name gin_trgm_ops);

-- Trending materialized view
CREATE MATERIALIZED VIEW trending_gifs AS
SELECT
  g.uri,
  COUNT(DISTINCT s.id) * 2 + COUNT(DISTINCT l.id) AS score
FROM gifs g
LEFT JOIN share_events s ON s.gif_uri = g.uri
  AND s.created_at > NOW() - INTERVAL '24 hours'
LEFT JOIN likes l ON l.subject = g.uri
  AND l.created_at > NOW() - INTERVAL '7 days'
GROUP BY g.uri
ORDER BY score DESC;

CREATE UNIQUE INDEX trending_gifs_uri_idx ON trending_gifs (uri);
