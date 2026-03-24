import {
	CompositeDidDocumentResolver,
	LocalActorResolver,
	PlcDidDocumentResolver,
	WebDidDocumentResolver,
} from "@atcute/identity-resolver";
import { NodeDnsHandleResolver } from "@atcute/identity-resolver-node";
import { OAuthClient } from "@atcute/oauth-node-client";
import { db } from "../db/client";
import { env } from "../env";
import { PostgresSessionStore } from "./session-store";
import { PostgresStateStore } from "./state-store";

const didDocumentResolver = new CompositeDidDocumentResolver({
	methods: {
		plc: new PlcDidDocumentResolver(),
		web: new WebDidDocumentResolver(),
	},
});

const handleResolver = new NodeDnsHandleResolver();

const actorResolver = new LocalActorResolver({
	handleResolver,
	didDocumentResolver,
});

export const oauthClient = new OAuthClient({
	metadata: {
		client_id: env.OAUTH_CLIENT_ID,
		client_name: "jjalcloud",
		redirect_uris: [env.OAUTH_REDIRECT_URI],
		scope: "atproto transition:generic",
	},
	keyset: [JSON.parse(env.OAUTH_PRIVATE_KEY)],
	actorResolver,
	stores: {
		sessions: new PostgresSessionStore(db),
		states: new PostgresStateStore(db),
	},
});
