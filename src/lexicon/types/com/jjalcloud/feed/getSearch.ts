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
import type * as ComJjalcloudFeedDefs from "./defs.js";

const is$typed = _is$typed,
	validate = _validate;
const id = "com.jjalcloud.feed.getSearch";

export type QueryParams = {
	q?: string;
	limit: number;
	cursor?: string;
};
export type InputSchema = undefined;

export interface OutputSchema {
	cursor?: string;
	gifs: ComJjalcloudFeedDefs.GifView[];
}

export type HandlerInput = void;

export interface HandlerSuccess {
	encoding: "application/json";
	body: OutputSchema;
	headers?: { [key: string]: string };
}

export interface HandlerError {
	status: number;
	message?: string;
}

export type HandlerOutput = HandlerError | HandlerSuccess;
