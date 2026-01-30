/**
 * GENERATED CODE - DO NOT MODIFY
 */
import type { BlobRef, ValidationResult } from "@atproto/lexicon";
import { CID } from "multiformats/cid";
import { validate as _validate } from "../../../../lexicons";
import {
	is$typed as _is$typed,
	type $Typed,
	type OmitKey,
} from "../../../../util";
import type * as ComAtprotoLabelDefs from "../../../com/atproto/label/defs.js";
import type * as ComAtprotoRepoStrongRef from "../../../com/atproto/repo/strongRef.js";

const is$typed = _is$typed,
	validate = _validate;
const id = "app.bsky.actor.profile";

export interface Main {
	$type: "app.bsky.actor.profile";
	/** Small image to be displayed next to posts from account. AKA, 'profile picture' */
	avatar?: BlobRef;
	/** Larger horizontal image to display behind profile view. */
	banner?: BlobRef;
	createdAt?: string;
	/** Free-form profile description text. */
	description?: string;
	displayName?: string;
	joinedViaStarterPack?: ComAtprotoRepoStrongRef.Main;
	labels?: $Typed<ComAtprotoLabelDefs.SelfLabels> | { $type: string };
	pinnedPost?: ComAtprotoRepoStrongRef.Main;
	/** Free-form pronouns text. */
	pronouns?: string;
	website?: string;
	[k: string]: unknown;
}

const hashMain = "main";

export function isMain<V>(v: V) {
	return is$typed(v, id, hashMain);
}

export function validateMain<V>(v: V) {
	return validate<Main & V>(v, id, hashMain, true);
}

export {
	type Main as Record,
	isMain as isRecord,
	validateMain as validateRecord,
};
