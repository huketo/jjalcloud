import { createRoute } from "honox/factory";

export default createRoute((c) => {
	const cid = c.req.param("cid");
	return c.render(
		<div>
			<h1>GIF Detail</h1>
			<p>CID: {cid}</p>
		</div>,
		{ title: "GIF" },
	);
});
