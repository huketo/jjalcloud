import {
	CompositeDidDocumentResolver,
	LocalActorResolver,
	PlcDidDocumentResolver,
	WebDidDocumentResolver,
} from "@atcute/identity-resolver";
import { NodeDnsHandleResolver } from "@atcute/identity-resolver-node";

const didDocumentResolver = new CompositeDidDocumentResolver({
	methods: {
		plc: new PlcDidDocumentResolver(),
		web: new WebDidDocumentResolver(),
	},
});

const handleResolver = new NodeDnsHandleResolver();

export const actorResolver = new LocalActorResolver({
	handleResolver,
	didDocumentResolver,
});

export async function getPdsEndpoint(did: string): Promise<string> {
	const actor = await actorResolver.resolve(did as any);
	return actor.pds;
}
