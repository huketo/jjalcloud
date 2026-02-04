import type { Child } from "hono/jsx";

interface LabelProps {
	className?: string;
	children: Child;
	for?: string;
	htmlFor?: string;
}

export const Label = (props: LabelProps) => {
	const {
		className = "",
		children,
		for: htmlForAttr,
		htmlFor,
		...rest
	} = props;
	return (
		<label
			class={`block text-sm font-medium text-brand-primary mb-2 ${className}`}
			for={htmlForAttr || htmlFor}
			{...rest}
		>
			{children}
		</label>
	);
};
