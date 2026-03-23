import type {} from "@atcute/lexicons";
import type {} from "@atcute/lexicons/ambient";
import * as v from "@atcute/lexicons/validations";

const _mainSchema = /*#__PURE__*/ v.record(
	/*#__PURE__*/ v.tidString(),
	/*#__PURE__*/ v.object({
		$type: /*#__PURE__*/ v.literal("com.jjalcloud.feed.gif"),
		/**
		 * Alternative text for accessibility
		 * @maxGraphemes 300
		 */
		alt: /*#__PURE__*/ v.optional(
			/*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
				/*#__PURE__*/ v.stringGraphemes(0, 300),
			]),
		),
		createdAt: /*#__PURE__*/ v.datetimeString(),
		/**
		 * @accept image/gif
		 * @maxSize 20000000
		 */
		file: /*#__PURE__*/ v.blob(),
		/**
		 * Height of the GIF in pixels
		 */
		height: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.integer()),
		/**
		 * @maxLength 10
		 */
		tags: /*#__PURE__*/ v.optional(
			/*#__PURE__*/ v.constrain(
				/*#__PURE__*/ v.array(
					/*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
						/*#__PURE__*/ v.stringLength(0, 100),
					]),
				),
				[/*#__PURE__*/ v.arrayLength(0, 10)],
			),
		),
		/**
		 * @maxLength 1000
		 * @maxGraphemes 100
		 */
		title: /*#__PURE__*/ v.optional(
			/*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
				/*#__PURE__*/ v.stringLength(0, 1000),
				/*#__PURE__*/ v.stringGraphemes(0, 100),
			]),
		),
		/**
		 * Width of the GIF in pixels
		 */
		width: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.integer()),
	}),
);

type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}

export const mainSchema = _mainSchema as mainSchema;

export interface Main extends v.InferInput<typeof mainSchema> {}

declare module "@atcute/lexicons/ambient" {
	interface Records {
		"com.jjalcloud.feed.gif": mainSchema;
	}
}
