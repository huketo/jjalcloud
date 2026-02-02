import type { JSX } from "hono/jsx";

interface LabelProps extends JSX.LabelHTMLAttributes {
	className?: string;
	children: JSX.Element | string;
}

export const Label = (props: LabelProps) => {
	const { className = "", children, ...rest } = props;
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: generic label component
		<label
			class={`block text-sm font-medium text-brand-primary mb-2 ${className}`}
			{...rest}
		>
			{children}
		</label>
	);
};
