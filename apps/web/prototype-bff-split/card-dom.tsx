/** @jsxImportSource hono/jsx/dom */
export const GifCard = ({ gif }) => (
  <a class="card" href={"/gif/" + gif.uri.split("/").pop()}>
    <img src={gif.gifUrl} alt={gif.title ?? "GIF"} loading="lazy" />
    <span class="title">{gif.title ?? "(untitled)"}</span>
  </a>
);
