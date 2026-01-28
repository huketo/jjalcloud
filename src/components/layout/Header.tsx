import type { FC } from "hono/jsx";

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

const UploadIcon = () => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
		<polyline points="17 8 12 3 7 8" />
		<line x1="12" y1="3" x2="12" y2="15" />
	</svg>
);

const UserIcon = () => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
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
		style={{ width: "16px", height: "16px" }}
	>
		<path d="m6 9 6 6 6-6" />
	</svg>
);

const LogoutIcon = () => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		style={{ width: "18px", height: "18px" }}
	>
		<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
		<polyline points="16 17 21 12 16 7" />
		<line x1="21" y1="12" x2="9" y2="12" />
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
		<header class="header">
			<div class="header-inner">
				{showBack ? (
					<a
						href="/"
						class="btn btn-ghost btn-icon"
						aria-label="뒤로가기"
					>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							style={{ width: "24px", height: "24px" }}
						>
							<path d="m12 19-7-7 7-7" />
							<path d="M19 12H5" />
						</svg>
					</a>
				) : (
					<a href="/" class="header-logo">
						<CloudIcon />
						<span>jjalcloud</span>
					</a>
				)}

				{title && (
					<span
						style={{
							fontSize: "var(--font-size-lg)",
							fontWeight: 600,
							color: "var(--color-primary)",
							position: "absolute",
							left: "50%",
							transform: "translateX(-50%)",
						}}
					>
						{title}
					</span>
				)}

				<div class="header-actions">
					{isLoggedIn ? (
						<>
							<a
								href="/upload"
								class="btn btn-primary"
								style={{
									borderRadius: "9999px",
								}}
							>
								<span>Upload</span>
							</a>

							<div class="profile-dropdown">
								<button
									type="button"
									class="profile-dropdown-trigger"
									aria-label="프로필 메뉴"
									aria-haspopup="true"
								>
									{avatarUrl ? (
										<img
											src={avatarUrl}
											alt="Profile"
											class="profile-avatar"
										/>
									) : (
										<div class="profile-avatar">
											<UserIcon />
										</div>
									)}
									<ChevronDownIcon />
								</button>

								<div class="profile-dropdown-menu">
									<a
										href="/profile"
										class="profile-dropdown-item"
									>
										<UserIcon />
										<span>Profile</span>
									</a>
									<div class="profile-dropdown-divider" />
									<form action="/oauth/logout" method="post" style={{ margin: 0 }}>
										<button
											type="submit"
											class="profile-dropdown-item profile-dropdown-item-danger"
											style={{
												width: "100%",
												border: "none",
												background: "none",
												cursor: "pointer",
												fontSize: "inherit",
												fontFamily: "inherit",
											}}
										>
											<LogoutIcon />
											<span>Logout</span>
										</button>
									</form>
								</div>
							</div>
						</>
					) : (
						<a href="/login" class="btn btn-primary btn-sm">
							Login
						</a>
					)}
				</div>
			</div>
		</header>
	);
};
