/** @jsxImportSource hono/jsx */
import { Window } from "happy-dom";
const gifs = [{ uri: "at://did:plc:aaa/com.jjalcloud.feed.gif/3l1", title: "cat", gifUrl: "/img/a/b" }];
const which = process.argv[2];

const w = new Window();
globalThis.document = w.document; globalThis.window = w; globalThis.Node = w.Node;

const { GifCard } = await import("./card-" + which + ".tsx");

// server-style render
try {
  const s = String(GifCard({ gif: gifs[0] }));
  console.log("  toString():", s.slice(0, 90).replace(/\n/g, " "));
} catch (e) { console.log("  toString() THREW:", e.message.slice(0, 100)); }

// client-style render
try {
  const { render } = await import("hono/jsx/dom");
  const root = w.document.createElement("div");
  render(GifCard({ gif: gifs[0] }), root);
  await new Promise(r => setTimeout(r, 20));
  console.log("  dom render():", root.innerHTML ? root.innerHTML.slice(0, 90) : "(EMPTY)");
} catch (e) { console.log("  dom render() THREW:", e.message.slice(0, 100)); }
