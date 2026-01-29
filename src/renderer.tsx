import { jsxRenderer } from "hono/jsx-renderer";
import { Link, ViteClient } from "vite-ssr-components/hono";

export const renderer = jsxRenderer(({ children }) => {
	return (
		<html lang="ko">
			<head>
				<meta charset="UTF-8" />
				<meta
					name="viewport"
					content="width=device-width, initial-scale=1.0"
				/>
				<meta
					name="description"
					content="AT Protocol 기반 탈중앙화 GIF 공유 플랫폼"
				/>
				<title>jjalcloud</title>
				<ViteClient />
				<Link href="/src/uno.css" rel="stylesheet" />
			</head>
			<body>
				{children}
				<script
					dangerouslySetInnerHTML={{
						__html: `
						window.showToast = function(message) {
							const alert = document.createElement('div');
							alert.textContent = message;
							alert.style.position = 'fixed';
							alert.style.bottom = '20px';
							alert.style.left = '50%';
							alert.style.transform = 'translateX(-50%)';
							alert.style.background = 'rgba(0,0,0,0.8)';
							alert.style.color = 'white';
							alert.style.padding = '8px 16px';
							alert.style.borderRadius = '20px';
							alert.style.zIndex = '9999';
							alert.style.fontSize = '14px';
							alert.style.pointerEvents = 'none';
							alert.style.opacity = '0';
							alert.style.transition = 'opacity 0.2s ease-in-out';
							
							document.body.appendChild(alert);
							
							// Fade in
							requestAnimationFrame(() => {
								alert.style.opacity = '1';
							});

							setTimeout(() => {
								alert.style.opacity = '0';
								setTimeout(() => alert.remove(), 200);
							}, 2000);
						};

						window.copyToClipboard = function(text, message) {
							if (!navigator.clipboard) return;
							navigator.clipboard.writeText(text).then(() => {
								if (message) window.showToast(message);
							}).catch(err => {
								console.error('Failed to copy:', err);
							});
						};
					`,
					}}
				/>
			</body>
		</html>
	);
});
