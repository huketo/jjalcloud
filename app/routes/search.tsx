import { createRoute } from "honox/factory";

export default createRoute((c) => {
	const q = c.req.query("q") ?? "";
	return c.render(
		<div>
			<h1>Search</h1>
			<p>Query: {q}</p>
		</div>,
		{ title: "Search" },
	);
});
