import {
	CompositeDidDocumentResolver,
	DohJsonHandleResolver,
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
		grant_types: ["authorization_code", "refresh_token"],
		response_types: ["code"],
		token_endpoint_auth_method: "private_key_jwt",
		scope: "atproto transition:generic",
		dpop_bound_access_tokens: true,
		application_type: "web",
		subject_type: "public",
	},
	keyset: [JSON.parse(env.OAUTH_PRIVATE_KEY)],
	actorResolver,
	stores: {
		sessions: new PostgresSessionStore(db),
		states: new PostgresStateStore(db),
	},
});
