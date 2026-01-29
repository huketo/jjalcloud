import type { FC, Child } from "hono/jsx";

interface GifGridProps {
	children: Child;
}

export const GifGrid: FC<GifGridProps> = ({ children }) => {
	return <div class="columns-2 gap-4 sm:columns-3 lg:columns-4">{children}</div>;
};

interface GifGridItemProps {
	children: Child;
}

export const GifGridItem: FC<GifGridItemProps> = ({ children }) => {
	return <div class="break-inside-avoid mb-4">{children}</div>;
};
