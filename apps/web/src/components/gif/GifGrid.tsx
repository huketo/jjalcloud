import type { Child, FC } from "hono/jsx";

interface GifGridProps {
	children: Child;
}

export const GifGrid: FC<GifGridProps> = ({ children }) => {
	return (
		<div
			id="gif-grid"
			class="columns-2 gap-2 md:gap-4 sm:columns-3 lg:columns-4"
			data-masonry="true"
		>
			{children}
		</div>
	);
};

interface GifGridItemProps {
	children: Child;
	passedProps?: Record<string, unknown>;
}

export const GifGridItem: FC<GifGridItemProps> = ({
	children,
	passedProps,
}) => {
	return (
		<div class="break-inside-avoid mb-4" {...(passedProps || {})}>
			{children}
		</div>
	);
};
