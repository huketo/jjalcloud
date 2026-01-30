/**
 * GENERATED CODE - DO NOT MODIFY
 */
import {
	type Auth,
	createServer as createXrpcServer,
	type MethodConfigOrHandler,
	type StreamConfigOrHandler,
	type Options as XrpcOptions,
	type Server as XrpcServer,
} from "@atproto/xrpc-server";
import { schemas } from "./lexicons.js";
import type * as ComJjalcloudFeedGetSearch from "./types/com/jjalcloud/feed/getSearch.js";

export function createServer(options?: XrpcOptions): Server {
	return new Server(options);
}

export class Server {
	xrpc: XrpcServer;
	app: AppNS;
	com: ComNS;

	constructor(options?: XrpcOptions) {
		this.xrpc = createXrpcServer(schemas, options);
		this.app = new AppNS(this);
		this.com = new ComNS(this);
	}
}

export class AppNS {
	_server: Server;
	bsky: AppBskyNS;

	constructor(server: Server) {
		this._server = server;
		this.bsky = new AppBskyNS(server);
	}
}

export class AppBskyNS {
	_server: Server;
	actor: AppBskyActorNS;

	constructor(server: Server) {
		this._server = server;
		this.actor = new AppBskyActorNS(server);
	}
}

export class AppBskyActorNS {
	_server: Server;

	constructor(server: Server) {
		this._server = server;
	}
}

export class ComNS {
	_server: Server;
	atproto: ComAtprotoNS;
	jjalcloud: ComJjalcloudNS;

	constructor(server: Server) {
		this._server = server;
		this.atproto = new ComAtprotoNS(server);
		this.jjalcloud = new ComJjalcloudNS(server);
	}
}

export class ComAtprotoNS {
	_server: Server;
	repo: ComAtprotoRepoNS;

	constructor(server: Server) {
		this._server = server;
		this.repo = new ComAtprotoRepoNS(server);
	}
}

export class ComAtprotoRepoNS {
	_server: Server;

	constructor(server: Server) {
		this._server = server;
	}
}

export class ComJjalcloudNS {
	_server: Server;
	feed: ComJjalcloudFeedNS;
	graph: ComJjalcloudGraphNS;

	constructor(server: Server) {
		this._server = server;
		this.feed = new ComJjalcloudFeedNS(server);
		this.graph = new ComJjalcloudGraphNS(server);
	}
}

export class ComJjalcloudFeedNS {
	_server: Server;

	constructor(server: Server) {
		this._server = server;
	}

	getSearch<A extends Auth = void>(
		cfg: MethodConfigOrHandler<
			A,
			ComJjalcloudFeedGetSearch.QueryParams,
			ComJjalcloudFeedGetSearch.HandlerInput,
			ComJjalcloudFeedGetSearch.HandlerOutput
		>,
	) {
		const nsid = "com.jjalcloud.feed.getSearch"; // @ts-ignore
		return this._server.xrpc.method(nsid, cfg);
	}
}

export class ComJjalcloudGraphNS {
	_server: Server;

	constructor(server: Server) {
		this._server = server;
	}
}
