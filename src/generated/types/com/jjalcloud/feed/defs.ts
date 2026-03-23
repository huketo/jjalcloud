import * as AppBskyActorDefs from "@atcute/bluesky/types/app/actor/defs";
import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";

const _gifViewSchema = /*#__PURE__*/ v.object({
	$type: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("com.jjalcloud.feed.defs#gifView")),
	get author() {
		return AppBskyActorDefs.profileViewBasicSchema;
	},
	cid: /*#__PURE__*/ v.cidString(),
	indexedAt: /*#__PURE__*/ v.datetimeString(),
	likeCount: /*#__PURE__*/ v.integer(),
	uri: /*#__PURE__*/ v.resourceUriString(),
	value: /*#__PURE__*/ v.unknown(),
});

type gifView$schematype = typeof _gifViewSchema;

export interface gifViewSchema extends gifView$schematype {}

export const gifViewSchema = _gifViewSchema as gifViewSchema;

export interface GifView extends v.InferInput<typeof gifViewSchema> {}
