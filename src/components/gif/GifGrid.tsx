import type { FC, Child } from "hono/jsx";

interface GifGridProps {
	children: Child;
}

export const GifGrid: FC<GifGridProps> = ({ children }) => {
	return <div class="gif-grid">{children}</div>;
};

interface GifGridItemProps {
	children: Child;
}

export const GifGridItem: FC<GifGridItemProps> = ({ children }) => {
	return <div class="gif-grid-item">{children}</div>;
};
