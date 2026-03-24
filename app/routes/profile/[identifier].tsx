import { createRoute } from "honox/factory";

export default createRoute((c) => {
	const identifier = c.req.param("identifier") ?? "";
	const isDid = identifier.startsWith("did:");
	return c.render(
		<div>
			<h1>Profile</h1>
			<p>
				{isDid ? "DID" : "Handle"}: {identifier}
			</p>
		</div>,
		{ title: "Profile" },
	);
});
