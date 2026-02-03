import type { FC } from "hono/jsx";
import type { JSX } from "hono/jsx/jsx-runtime";

type SVGProps = JSX.IntrinsicElements["svg"];

// SVG Icons
const CloudIcon = () => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
	</svg>
);

const UploadIcon = (props: SVGProps) => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		{...props}
	>
		<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
		<polyline points="17 8 12 3 7 8" />
		<line x1="12" y1="3" x2="12" y2="15" />
	</svg>
);

const UserIcon = (props: SVGProps) => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		{...props}
	>
		<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
		<circle cx="12" cy="7" r="4" />
	</svg>
);

const ChevronDownIcon = () => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		class="w-4 h-4"
	>
		<path d="m6 9 6 6 6-6" />
	</svg>
);

const LogoutIcon = (props: SVGProps) => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		{...props}
	>
		<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
		<polyline points="16 17 21 12 16 7" />
		<line x1="21" y1="12" x2="9" y2="12" />
	</svg>
);

const MenuIcon = (props: SVGProps) => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		{...props}
	>
		<line x1="4" y1="12" x2="20" y2="12" />
		<line x1="4" y1="6" x2="20" y2="6" />
		<line x1="4" y1="18" x2="20" y2="18" />
	</svg>
);

interface HeaderProps {
	isLoggedIn?: boolean;
	showSearch?: boolean;
	showBack?: boolean;
	title?: string;
	avatarUrl?: string;
}

export const Header: FC<HeaderProps> = ({
	isLoggedIn = false,
	showBack = false,
	title,
	avatarUrl,
}) => {
	return (
		<header class="fixed top-0 left-0 right-0 h-[60px] bg-bg-glass backdrop-blur-xl border-b border-border-light z-100">
			<div class="flex items-center justify-between h-full max-w-[1200px] mx-auto px-4 relative box-border">
				{showBack ? (
					<a
						href="/"
						class="inline-flex items-center justify-center gap-2 px-4 py-2 text-base font-medium transition-all bg-transparent text-text-secondary hover:bg-brand-primary-pale hover:text-brand-primary p-2 rounded-full"
						aria-label="Go Back"
					>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="w-6 h-6"
						>
							<path d="m12 19-7-7 7-7" />
							<path d="M19 12H5" />
						</svg>
					</a>
				) : (
					<a
						href="/"
						class="flex items-center gap-2 text-xl font-bold text-brand-primary no-underline z-20"
					>
						<div class="w-8 h-8 text-brand-primary">
							<CloudIcon />
						</div>
						<span>jjalcloud</span>
					</a>
				)}

				{title && (
					<span class="text-lg font-semibold text-brand-primary absolute left-1/2 -translate-x-1/2 whitespace-nowrap overflow-hidden text-ellipsis max-w-[50%]">
						{title}
					</span>
				)}

				{/* Desktop Navigation */}
				<div class="hidden md:flex items-center gap-2">
					{isLoggedIn ? (
						<>
							<a
								href="/upload"
								class="inline-flex items-center justify-center gap-2 px-6 h-10 text-base font-medium transition-all bg-gradient-to-br from-brand-primary to-brand-primary-dark text-text-inverse shadow-sm hover:shadow-md hover:opacity-90 rounded-full no-underline leading-none"
							>
								<span>Upload</span>
							</a>

							<div class="relative flex items-center group">
								<button
									type="button"
									class="inline-flex items-center gap-[2px] p-0 pr-1 border-none bg-transparent rounded-full cursor-pointer transition-colors duration-150 h-10 hover:opacity-70"
									aria-label="Profile Menu"
									aria-haspopup="true"
								>
									{avatarUrl ? (
										<img
											src={avatarUrl}
											alt="Profile"
											class="w-10 h-10 min-w-10 min-h-10 max-w-10 max-h-10 rounded-full bg-transparent border-2 border-brand-primary-light flex items-center justify-center text-brand-primary overflow-hidden object-cover"
										/>
									) : (
										<div class="w-10 h-10 min-w-10 min-h-10 max-w-10 max-h-10 rounded-full bg-transparent border-2 border-brand-primary-light flex items-center justify-center text-brand-primary overflow-hidden object-cover">
											<UserIcon class="w-6 h-6" />
										</div>
									)}
									<div class="text-text-secondary">
										<ChevronDownIcon />
									</div>
								</button>

								<div class="absolute top-full right-0 mt-2 min-w-[160px] bg-bg-surface/80 backdrop-blur-md border border-border rounded-md shadow-lg p-1 opacity-0 invisible -translate-y-2 transition-all duration-150 z-200 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0">
									<a
										href="/profile"
										class="flex items-center gap-2 px-4 py-2 rounded-sm text-text no-underline text-sm transition-colors hover:bg-bg-surface-hover w-full box-border"
									>
										<div class="w-5 h-5 text-text-secondary flex items-center justify-center">
											<UserIcon class="w-full h-full" />
										</div>
										<span class="mt-1">Profile</span>
									</a>
									<div class="h-px bg-border-light my-1" />
									<form action="/oauth/logout" method="post" class="m-0 w-full">
										<button
											type="submit"
											class="flex items-center gap-2 px-4 py-2 rounded-sm text-sm transition-colors hover:bg-bg-surface-hover w-full border-none bg-transparent cursor-pointer text-status-error"
										>
											<div class="w-5 h-5 text-status-error flex items-center justify-center">
												<LogoutIcon class="w-full h-full" />
											</div>
											<span>Logout</span>
										</button>
									</form>
								</div>
							</div>
						</>
					) : (
						<a
							href="/login"
							class="inline-flex items-center justify-center gap-2 px-4 py-2 font-medium rounded-md transition-all bg-gradient-to-br from-brand-primary to-brand-primary-dark text-text-inverse shadow-sm hover:shadow-md hover:opacity-90 text-sm rounded-sm no-underline"
						>
							Login
						</a>
					)}
				</div>

				{/* Mobile Menu Button */}
				<div class="md:hidden flex items-center z-20">
					<button
						type="button"
						class="p-2 -mr-2 text-text-secondary hover:text-brand-primary transition-colors bg-transparent border-none cursor-pointer"
						data-toggle-menu="mobile-menu"
						aria-label="Open Menu"
					>
						<MenuIcon class="w-6 h-6" />
					</button>
				</div>
			</div>

			{/* Mobile Menu Dropdown */}
			<div
				id="mobile-menu"
				class="hidden md:hidden absolute top-[60px] left-0 right-0 bg-bg-surface border-b border-border shadow-lg animate-fade-in origin-top"
				style="animation-duration: 0.2s"
			>
				<div class="flex flex-col p-4 gap-4">
					{isLoggedIn ? (
						<>
							<div class="flex items-center gap-3 px-2 pb-4 border-b border-border-light">
								{avatarUrl ? (
									<img
										src={avatarUrl}
										alt="Profile"
										class="w-10 h-10 rounded-full border border-brand-primary-light object-cover"
									/>
								) : (
									<div class="w-10 h-10 rounded-full bg-brand-primary-pale flex items-center justify-center text-brand-primary">
										<UserIcon class="w-6 h-6" />
									</div>
								)}
								<div class="flex flex-col">
									<span class="text-sm font-medium text-text">Signed in</span>
									<a
										href="/profile"
										class="text-xs text-brand-primary no-underline hover:underline"
									>
										View Profile
									</a>
								</div>
							</div>

							<a
								href="/upload"
								class="flex items-center justify-center gap-2 w-full px-4 py-3 font-medium rounded-lg bg-brand-primary text-text-inverse no-underline shadow-sm active:scale-[0.98] transition-transform box-border"
							>
								<UploadIcon class="w-5 h-5" />
								<span>Upload GIF</span>
							</a>

							<div class="h-px bg-border-light" />

							<form action="/oauth/logout" method="post" class="m-0 w-full">
								<button
									type="submit"
									class="flex items-center justify-center gap-2 w-full px-4 py-3 font-medium rounded-lg bg-bg-surface border-1 border-solid border-status-error text-status-error cursor-pointer active:bg-status-error/5 transition-colors box-border"
								>
									<LogoutIcon class="w-5 h-5" />
									<span>Logout</span>
								</button>
							</form>
						</>
					) : (
						<div class="flex flex-col gap-3">
							<p class="text-center text-text-secondary text-sm my-2">
								Sign in to upload and manage your GIFs
							</p>
							<a
								href="/login"
								class="flex items-center justify-center gap-2 w-full px-4 py-3 font-medium rounded-lg bg-brand-primary text-text-inverse no-underline shadow-sm active:scale-[0.98] transition-transform"
							>
								Login
							</a>
						</div>
					)}
				</div>
			</div>
		</header>
	);
};
