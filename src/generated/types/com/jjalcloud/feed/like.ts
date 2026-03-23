import type {} from "@atcute/lexicons";
import type {} from "@atcute/lexicons/ambient";
import * as v from "@atcute/lexicons/validations";
import * as ComAtprotoRepoStrongRef from "../../atproto/repo/strongRef.js";

const _mainSchema = /*#__PURE__*/ v.record(
	/*#__PURE__*/ v.tidString(),
	/*#__PURE__*/ v.object({
		$type: /*#__PURE__*/ v.literal("com.jjalcloud.feed.like"),
		createdAt: /*#__PURE__*/ v.datetimeString(),
		get subject() {
			return ComAtprotoRepoStrongRef.mainSchema;
		},
	}),
);

type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}

export const mainSchema = _mainSchema as mainSchema;

export interface Main extends v.InferInput<typeof mainSchema> {}

declare module "@atcute/lexicons/ambient" {
	interface Records {
		"com.jjalcloud.feed.like": mainSchema;
	}
}
