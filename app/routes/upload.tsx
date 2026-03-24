import { createRoute } from "honox/factory";

export default createRoute((c) => {
	return c.render(<h1>Upload</h1>, { title: "Upload" });
});
