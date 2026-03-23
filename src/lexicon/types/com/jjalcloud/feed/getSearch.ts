import type {} from "@atcute/lexicons";
import type {} from "@atcute/lexicons/ambient";
import * as v from "@atcute/lexicons/validations";
import * as ComJjalcloudFeedDefs from "./defs.js";

const _mainSchema = /*#__PURE__*/ v.query("com.jjalcloud.feed.getSearch", {
	params: /*#__PURE__*/ v.object({
		/**
		 * @maxLength 10000
		 */
		cursor: /*#__PURE__*/ v.optional(
			/*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [/*#__PURE__*/ v.stringLength(0, 10000)]),
		),
		/**
		 * @minimum 1
		 * @maximum 100
		 * @default 50
		 */
		limit: /*#__PURE__*/ v.optional(
			/*#__PURE__*/ v.constrain(/*#__PURE__*/ v.integer(), [/*#__PURE__*/ v.integerRange(1, 100)]),
			50,
		),
		/**
		 * @maxLength 1000
		 */
		q: /*#__PURE__*/ v.optional(
			/*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [/*#__PURE__*/ v.stringLength(0, 1000)]),
		),
	}),
	output: {
		type: "lex",
		schema: /*#__PURE__*/ v.object({
			/**
			 * @maxLength 10000
			 */
			cursor: /*#__PURE__*/ v.optional(
				/*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
					/*#__PURE__*/ v.stringLength(0, 10000),
				]),
			),
			get gifs() {
				return /*#__PURE__*/ v.array(ComJjalcloudFeedDefs.gifViewSchema);
			},
		}),
	},
});

type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}

export const mainSchema = _mainSchema as mainSchema;

export interface $params extends v.InferInput<mainSchema["params"]> {}
export interface $output extends v.InferXRPCBodyInput<mainSchema["output"]> {}

declare module "@atcute/lexicons/ambient" {
	interface XRPCQueries {
		"com.jjalcloud.feed.getSearch": mainSchema;
	}
}
