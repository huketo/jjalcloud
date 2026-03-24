import type { ErrorHandler } from "hono";
import type { HTTPException } from "hono/http-exception";

const handler: ErrorHandler = (e, c) => {
	const status = "status" in e ? (e as HTTPException).status : 500;
	if (status === 404) {
		return c.render(<h1>404 - Not Found</h1>, { title: "Not Found" });
	}
	return c.render(
		<div>
			<h1>Error</h1>
			<p>{import.meta.env.DEV ? e.message : "Something went wrong"}</p>
		</div>,
		{ title: "Error" },
	);
};

export default handler;
