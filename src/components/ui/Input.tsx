import type { JSX } from "hono/jsx";

interface InputProps extends JSX.InputHTMLAttributes {
	className?: string;
}

export const Input = (props: InputProps) => {
	const { className = "", ...rest } = props;
	return (
		<input
			class={`w-full box-border px-4 py-3 text-base text-text font-sans bg-bg-surface border-1 border-solid border-border-light rounded-xl transition-all outline-none focus:border-brand-primary placeholder:text-text-muted/80 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
			{...rest}
		/>
	);
};
