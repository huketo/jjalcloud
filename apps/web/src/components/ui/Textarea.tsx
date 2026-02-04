interface TextareaProps {
	className?: string;
	id?: string;
	name?: string;
	value?: string;
	placeholder?: string;
	maxLength?: number;
	onInput?: (e: Event) => void;
	disabled?: boolean;
	required?: boolean;
	rows?: number;
}

export const Textarea = (props: TextareaProps) => {
	const { className = "", ...rest } = props;
	return (
		<textarea
			class={`w-full box-border px-4 py-3 text-base text-text font-sans bg-bg-surface border-1 border-solid border-border-light rounded-xl transition-all outline-none focus:border-brand-primary placeholder:text-text-muted/80 min-h-[100px] resize-y disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
			{...rest}
		/>
	);
};
