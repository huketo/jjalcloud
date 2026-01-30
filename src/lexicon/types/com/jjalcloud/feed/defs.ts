/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { BlobRef, type ValidationResult } from "@atproto/lexicon";
import { CID } from "multiformats/cid";
import { validate as _validate } from "../../../../lexicons";
import {
	is$typed as _is$typed,
	type $Typed,
	type OmitKey,
} from "../../../../util";
import type * as AppBskyActorDefs from "../../../app/bsky/actor/defs.js";

const is$typed = _is$typed,
	validate = _validate;
const id = "com.jjalcloud.feed.defs";

export interface GifView {
	$type?: "com.jjalcloud.feed.defs#gifView";
	uri: string;
	cid: string;
	author: AppBskyActorDefs.ProfileViewBasic;
	value: { [_ in string]: unknown };
	likeCount: number;
	indexedAt: string;
}

const hashGifView = "gifView";

export function isGifView<V>(v: V) {
	return is$typed(v, id, hashGifView);
}

export function validateGifView<V>(v: V) {
	return validate<GifView & V>(v, id, hashGifView);
}
