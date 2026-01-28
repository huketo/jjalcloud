import { Client, ClientResponseError } from "@atcute/client";
import type { Context } from "hono";

/**
 * 로컬 개발 환경인지 확인합니다.
 */
export function isLocalDevelopment(publicUrl: string | undefined): boolean {
	return (
		!publicUrl ||
		publicUrl.includes("localhost") ||
		publicUrl.includes("127.0.0.1")
	);
}

/**
 * URL에서 포트 번호를 추출합니다.
 */
export function extractPort(url: string): string {
	try {
		const parsed = new URL(url);
		return parsed.port || "5173";
	} catch {
		return "5173";
	}
}

/**
 * 환경 변수에서 리다이렉트 URL을 생성합니다.
 */
export function getRedirectUrl(publicUrl: string | undefined): string {
	const isLocal = isLocalDevelopment(publicUrl);
	return isLocal ? "http://127.0.0.1:5173" : publicUrl || "";
}

/**
 * OAuth 세션 타입 정의
 */
export type OAuthSession = {
	did: string;
	fetchHandler: (pathname: string, init?: RequestInit) => Promise<Response>;
};

/**
 * OAuth 세션으로부터 atcute Client를 생성하는 헬퍼 함수
 */
export function createRpcClient(session: OAuthSession): Client {
	return new Client({
		handler: (pathname, init) => session.fetchHandler(pathname, init),
	});
}

/**
 * 에러 메시지를 추출합니다.
 */
export function extractErrorMessage(error: unknown): string {
	if (error instanceof ClientResponseError) {
		return error.message;
	}
	if (error instanceof Error) {
		return error.message;
	}
	return "Unknown error";
}

/**
 * API 에러 응답을 생성합니다.
 */
export function createErrorResponse(
	c: Context,
	statusCode: number,
	errorType: string,
	error: unknown,
) {
	return c.json(
		{
			error: errorType,
			message: extractErrorMessage(error),
		},
		statusCode as any,
	);
}

/**
 * 성공 응답을 생성합니다.
 */
export function createSuccessResponse<T extends Record<string, unknown>>(
	c: Context,
	data: T,
	statusCode: 200 | 201 = 200,
) {
	return c.json(data, statusCode as any);
}
