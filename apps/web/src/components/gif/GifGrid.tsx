import type { Child, FC } from "hono/jsx";

interface GifGridProps {
	children: Child;
}

export const GifGrid: FC<GifGridProps> = ({ children }) => {
	return (
		<div class="columns-2 gap-2 md:gap-4 sm:columns-3 lg:columns-4">
			{children}
		</div>
	);
};

interface GifGridItemProps {
	children: Child;
	passedProps?: Record<string, any>;
}

export const GifGridItem: FC<GifGridItemProps> = ({ children, passedProps }) => {
	return <div class="break-inside-avoid mb-4" {...(passedProps || {})}>{children}</div>;
};
