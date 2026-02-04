import type { Child } from "hono/jsx";

interface ButtonProps {
	variant?: "primary" | "secondary" | "destructive" | "ghost" | "outline";
	size?: "sm" | "md" | "lg"; // default md
	className?: string;
	isLoading?: boolean;
	children: Child;
	type?: "button" | "submit" | "reset";
	disabled?: boolean;
	onClick?: (e: MouseEvent) => void | Promise<void>;
}

export const Button = (props: ButtonProps) => {
	const {
		variant = "primary",
		size = "md",
		className = "",
		isLoading = false,
		children,
		disabled,
		type,
		onClick,
	} = props;

	const baseStyles =
		"inline-flex items-center justify-center font-sans font-medium transition-all duration-200 border-none cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed transform active:scale-[0.98]";

	const sizeStyles = {
		sm: "text-xs px-3 py-1.5 rounded-lg",
		md: "text-sm px-4 py-2 rounded-xl",
		lg: "text-lg px-6 py-3 rounded-xl",
	};

	const variantStyles = {
		primary:
			"bg-gradient-to-br from-brand-primary to-brand-primary-dark text-text-inverse shadow-md hover:shadow-lg hover:opacity-95",
		secondary: "bg-bg-search text-text hover:bg-bg-search/80",
		destructive: "bg-status-error text-white hover:opacity-90 shadow-sm",
		ghost: "bg-transparent text-text hover:bg-bg-surface-hover",
		outline:
			"bg-transparent text-text border-1 border-solid border-border hover:bg-bg-surface-hover",
	};

	const loadingSpinner = (
		<span class="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2"></span>
	);

	return (
		<button
			class={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
			disabled={disabled || isLoading}
			type={type}
			onClick={onClick}
		>
			{isLoading && loadingSpinner}
			{children}
		</button>
	);
};
