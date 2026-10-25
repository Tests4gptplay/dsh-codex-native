import { createRequire } from "node:module";
import z from "@deepseek-ai/schemastery";
import { CONTEXT_WINDOW_EXCEEDED_CODE, LlmAdapter, LlmError, QUOTA_EXCEEDED_CODE, ReasoningEffortId, ToolCallId, contentHasImage, offloadedImageText } from "@deepseek-ai/dsh-llm";
import { createHash } from "node:crypto";
import { AttachmentId } from "@deepseek-ai/dsh-attachment";
import { once } from "node:events";
import { dirname, join, resolve } from "node:path";
import { chmod, mkdtemp, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { isDeepStrictEqual } from "node:util";
import { existsSync } from "node:fs";
import { clientRequestSchema } from "@deepseek-ai/dsh-client-connection";
//#region src/identifiers.ts
/** CLI-safe Codex route identifiers shared by configuration and dispatch. */
const SAFE_MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/u;
const SAFE_REASONING_EFFORT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/u;
/** App Server namespace whose callbacks are owned by the outer Harness loop. */
const HARNESS_TOOL_NAMESPACE = "deepseek_harness";
//#endregion
//#region src/images.ts
/** Durable projection and transient hydration of Codex image content. */
const IMAGE_MARKER_KIND = "dsh-image-attachment";
const IMAGE_MARKER_VERSION = 1;
const IMAGE_MEDIA_TYPES = /* @__PURE__ */ new Set([
	"image/png",
	"image/jpeg",
	"image/webp",
	"image/gif"
]);
const IMAGE_DETAILS = /* @__PURE__ */ new Set([
	"auto",
	"low",
	"high",
	"original"
]);
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
function object$2(value, label, code) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) throw new LlmError(`${label} must be a JSON object`, code);
	return value;
}
function positiveInteger(value, label) {
	if (!Number.isSafeInteger(value) || value <= 0) throw new LlmError(`Codex history contains invalid ${label}`, "INVALID_HISTORY");
	return value;
}
function attachmentRef(value, label) {
	const candidate = object$2(value, label, "INVALID_HISTORY");
	if (typeof candidate.attachmentId !== "string" || candidate.attachmentId.length === 0 || typeof candidate.mediaType !== "string" || !IMAGE_MEDIA_TYPES.has(candidate.mediaType) || candidate.name !== void 0 && (typeof candidate.name !== "string" || candidate.name.length === 0)) throw new LlmError(`Codex history contains invalid ${label}`, "INVALID_HISTORY");
	return {
		attachmentId: AttachmentId(candidate.attachmentId),
		mediaType: candidate.mediaType,
		bytes: positiveInteger(candidate.bytes, `${label}.bytes`),
		width: positiveInteger(candidate.width, `${label}.width`),
		height: positiveInteger(candidate.height, `${label}.height`),
		...candidate.name === void 0 ? {} : { name: candidate.name }
	};
}
function referenceValue(ref) {
	return {
		attachmentId: String(ref.attachmentId),
		mediaType: ref.mediaType,
		bytes: ref.bytes,
		width: ref.width,
		height: ref.height,
		...ref.name === void 0 ? {} : { name: ref.name }
	};
}
/** Durable adapter-private marker placed where App Server expects an image URL. */
function imageAttachmentMarker(ref) {
	return {
		kind: IMAGE_MARKER_KIND,
		version: IMAGE_MARKER_VERSION,
		attachment: referenceValue(ref)
	};
}
function markerReference(value, label) {
	const marker = object$2(value, label, "INVALID_HISTORY");
	if (marker.kind !== IMAGE_MARKER_KIND || marker.version !== IMAGE_MARKER_VERSION) throw new LlmError(`Codex history contains invalid ${label}`, "INVALID_HISTORY");
	return attachmentRef(marker.attachment, `${label}.attachment`);
}
function imageDetail(value, label) {
	if (value === void 0) return void 0;
	if (typeof value !== "string" || !IMAGE_DETAILS.has(value)) throw new LlmError(`Codex history contains invalid ${label}`, "INVALID_HISTORY");
	return value;
}
function displayName(value) {
	if (typeof value !== "string" || value.length === 0) return void 0;
	const normalized = value.replaceAll("\\", "/");
	const name = normalized.slice(normalized.lastIndexOf("/") + 1);
	return name.length === 0 ? void 0 : name;
}
function decodedBase64(encoded, mediaType, limits, label, name) {
	const maximumEncodedBytes = 4 * Math.ceil(limits.maxImageBytes / 3);
	if (encoded.length === 0 || encoded.length > maximumEncodedBytes || encoded.length % 4 !== 0 || !BASE64.test(encoded)) throw new LlmError(`Codex App Server returned invalid ${label}`, "MALFORMED_RESPONSE");
	const data = Buffer.from(encoded, "base64");
	if (data.byteLength === 0 || data.byteLength > limits.maxImageBytes || data.toString("base64") !== encoded) throw new LlmError(`Codex App Server returned invalid ${label}`, "MALFORMED_RESPONSE");
	return {
		data,
		mediaType,
		...name === void 0 ? {} : { name }
	};
}
function decodedDataUrl(value, limits, label) {
	if (!value.startsWith("data:")) return void 0;
	const separator = value.indexOf(",");
	if (separator < 0) throw new LlmError(`Codex App Server returned invalid ${label}`, "MALFORMED_RESPONSE");
	const header = value.slice(5, separator);
	const match = /^(image\/(?:png|jpeg|webp|gif));base64$/u.exec(header);
	if (match === null) throw new LlmError(`Codex App Server returned unsupported ${label}`, "UNSUPPORTED_CONTENT");
	return decodedBase64(value.slice(separator + 1), match[1], limits, label);
}
function imageKey(input) {
	return `${input.mediaType}:${createHash("sha256").update(input.data).digest("hex")}`;
}
function base64Length(bytes, label) {
	const length = Math.ceil(bytes / 3) * 4;
	if (!Number.isSafeInteger(length)) throw new LlmError(`Codex history contains invalid ${label}`, "INVALID_HISTORY");
	return length;
}
function markerLength(value, label) {
	return base64Length(markerReference(value, label).bytes, `${label}.attachment.bytes`);
}
function collectModelImageLengths(item, label, lengths) {
	if (item === null || typeof item !== "object" || Array.isArray(item)) return;
	const values = item.type === "message" && Array.isArray(item.content) ? item.content : item.type === "function_call_output" && Array.isArray(item.output) ? item.output : void 0;
	if (values === void 0) return;
	for (const [index, value] of values.entries()) {
		if (value === null || typeof value !== "object" || Array.isArray(value) || value.type !== "input_image" || typeof value.image_url === "string") continue;
		lengths.push(markerLength(value.image_url, `${label}[${index}].image_url`));
	}
}
function replaceOldestModelImages(item, remaining, label) {
	if (item === null || typeof item !== "object" || Array.isArray(item)) return item;
	const field = item.type === "message" && Array.isArray(item.content) ? "content" : item.type === "function_call_output" && Array.isArray(item.output) ? "output" : void 0;
	if (field === void 0) return item;
	const values = item[field];
	let next;
	for (const [index, value] of values.entries()) if (remaining.count > 0 && value !== null && typeof value === "object" && !Array.isArray(value) && value.type === "input_image" && typeof value.image_url !== "string") {
		remaining.count -= 1;
		next ??= values.slice(0, index);
		const ref = markerReference(value.image_url, `${label}[${index}].image_url`);
		next.push({
			type: "input_text",
			text: offloadedImageText(ref)
		});
	} else next?.push(value);
	return next === void 0 ? item : {
		...item,
		[field]: next
	};
}
/**
* Bound only marker fields that will be hydrated into model-visible image input.
* Provider trajectory markers such as imageGeneration.result are never counted.
*/
function boundRequestImageHistory(history, maxRequestImageBytes) {
	if (!Number.isSafeInteger(maxRequestImageBytes) || maxRequestImageBytes <= 0) throw new LlmError("Codex maxRequestImageBytes must be a positive safe integer", "INVALID_REQUEST");
	const lengths = [];
	for (const [index, item] of history.entries()) collectModelImageLengths(item, `history[${index}]`, lengths);
	let total = 0;
	for (const length of lengths) {
		total += length;
		if (!Number.isSafeInteger(total)) throw new LlmError("Codex history image payload length overflowed", "INVALID_HISTORY");
	}
	let count = 0;
	for (const length of lengths) {
		if (total <= maxRequestImageBytes) break;
		total -= length;
		count += 1;
	}
	if (count === 0) return [...history];
	const remaining = { count };
	return history.map((item, index) => replaceOldestModelImages(item, remaining, `history[${index}]`));
}
/**
* Move provider image bytes out of events and restore durable markers only at
* App Server transport boundaries. One instance belongs to one model request.
*/
var NativeImageBridge = class {
	resolveStore;
	references = /* @__PURE__ */ new Map();
	supplied = /* @__PURE__ */ new Set();
	published = /* @__PURE__ */ new Set();
	hydrated = /* @__PURE__ */ new Map();
	harnessCallIds = /* @__PURE__ */ new Set();
	storeValue;
	constructor(resolveStore) {
		this.resolveStore = resolveStore;
	}
	/** Classify durable history images so supplied echoes and historical outputs stay distinct. */
	rememberHistory(history) {
		for (const item of history) if (item !== null && typeof item === "object" && !Array.isArray(item) && item.type === "function_call" && item.namespace === "deepseek_harness" && typeof item.call_id === "string") this.harnessCallIds.add(item.call_id);
		for (const [itemIndex, item] of history.entries()) {
			if (item === null || typeof item !== "object" || Array.isArray(item)) continue;
			if (item.type === "message" && Array.isArray(item.content)) this.rememberContentMarkers(item.content, `history[${itemIndex}].content`, "supplied");
			else if (item.type === "function_call_output" && Array.isArray(item.output)) {
				const origin = typeof item.call_id === "string" && this.harnessCallIds.has(item.call_id) ? "supplied" : "published";
				this.rememberContentMarkers(item.output, `history[${itemIndex}].output`, origin);
			}
		}
	}
	/** Externalize binary fields in one live App Server event. */
	async externalize(event) {
		if (event.kind !== "notification") return {
			event,
			images: []
		};
		if (event.method === "item/completed") return this.externalizeImageGeneration(event);
		if (event.method === "rawResponseItem/completed") return this.externalizeRawItem(event);
		return {
			event,
			images: []
		};
	}
	/** Replace durable markers with verified data URLs for cold thread injection. */
	async hydrateHistory(history, signal) {
		this.rememberHistory(history);
		return Promise.all(history.map((item, index) => this.hydrateItem(item, `history[${index}]`, signal)));
	}
	/** Translate one durable user-message content array to App Server v2 UserInput. */
	async hydrateUserInput(content, signal) {
		if (content.length === 0) throw new LlmError("Codex history contains an empty user input", "INVALID_HISTORY");
		return Promise.all(content.map(async (value, index) => {
			const item = object$2(value, `userInput[${index}]`, "INVALID_HISTORY");
			if (item.type === "input_text" && typeof item.text === "string") return {
				type: "text",
				text: item.text,
				text_elements: []
			};
			if (item.type === "input_image" && typeof item.image_url !== "string") {
				const ref = markerReference(item.image_url, `userInput[${index}].image_url`);
				this.supplied.add(String(ref.attachmentId));
				const detail = imageDetail(item.detail, `userInput[${index}].detail`);
				return {
					type: "image",
					url: await this.dataUrl(ref, signal),
					...detail === void 0 ? {} : { detail }
				};
			}
			throw new LlmError(`Codex history contains unsupported userInput[${index}]`, "INVALID_HISTORY");
		}));
	}
	/** Translate one durable Harness tool result to App Server callback content items. */
	async hydrateToolResult(result, signal) {
		const contentItems = typeof result.output === "string" ? [{
			type: "inputText",
			text: result.output
		}] : await this.hydrateToolOutput(result.output, signal);
		return {
			callId: result.callId,
			contentItems: contentItems.length === 0 ? [{
				type: "inputText",
				text: ""
			}] : contentItems,
			success: result.success
		};
	}
	rememberContentMarkers(values, label, origin) {
		for (const [index, value] of values.entries()) {
			if (value === null || typeof value !== "object" || Array.isArray(value) || value.type !== "input_image" || typeof value.image_url === "string") continue;
			const ref = markerReference(value.image_url, `${label}[${index}].image_url`);
			(origin === "supplied" ? this.supplied : this.published).add(String(ref.attachmentId));
		}
	}
	store() {
		this.storeValue ??= this.resolveStore();
		if (this.storeValue === void 0) throw new LlmError("Codex image conversion requires the durable attachment service", "UNSUPPORTED_CONTENT");
		return this.storeValue;
	}
	async save(input) {
		const key = imageKey(input);
		const known = this.references.get(key);
		if (known !== void 0) {
			if (known.name !== void 0 || input.name === void 0) return known;
			const named = {
				...known,
				name: input.name
			};
			this.references.set(key, named);
			return named;
		}
		const saved = await this.store().saveImage(input);
		this.references.set(key, saved);
		return saved;
	}
	publish(ref) {
		const id = String(ref.attachmentId);
		if (this.published.has(id)) return [];
		this.published.add(id);
		return [ref];
	}
	async externalizeImageGeneration(event) {
		const current = object$2(event.params.item, "Codex image-generation item", "MALFORMED_RESPONSE");
		if (current.type !== "imageGeneration") return {
			event,
			images: []
		};
		if (typeof current.result !== "string") throw new LlmError("Codex App Server returned invalid image-generation result", "MALFORMED_RESPONSE");
		if (current.result.length === 0) {
			if (current.status === "completed") throw new LlmError("Codex App Server completed image generation without image bytes", "MALFORMED_RESPONSE");
			return {
				event,
				images: []
			};
		}
		const store = this.store();
		const input = decodedBase64(current.result, "image/png", store.imageLimits, "image-generation base64", displayName(current.savedPath));
		const ref = await this.save(input);
		return {
			event: {
				...event,
				params: {
					...event.params,
					item: {
						...current,
						result: imageAttachmentMarker(ref)
					}
				}
			},
			images: this.publish(ref)
		};
	}
	async externalizeRawItem(event) {
		const current = object$2(event.params.item, "Codex raw response item", "MALFORMED_RESPONSE");
		if (current.type === "function_call_output" && Array.isArray(current.output)) {
			const supplied = typeof current.call_id === "string" && this.harnessCallIds.has(current.call_id);
			return this.externalizeRawContent(event, current, "output", supplied);
		}
		if (current.type === "message" && current.role !== "assistant" && Array.isArray(current.content)) return this.externalizeRawContent(event, current, "content", true);
		return {
			event,
			images: []
		};
	}
	async externalizeRawContent(event, current, field, supplied) {
		const values = current[field];
		const pending = [];
		for (const [index, value] of values.entries()) {
			const content = object$2(value, `Codex ${field} content ${index}`, "MALFORMED_RESPONSE");
			if (content.type !== "input_image" || typeof content.image_url !== "string" || !content.image_url.startsWith("data:")) continue;
			const input = decodedDataUrl(content.image_url, this.store().imageLimits, `${field} image ${index}`);
			if (input !== void 0) pending.push({
				index,
				input
			});
		}
		if (pending.length === 0) return {
			event,
			images: []
		};
		const store = this.store();
		const totalBytes = pending.reduce((total, entry) => total + entry.input.data.byteLength, 0);
		if (pending.length > store.imageLimits.maxImagesPerMessage || totalBytes > store.imageLimits.maxMessageImageBytes) throw new LlmError("Codex App Server returned too many image bytes in one content item", "MALFORMED_RESPONSE");
		await Promise.all(pending.filter((entry) => !this.references.has(imageKey(entry.input))).map((entry) => store.validateImage(entry.input)));
		const output = [...values];
		const images = [];
		for (const entry of pending) {
			const ref = await this.save(entry.input);
			const content = object$2(output[entry.index], `Codex ${field} content ${entry.index}`, "MALFORMED_RESPONSE");
			output[entry.index] = {
				...content,
				image_url: imageAttachmentMarker(ref)
			};
			const attachmentId = String(ref.attachmentId);
			if (supplied || this.supplied.has(attachmentId)) this.supplied.add(attachmentId);
			else images.push(...this.publish(ref));
		}
		return {
			event: {
				...event,
				params: {
					...event.params,
					item: {
						...current,
						[field]: output
					}
				}
			},
			images
		};
	}
	async hydrateItem(item, label, signal) {
		if (item === null || typeof item !== "object" || Array.isArray(item)) return item;
		if (item.type === "message" && Array.isArray(item.content)) {
			const supplied = item.role !== "assistant";
			const content = await this.hydrateRawContent(item.content, `${label}.content`, supplied, signal);
			return content === item.content ? item : {
				...item,
				content
			};
		}
		if (item.type === "function_call_output" && Array.isArray(item.output)) {
			const supplied = typeof item.call_id === "string" && this.harnessCallIds.has(item.call_id);
			const output = await this.hydrateRawContent(item.output, `${label}.output`, supplied, signal);
			return output === item.output ? item : {
				...item,
				output
			};
		}
		return item;
	}
	async hydrateRawContent(values, label, supplied, signal) {
		return Promise.all(values.map(async (value, index) => {
			if (value === null || typeof value !== "object" || Array.isArray(value) || value.type !== "input_image") return value;
			if (typeof value.image_url === "string") return value;
			const ref = markerReference(value.image_url, `${label}[${index}].image_url`);
			(supplied ? this.supplied : this.published).add(String(ref.attachmentId));
			return {
				...value,
				image_url: await this.dataUrl(ref, signal)
			};
		}));
	}
	async hydrateToolOutput(output, signal) {
		if (!Array.isArray(output)) throw new LlmError("Codex history contains invalid structured tool output", "INVALID_HISTORY");
		return Promise.all(output.map(async (value, index) => {
			const item = object$2(value, `toolResult.output[${index}]`, "INVALID_HISTORY");
			if (item.type === "input_text" && typeof item.text === "string") return {
				type: "inputText",
				text: item.text
			};
			if (item.type === "input_image" && typeof item.image_url !== "string") {
				const ref = markerReference(item.image_url, `toolResult.output[${index}].image_url`);
				this.supplied.add(String(ref.attachmentId));
				return {
					type: "inputImage",
					imageUrl: await this.dataUrl(ref, signal)
				};
			}
			throw new LlmError(`Codex history contains unsupported toolResult.output[${index}]`, "INVALID_HISTORY");
		}));
	}
	dataUrl(ref, signal) {
		const key = JSON.stringify(referenceValue(ref));
		let task = this.hydrated.get(key);
		if (task === void 0) {
			task = this.store().readImage(ref, signal).then((stored) => {
				if (JSON.stringify(referenceValue(stored.ref)) !== key) throw new LlmError("Codex attachment read returned a mismatched reference", "INVALID_HISTORY");
				const input = {
					data: stored.data,
					mediaType: stored.ref.mediaType
				};
				this.references.set(imageKey(input), stored.ref);
				return `data:${stored.ref.mediaType};base64,${Buffer.from(stored.data).toString("base64")}`;
			});
			this.hydrated.set(key, task);
		}
		return task;
	}
};
//#endregion
//#region src/wire.ts
/** Bounded bidirectional newline-delimited JSON-RPC transport for App Server. */
var AsyncQueue = class {
	values = [];
	waiters = [];
	closed = false;
	failure;
	push(value) {
		if (this.closed) return;
		const waiter = this.waiters.shift();
		if (waiter === void 0) this.values.push(value);
		else waiter.resolve({
			done: false,
			value
		});
	}
	close(failure) {
		if (this.closed) return;
		this.closed = true;
		this.failure = failure;
		for (const waiter of this.waiters.splice(0)) if (failure === void 0) waiter.resolve({
			done: true,
			value: void 0
		});
		else waiter.reject(failure);
	}
	next() {
		const value = this.values.shift();
		if (value !== void 0) return Promise.resolve({
			done: false,
			value
		});
		if (this.failure !== void 0) return Promise.reject(this.failure);
		if (this.closed) return Promise.resolve({
			done: true,
			value: void 0
		});
		const waiter = Promise.withResolvers();
		this.waiters.push(waiter);
		return waiter.promise;
	}
};
/** Require a decoded value to be a JSON object. */
function object$1(value, label) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) throw new LlmError(`Codex App Server returned invalid ${label}`, "MALFORMED_RESPONSE");
	return value;
}
/** Copy and validate one decoded lossless JSON value. */
function jsonValue(value, label) {
	if (value === null || typeof value === "string" || typeof value === "boolean") return value;
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (Array.isArray(value)) return value.map((entry, index) => jsonValue(entry, `${label}[${index}]`));
	if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, jsonValue(entry, `${label}.${key}`)]));
	throw new LlmError(`Codex App Server returned non-JSON ${label}`, "MALFORMED_RESPONSE");
}
function rpcId(value) {
	return typeof value === "string" || typeof value === "number" ? value : void 0;
}
function rpcKey(id) {
	return `${typeof id}:${String(id)}`;
}
function thrown$2(value) {
	return value instanceof Error ? value : new Error(String(value));
}
/** One connected App Server JSON-RPC peer. */
var JsonRpcConnection = class {
	input;
	output;
	maxJsonRpcLineBytes;
	pending = /* @__PURE__ */ new Map();
	events = new AsyncQueue();
	nextId = 1;
	buffer = "";
	stopped = false;
	failure;
	stopSignal = new AbortController();
	/**
	* @param input - writable App Server stdin.
	* @param output - readable App Server stdout.
	* @param maxJsonRpcLineBytes - maximum UTF-8 bytes retained for one frame.
	*/
	constructor(input, output, maxJsonRpcLineBytes) {
		this.input = input;
		this.output = output;
		this.maxJsonRpcLineBytes = maxJsonRpcLineBytes;
		output.setEncoding("utf8");
		output.on("data", this.onData);
		output.once("end", this.onEnd);
		output.once("close", this.onEnd);
		input.once("close", this.onEnd);
		output.once("error", this.onError);
		input.once("error", this.onError);
	}
	/** Observed pipe state only; no heartbeat, polling, or model request. */
	get closed() {
		return this.stopped || this.output.readableEnded || this.output.destroyed || this.input.destroyed || this.input.writableEnded;
	}
	onData = (chunk) => {
		if (this.stopped) return;
		this.buffer += chunk;
		while (true) {
			const newline = this.buffer.indexOf("\n");
			if (newline === -1) {
				if (Buffer.byteLength(this.buffer) > this.maxJsonRpcLineBytes) this.fail(new LlmError("Codex App Server JSON-RPC line exceeded its configured limit", "OUTPUT_LIMIT"));
				return;
			}
			const line = this.buffer.slice(0, newline).replace(/\r$/u, "");
			this.buffer = this.buffer.slice(newline + 1);
			if (line.trim().length === 0) continue;
			if (Buffer.byteLength(line) > this.maxJsonRpcLineBytes) {
				this.fail(new LlmError("Codex App Server JSON-RPC line exceeded its configured limit", "OUTPUT_LIMIT"));
				return;
			}
			try {
				this.receive(JSON.parse(line));
			} catch (error) {
				this.fail(error instanceof LlmError ? error : new LlmError("Codex App Server emitted malformed JSON-RPC", "MALFORMED_RESPONSE", { cause: thrown$2(error) }));
				return;
			}
		}
	};
	onEnd = () => {
		if (this.stopped) return;
		if (this.buffer.trim().length !== 0) {
			this.fail(new LlmError("Codex App Server stdout ended with an incomplete JSON-RPC line", "MALFORMED_RESPONSE"));
			return;
		}
		this.fail(new LlmError("Codex App Server closed its protocol stream", "TRANSPORT"));
	};
	onError = (error) => {
		this.fail(new LlmError("Codex App Server protocol stream failed", "TRANSPORT", { cause: error }));
	};
	receive(value) {
		const envelope = object$1(value, "JSON-RPC envelope");
		const id = rpcId(envelope.id);
		if (typeof envelope.method === "string") {
			const params = object$1(envelope.params ?? {}, `${envelope.method} params`);
			if (id === void 0) this.events.push({
				kind: "notification",
				method: envelope.method,
				params
			});
			else this.events.push({
				kind: "server-request",
				id,
				method: envelope.method,
				params,
				resolution: "rejected"
			});
			return;
		}
		if (id === void 0) throw new LlmError("Codex App Server response has no id", "MALFORMED_RESPONSE");
		const pending = this.pending.get(rpcKey(id));
		if (pending === void 0) throw new LlmError("Codex App Server returned an unknown response id", "MALFORMED_RESPONSE");
		this.pending.delete(rpcKey(id));
		if (envelope.error !== void 0) pending.waiter.reject(new LlmError(`Codex App Server ${pending.method} failed: ${JSON.stringify(envelope.error)}`, "CODEX_PROTOCOL"));
		else pending.waiter.resolve(envelope.result);
	}
	async send(envelope) {
		if (this.closed) throw this.failure ?? new LlmError("Codex App Server connection is closed", "TRANSPORT");
		const line = `${JSON.stringify(envelope)}\n`;
		if (this.input.write(line)) return;
		try {
			await once(this.input, "drain", { signal: this.stopSignal.signal });
		} catch (error) {
			throw this.failure ?? error;
		}
	}
	/** Send one client request and resolve its correlated response. */
	async request(method, params) {
		const id = this.nextId++;
		const waiter = Promise.withResolvers();
		this.pending.set(rpcKey(id), {
			method,
			waiter
		});
		this.send({
			method,
			id,
			params
		}).catch((error) => {
			this.pending.delete(rpcKey(id));
			waiter.reject(error);
		});
		return waiter.promise;
	}
	/** Send one client notification. */
	notify(method, params) {
		return this.send({
			method,
			params
		});
	}
	/** Resolve one App Server request. */
	respond(id, result) {
		return this.send({
			id,
			result
		});
	}
	/** Reject one App Server request. */
	respondError(id, code, message) {
		return this.send({
			id,
			error: {
				code,
				message
			}
		});
	}
	/** Read the next notification or server request. */
	next() {
		return this.events.next();
	}
	/** Fail every waiter and detach the stream listeners. */
	fail(error) {
		if (this.stopped) return;
		this.stopped = true;
		this.failure = error;
		this.stopSignal.abort(error);
		this.detach();
		for (const pending of this.pending.values()) pending.waiter.reject(error);
		this.pending.clear();
		this.events.close(error);
	}
	/** Close every waiter without manufacturing a transport failure. */
	dispose() {
		if (this.stopped) return;
		this.stopped = true;
		const error = new LlmError("Codex App Server connection disposed", "ABORTED");
		this.failure = error;
		this.stopSignal.abort(error);
		this.detach();
		for (const pending of this.pending.values()) pending.waiter.reject(error);
		this.pending.clear();
		this.events.close();
	}
	detach() {
		this.output.off("data", this.onData);
		this.output.off("end", this.onEnd);
		this.output.off("close", this.onEnd);
		this.input.off("close", this.onEnd);
	}
};
//#endregion
//#region src/protocol.ts
/** App Server history, event, and Harness stream translation. */
const REPLAY_KIND = "codex-app-server";
const REPLAY_VERSION = 4;
const CODEX_MODEL_CAPACITY_CODE = "MODEL_CAPACITY";
const CODEX_MODEL_CAPACITY_RETRY_AFTER_MS = 300 * 1e3;
const HARNESS_SKILL_NAME = "skill";
const HARNESS_SKILL_TOOL_NAME = "harness_skill";
const NATIVE_COMPACTION_ITEM_TYPES = /* @__PURE__ */ new Set([
	"compaction",
	"compaction_trigger",
	"context_compaction"
]);
function finiteInteger(value, label) {
	if (!Number.isSafeInteger(value) || value < 0) throw new LlmError(`Codex App Server returned invalid ${label}`, "MALFORMED_RESPONSE");
	return value;
}
function checkedAdd(left, right, label) {
	const result = left + right;
	if (!Number.isSafeInteger(result)) throw new LlmError(`Codex App Server ${label} usage overflowed`, "MALFORMED_RESPONSE");
	return result;
}
function jsonRecord(value, label) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) throw new LlmError(`${label} must be a JSON object`, "INVALID_TOOL_SCHEMA");
	return value;
}
function appServerToolName(name) {
	return name === HARNESS_SKILL_NAME ? HARNESS_SKILL_TOOL_NAME : name;
}
function harnessSkillCatalogNames(messages) {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const source = messages[index].source;
		if (source.kind !== "skill-catalog") continue;
		if (source.form !== "catalog" || !Array.isArray(source.entries)) throw new LlmError("Harness history contains an invalid skill catalog", "INVALID_HISTORY");
		const names = [];
		const seen = /* @__PURE__ */ new Set();
		for (const entry of source.entries) {
			if (entry === null || typeof entry !== "object" || Array.isArray(entry) || typeof entry.name !== "string" || entry.name.length === 0 || seen.has(entry.name)) throw new LlmError("Harness history contains an invalid skill catalog entry", "INVALID_HISTORY");
			const name = entry.name;
			seen.add(name);
			names.push(name);
		}
		return names;
	}
	return [];
}
function bridgedTools(tools, skillNames) {
	const bridged = [];
	const seen = /* @__PURE__ */ new Set();
	for (const tool of tools ?? []) {
		if (tool.name === HARNESS_SKILL_NAME && skillNames.length === 0) continue;
		const name = appServerToolName(tool.name);
		if (seen.has(name)) throw new LlmError(`Harness tool names collide after App Server mapping: ${JSON.stringify(name)}`, "INVALID_TOOL_SCHEMA");
		seen.add(name);
		bridged.push({
			name,
			tool
		});
	}
	return bridged;
}
function appServerToolSchema(tool, skillNames) {
	const schema = jsonValue(tool.parameters, `schema for ${tool.name}`);
	if (tool.name !== HARNESS_SKILL_NAME) return schema;
	const root = jsonRecord(schema, "Harness skill tool schema");
	const properties = jsonRecord(root.properties, "Harness skill tool schema properties");
	const name = jsonRecord(properties.name, "Harness skill name schema");
	return {
		...root,
		properties: {
			...properties,
			name: {
				...name,
				enum: [...skillNames]
			}
		}
	};
}
function replayItems(value) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return void 0;
	const envelope = value;
	const response = Object.hasOwn(envelope, "response") ? envelope.response : envelope;
	if (response === null || typeof response !== "object" || Array.isArray(response)) return void 0;
	const candidate = response;
	if (candidate.kind !== REPLAY_KIND || candidate.version !== REPLAY_VERSION || !Array.isArray(candidate.items) || !Array.isArray(candidate.contextItems)) return;
	candidate.contextItems.forEach((item, index) => {
		jsonValue(item, `replayState.response.contextItems[${index}]`);
	});
	return replayableItems(candidate.items.map((item, index) => jsonValue(item, `replayState.response.items[${index}]`)).filter((item) => !isNativeCompactionItem(item)));
}
function isNativeCompactionItem(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value) && typeof value.type === "string" && NATIVE_COMPACTION_ITEM_TYPES.has(value.type);
}
/**
* Keep Code Mode replay only when every custom call has its matching output.
* A Harness dynamic callback can suspend the native call across DSH steps; if
* exact continuation later fails, that half-finished native invocation cannot
* be resumed in a fresh App Server process. The canonical Harness
* `function_call`/`function_call_output` pair remains in durable history.
*/
function replayableItems(items) {
	const calls = /* @__PURE__ */ new Set();
	const outputs = /* @__PURE__ */ new Set();
	for (const item of items) {
		if (item === null || typeof item !== "object" || Array.isArray(item) || typeof item.call_id !== "string" || item.call_id.length === 0) continue;
		if (item.type === "custom_tool_call") calls.add(item.call_id);
		if (item.type === "custom_tool_call_output") outputs.add(item.call_id);
	}
	return items.filter((item) => {
		if (item === null || typeof item !== "object" || Array.isArray(item) || typeof item.call_id !== "string") return true;
		if (item.type === "custom_tool_call") return outputs.has(item.call_id);
		if (item.type === "custom_tool_call_output") return calls.has(item.call_id);
		return true;
	});
}
const FINGERPRINT_IGNORED_KEYS = /* @__PURE__ */ new Set([
	"internal_chat_message_metadata_passthrough",
	"phase",
	"status"
]);
function normalizedFingerprintValue(value, loose) {
	if (Array.isArray(value)) return value.map((entry) => normalizedFingerprintValue(entry, loose));
	if (value === null || typeof value !== "object") return value;
	return Object.fromEntries(Object.keys(value).sort().flatMap((key) => {
		const entry = value[key];
		if (entry === null || FINGERPRINT_IGNORED_KEYS.has(key) || loose && key === "id") return [];
		return [[key, normalizedFingerprintValue(entry, loose)]];
	}));
}
function fingerprint(value, loose) {
	return JSON.stringify(normalizedFingerprintValue(value, loose));
}
function hasResponseItemId(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value) && typeof value.id === "string";
}
function responseItem(value, label) {
	const candidate = jsonValue(value, label);
	if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate) || typeof candidate.type !== "string") throw new LlmError(`Codex App Server returned invalid ${label}`, "MALFORMED_RESPONSE");
	return candidate;
}
function responseItemIdentity(value) {
	if (value === null || typeof value !== "object" || Array.isArray(value) || typeof value.type !== "string") return;
	if (typeof value.id === "string" && value.id.length > 0) return JSON.stringify([
		value.type,
		"id",
		value.id
	]);
	if (typeof value.call_id === "string" && value.call_id.length > 0) return JSON.stringify([
		value.type,
		"call_id",
		value.call_id
	]);
}
function appendHistoryItem(history, identities, item, origin) {
	const identity = responseItemIdentity(item);
	if (identity === void 0) {
		history.push(item);
		return;
	}
	const previous = identities.get(identity);
	if (previous === void 0) {
		identities.set(identity, {
			index: history.length,
			origin
		});
		history.push(item);
		return;
	}
	if (previous.origin === "harness" && origin === "provider") return;
	history[previous.index] = item;
	identities.set(identity, {
		index: previous.index,
		origin
	});
}
function rawItemDisposition(value) {
	if (value.type === "message") return value.role === "assistant" ? "replay" : "context";
	return NATIVE_COMPACTION_ITEM_TYPES.has(value.type) ? "trajectory" : "replay";
}
function argumentsJson(value, label) {
	let parsed;
	try {
		parsed = JSON.parse(value);
	} catch (error) {
		throw new LlmError(`Codex history contains non-JSON ${label}`, "MALFORMED_RESPONSE", { cause: error });
	}
	object$1(parsed, label);
	return value;
}
function fallbackText(block) {
	switch (block.type) {
		case "text": return block.text;
		case "reasoning": return `[reasoning]\n${block.text}`;
		case "codex-action": return `[codex-action]\n${JSON.stringify(block)}`;
		case "tool-call": return `[tool-call ${block.name}]\n${block.arguments}`;
		case "image": throw new LlmError("Codex App Server provider supports text input only", "UNSUPPORTED_CONTENT");
		default: return `[${String(block.type)}]\n${JSON.stringify(block)}`;
	}
}
function containsImage(block) {
	return block.type === "image";
}
function structuredResultContent(blocks) {
	return blocks.flatMap((block) => {
		if (block.type === "image") return [{
			type: "input_image",
			image_url: imageAttachmentMarker(block.attachment)
		}];
		return [{
			type: "input_text",
			text: fallbackText(block)
		}];
	});
}
function resultOutput(message) {
	if (!message.content.some(containsImage)) {
		const output = message.content.map(fallbackText).join("\n");
		return message.isError === true ? `Tool error:\n${output}` : output;
	}
	const content = structuredResultContent(message.content);
	return message.isError === true ? [{
		type: "input_text",
		text: "Tool error:\n"
	}, ...content] : content;
}
function roleFor(role) {
	return role === "system" ? "developer" : role;
}
function encodedHistoryMessage(role, content) {
	return {
		type: "message",
		role: roleFor(role),
		content: [...content]
	};
}
/** Reconstruct the App Server-visible conversation exclusively from the Harness request. */
function appServerHistory(options) {
	const history = [];
	const identities = /* @__PURE__ */ new Map();
	const append = (item, origin) => {
		appendHistoryItem(history, identities, item, origin);
	};
	for (const message of options.messages) {
		if (message.role === "tool") {
			append({
				type: "function_call_output",
				call_id: String(message.toolCallId),
				output: resultOutput(message)
			}, "harness");
			continue;
		}
		const replay = message.role === "assistant" && message.source.kind === "model" && message.source.provider === options.provider ? replayItems(message.source.replayState) : void 0;
		if (replay !== void 0) {
			for (const item of replay) append(item, "provider");
			continue;
		}
		let content = [];
		const flushContent = () => {
			if (content.length === 0) return;
			append(encodedHistoryMessage(message.role, content), "harness");
			content = [];
		};
		for (const block of message.content) switch (block.type) {
			case "text":
				content.push({
					type: message.role === "assistant" ? "output_text" : "input_text",
					text: block.text
				});
				break;
			case "reasoning":
				content.push({
					type: message.role === "assistant" ? "output_text" : "input_text",
					text: `[reasoning]\n${block.text}`
				});
				break;
			case "codex-action": break;
			case "tool-call":
				flushContent();
				append({
					type: "function_call",
					call_id: String(block.id),
					namespace: HARNESS_TOOL_NAMESPACE,
					name: appServerToolName(block.name),
					arguments: argumentsJson(block.arguments, `arguments for ${block.name}`)
				}, "harness");
				break;
			case "image":
				if (message.role !== "user") throw new LlmError(`Codex App Server cannot reconstruct ${message.role} image content without provider replay`, "UNSUPPORTED_CONTENT");
				content.push({
					type: "input_image",
					image_url: imageAttachmentMarker(block.attachment)
				});
				break;
			default: content.push({
				type: message.role === "assistant" ? "output_text" : "input_text",
				text: `[${String(block.type)}]\n${JSON.stringify(block)}`
			});
		}
		flushContent();
	}
	return history;
}
function existingHistoryOrigin(item) {
	if (item === null || typeof item !== "object" || Array.isArray(item)) return "provider";
	if (item.type === "function_call_output") return "harness";
	if (item.type === "function_call" && item.namespace === "deepseek_harness") return "harness";
	if (item.type === "message" && item.role !== "assistant") return "harness";
	return "provider";
}
/** Append newly logged provider outputs using the same identities as request reconstruction. */
function extendAppServerHistory(history, outputs) {
	const extended = [];
	const identities = /* @__PURE__ */ new Map();
	for (const item of history) appendHistoryItem(extended, identities, item, existingHistoryOrigin(item));
	for (const item of outputs) appendHistoryItem(extended, identities, item, "provider");
	return extended;
}
/** Extract logged Harness tool outcomes for exact App Server callback continuation. */
function appServerToolResults(options, modelHistory) {
	const visibleOutputs = /* @__PURE__ */ new Map();
	for (const item of modelHistory ?? []) if (item !== null && typeof item === "object" && !Array.isArray(item) && item.type === "function_call_output" && typeof item.call_id === "string" && item.output !== void 0) visibleOutputs.set(item.call_id, item.output);
	return options.messages.flatMap((message) => {
		if (message.role !== "tool") return [];
		const callId = String(message.toolCallId);
		return [{
			callId,
			output: visibleOutputs.get(callId) ?? resultOutput(message),
			success: message.isError !== true
		}];
	});
}
/** Translate available Harness tools to App Server dynamic tools. */
function appServerDynamicTools(tools, messages = []) {
	const skillNames = harnessSkillCatalogNames(messages);
	const declared = bridgedTools(tools, skillNames);
	if (declared.length === 0) return [];
	return [{
		type: "namespace",
		name: HARNESS_TOOL_NAMESPACE,
		description: declared.some(({ tool }) => tool.name === HARNESS_SKILL_NAME) ? "Tools provided by the outer DeepSeek Harness agent loop. The harness_skill alias loads only names from the Harness session catalog; use Codex native skill support for Codex skills." : "Tools provided by the outer DeepSeek Harness agent loop.",
		tools: declared.map(({ name, tool }) => ({
			type: "function",
			name,
			description: tool.name === HARNESS_SKILL_NAME ? `${tool.description} This App Server alias is only for the outer Harness session catalog, not Codex-native skills.` : tool.description,
			inputSchema: appServerToolSchema(tool, skillNames)
		}))
	}];
}
/** Decode one App Server dynamic callback without executing it in the provider. */
function harnessToolCall(event, tools, messages = []) {
	if (event.method !== "item/tool/call") throw new LlmError(`Expected a dynamic tool call, received ${event.method}`, "MALFORMED_RESPONSE");
	const params = event.params;
	if (typeof params.callId !== "string" || params.callId.length === 0 || typeof params.tool !== "string" || params.tool.length === 0) throw new LlmError("Codex App Server returned an invalid dynamic tool call", "MALFORMED_RESPONSE");
	if (params.namespace !== "deepseek_harness") throw new LlmError("Codex requested a tool outside the DeepSeek Harness namespace", "UNKNOWN_TOOL");
	const skillNames = harnessSkillCatalogNames(messages);
	const originalName = new Map(bridgedTools(tools, skillNames).map(({ name, tool }) => [name, tool.name])).get(params.tool);
	if (originalName === void 0) throw new LlmError(`Codex requested unavailable Harness tool "${params.tool}"`, "UNKNOWN_TOOL");
	const args = object$1(params.arguments, `arguments for ${params.tool}`);
	if (originalName === HARNESS_SKILL_NAME && (typeof args.name !== "string" || !skillNames.includes(args.name))) throw new LlmError("Codex requested a skill outside the current Harness session catalog", "UNKNOWN_TOOL");
	return {
		id: ToolCallId(params.callId),
		name: originalName,
		arguments: JSON.stringify(params.arguments)
	};
}
const USAGE_FIELDS = [
	["inputTokens", "input token"],
	["outputTokens", "output token"],
	["cacheReadTokens", "cache-read token"],
	["cacheWriteTokens", "cache-write token"],
	["reasoningTokens", "reasoning token"]
];
const ACTION_NOTIFICATION_METHODS = /* @__PURE__ */ new Set([
	"hook/started",
	"hook/completed",
	"turn/diff/updated",
	"turn/plan/updated",
	"thread/compacted"
]);
const DIAGNOSTIC_NOTIFICATION_METHODS = /* @__PURE__ */ new Set([
	"error",
	"serverRequest/resolved",
	"model/rerouted",
	"model/verification",
	"model/safetyBuffering/updated",
	"turn/moderationMetadata",
	"warning",
	"guardianWarning",
	"deprecationNotice",
	"configWarning",
	"windows/worldWritableWarning",
	"windowsSandbox/setupCompleted"
]);
const RAW_REQUEST_ITEM_TYPES = /* @__PURE__ */ new Set([
	"function_call",
	"custom_tool_call",
	"tool_search_call"
]);
function item(value, label) {
	const candidate = object$1(value, label);
	if (typeof candidate.type !== "string" || typeof candidate.id !== "string") throw new LlmError(`Codex App Server returned invalid ${label}`, "MALFORMED_RESPONSE");
	return candidate;
}
function stringArray(value, label) {
	if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) throw new LlmError(`Codex App Server returned invalid ${label}`, "MALFORMED_RESPONSE");
	return value;
}
function terminalActionPhase(status, fallback) {
	if (status === "failed") return "failed";
	if (status === "declined" || status === "cancelled" || status === "canceled") return "declined";
	return fallback;
}
function rawActionPhase(value) {
	if (RAW_REQUEST_ITEM_TYPES.has(value.type)) return terminalActionPhase(value.status, "requested");
	if (value.status === "inProgress" || value.status === "in_progress") return "started";
	return terminalActionPhase(value.status, "completed");
}
/** Stateful conversion of one App Server turn to indexed Harness blocks and replay data. */
var AppServerEventMapper = class {
	open = /* @__PURE__ */ new Map();
	initialHistory;
	harnessToolNames;
	rawItems = [];
	contextItems = [];
	contextFingerprints = /* @__PURE__ */ new Set();
	exactBaseline = /* @__PURE__ */ new Map();
	looseBaseline = /* @__PURE__ */ new Map();
	accumulatedUsage = {
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		reasoningTokens: 0
	};
	rawUsageSeen = false;
	contextCompacting = false;
	currentContextUsage = null;
	nativeCompactionSeen = false;
	nextIndex = 0;
	nextRawAction = 0;
	constructor(history = [], harnessToolNames = []) {
		this.initialHistory = history.map((item, index) => jsonValue(item, `history[${index}]`));
		this.harnessToolNames = new Set(harnessToolNames.map(appServerToolName));
		this.resetBaseline();
	}
	resetBaseline() {
		this.exactBaseline = /* @__PURE__ */ new Map();
		this.looseBaseline = /* @__PURE__ */ new Map();
		for (const candidate of [...this.initialHistory, ...this.rawItems]) {
			const counts = hasResponseItemId(candidate) ? this.exactBaseline : this.looseBaseline;
			const key = fingerprint(candidate, !hasResponseItemId(candidate));
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}
	}
	consumeBaseline(candidate) {
		const exact = fingerprint(candidate, false);
		const exactCount = this.exactBaseline.get(exact) ?? 0;
		if (exactCount > 0) {
			this.exactBaseline.set(exact, exactCount - 1);
			return true;
		}
		const loose = fingerprint(candidate, true);
		const looseCount = this.looseBaseline.get(loose) ?? 0;
		if (looseCount > 0) {
			this.looseBaseline.set(loose, looseCount - 1);
			return true;
		}
		return false;
	}
	retainRawItem(value) {
		const candidate = responseItem(value, `raw response item ${this.rawItems.length + this.contextItems.length}`);
		if (this.consumeBaseline(candidate)) return { kind: "known" };
		if (NATIVE_COMPACTION_ITEM_TYPES.has(candidate.type)) {
			this.nativeCompactionSeen = true;
			this.currentContextUsage = null;
		}
		const disposition = rawItemDisposition(candidate);
		if (disposition === "replay") {
			this.rawItems.push(candidate);
			return {
				kind: "output",
				item: candidate
			};
		}
		if (disposition === "trajectory") return {
			kind: "trajectory",
			item: candidate
		};
		const key = fingerprint(candidate, true);
		if (this.contextFingerprints.has(key)) return { kind: "known" };
		this.contextFingerprints.add(key);
		this.contextItems.push(candidate);
		return {
			kind: "context",
			item: candidate
		};
	}
	rawActionId(value, params) {
		if (typeof value.call_id === "string" && value.call_id.length > 0) return value.call_id;
		if (typeof value.id === "string" && value.id.length > 0) return value.id;
		return `${typeof params.turnId === "string" ? params.turnId : "raw-response"}:${String(this.nextRawAction++)}`;
	}
	rawItemAction(params) {
		const retained = this.retainRawItem(params.item);
		if (retained.kind === "known") return [];
		const current = retained.item;
		if (retained.kind === "context") return this.action(this.rawActionId(current, params), "context/injected", "context", "completed", "rawResponseItem/completed", current);
		if (current.type === "message" || current.type === "reasoning") return [];
		if (RAW_REQUEST_ITEM_TYPES.has(current.type) && current.namespace === "deepseek_harness" && typeof current.name === "string" && this.harnessToolNames.has(current.name)) return [];
		return this.action(this.rawActionId(current, params), current.type, "action", rawActionPhase(current), "rawResponseItem/completed", current);
	}
	atomicBlock(block) {
		const index = this.nextIndex++;
		const chunks = [{
			type: "block-start",
			index,
			blockType: block.type
		}];
		if (block.type === "text") chunks.push({
			type: "text-delta",
			index,
			text: block.text
		});
		else if (block.type === "reasoning") chunks.push({
			type: "reasoning-delta",
			index,
			text: block.text
		});
		chunks.push({
			type: "block-end",
			index,
			block
		});
		return chunks;
	}
	action(actionId, actionType, category, phase, protocolEvent, snapshot) {
		return this.atomicBlock({
			type: "codex-action",
			actionId,
			actionType,
			category,
			phase,
			protocolEvent,
			snapshot: jsonValue(snapshot, `snapshot for ${actionType}`)
		});
	}
	delta(key, type, text) {
		let state = this.open.get(key);
		const chunks = [];
		if (state === void 0) {
			state = {
				index: this.nextIndex++,
				type,
				text: ""
			};
			this.open.set(key, state);
			chunks.push({
				type: "block-start",
				index: state.index,
				blockType: type
			});
		}
		if (state.type !== type) throw new LlmError("Codex App Server reused an item id across block types", "MALFORMED_RESPONSE");
		state.text += text;
		chunks.push(type === "text" ? {
			type: "text-delta",
			index: state.index,
			text
		} : {
			type: "reasoning-delta",
			index: state.index,
			text
		});
		return chunks;
	}
	close(key, completedText) {
		const state = this.open.get(key);
		if (state === void 0) return [];
		this.open.delete(key);
		const text = completedText ?? state.text;
		return [{
			type: "block-end",
			index: state.index,
			block: state.type === "text" ? {
				type: "text",
				text
			} : {
				type: "reasoning",
				text
			}
		}];
	}
	addUsage(value, raw) {
		if (raw) this.currentContextUsage = null;
		if (value === null || value === void 0) return;
		const usage = object$1(value, "token usage");
		const totalInput = finiteInteger(usage.inputTokens, "usage.inputTokens");
		const cacheRead = finiteInteger(usage.cachedInputTokens ?? 0, "usage.cachedInputTokens");
		const cacheWrite = finiteInteger(usage.cacheWriteInputTokens ?? 0, "usage.cacheWriteInputTokens");
		if (cacheRead + cacheWrite > totalInput) throw new LlmError("Codex cached input exceeds total input usage", "MALFORMED_RESPONSE");
		const decoded = {
			inputTokens: totalInput - cacheRead - cacheWrite,
			outputTokens: finiteInteger(usage.outputTokens, "usage.outputTokens"),
			cacheReadTokens: cacheRead,
			cacheWriteTokens: cacheWrite,
			reasoningTokens: finiteInteger(usage.reasoningOutputTokens ?? 0, "usage.reasoningOutputTokens")
		};
		if (!raw) return;
		if (!this.contextCompacting) this.currentContextUsage = {
			inputTokens: totalInput,
			outputTokens: decoded.outputTokens
		};
		this.rawUsageSeen = true;
		for (const [field, label] of USAGE_FIELDS) this.accumulatedUsage[field] = checkedAdd(this.accumulatedUsage[field], decoded[field], label);
	}
	/** Translate one decoded event to zero or more immediately publishable chunks. */
	accept(event) {
		if (event.kind === "thread-started") return this.action(event.threadId, "thread/start", "lifecycle", "completed", "thread/start", {
			threadId: event.threadId,
			userAgent: event.userAgent,
			instructionSources: event.instructionSources,
			ownership: "layered",
			codexOwnedPromptAndTools: true
		});
		if (event.kind === "server-request") {
			if (event.method === "item/tool/call" && event.params.namespace === "deepseek_harness") return [];
			const actionId = typeof event.params.itemId === "string" ? event.params.itemId : String(event.id);
			return this.action(actionId, event.method, "action", event.resolution === "answered" ? "completed" : "declined", event.method, {
				params: event.params,
				resolution: event.resolution
			});
		}
		const { method, params } = event;
		if (method === "thread/compacted") {
			this.nativeCompactionSeen = true;
			this.currentContextUsage = null;
		}
		if (method === "rawResponseItem/completed") return this.rawItemAction(params);
		if (method === "rawResponse/completed") {
			this.addUsage(params.usage, true);
			this.resetBaseline();
			return [];
		}
		if (method === "thread/tokenUsage/updated") {
			const tokenUsage = object$1(params.tokenUsage, "thread token usage");
			this.addUsage(tokenUsage.last, false);
			return [];
		}
		if (method === "item/agentMessage/delta") {
			if (typeof params.itemId !== "string" || typeof params.delta !== "string") throw new LlmError("Codex App Server returned an invalid agent message delta", "MALFORMED_RESPONSE");
			return this.delta(`message:${params.itemId}`, "text", params.delta);
		}
		if (method === "item/reasoning/summaryTextDelta" || method === "item/reasoning/textDelta") {
			if (typeof params.itemId !== "string" || typeof params.delta !== "string") throw new LlmError("Codex App Server returned an invalid reasoning delta", "MALFORMED_RESPONSE");
			const part = method === "item/reasoning/summaryTextDelta" ? `summary:${finiteInteger(params.summaryIndex, "reasoning summary index")}` : `content:${finiteInteger(params.contentIndex, "reasoning content index")}`;
			return this.delta(`reasoning:${params.itemId}:${part}`, "reasoning", params.delta);
		}
		if (method === "item/started" || method === "item/completed") {
			const current = item(params.item, `${method} item`);
			if (current.type === "contextCompaction") {
				this.contextCompacting = method === "item/started";
				this.currentContextUsage = null;
			}
			if (current.type === "agentMessage") {
				if (method === "item/started") return [];
				if (typeof current.text !== "string") throw new LlmError("Codex App Server returned an invalid completed agent message", "MALFORMED_RESPONSE");
				const closed = this.close(`message:${current.id}`, current.text);
				return closed.length > 0 || current.text.length === 0 ? closed : this.atomicBlock({
					type: "text",
					text: current.text
				});
			}
			if (current.type === "reasoning") {
				if (method === "item/started") return [];
				const prefix = `reasoning:${current.id}:`;
				const keys = [...this.open.keys()].filter((key) => key.startsWith(prefix));
				if (keys.length > 0) return keys.flatMap((key) => this.close(key));
				const summary = stringArray(current.summary, "completed reasoning summary");
				const content = stringArray(current.content, "completed reasoning content");
				return [...summary, ...content].flatMap((text) => this.atomicBlock({
					type: "reasoning",
					text
				}));
			}
			if (current.type === "dynamicToolCall" || current.type === "userMessage") return [];
			return this.action(current.id, current.type, "action", method === "item/started" ? "started" : terminalActionPhase(current.status, "completed"), method, current);
		}
		if (method.startsWith("item/") || method.startsWith("command/") || method.startsWith("process/") || ACTION_NOTIFICATION_METHODS.has(method) || DIAGNOSTIC_NOTIFICATION_METHODS.has(method)) {
			const actionId = typeof params.itemId === "string" ? params.itemId : typeof params.turnId === "string" ? params.turnId : method;
			return this.action(actionId, method, DIAGNOSTIC_NOTIFICATION_METHODS.has(method) ? "diagnostic" : "action", "updated", method, params);
		}
		return [];
	}
	/** Close any delta block left open at a terminal protocol event. */
	closeOpen() {
		return [...this.open.keys()].flatMap((key) => this.close(key));
	}
	/** Emit one durable Harness image attachment produced by a Codex-native action. */
	image(attachment) {
		return this.atomicBlock({
			type: "image",
			attachment
		});
	}
	/** Emit one Harness-owned tool request and retain an injectable raw call item. */
	toolCall(call) {
		if (!this.rawItems.some((candidate) => {
			return candidate !== null && typeof candidate === "object" && !Array.isArray(candidate) && candidate.type === "function_call" && candidate.call_id === String(call.id) && candidate.namespace === "deepseek_harness";
		})) this.rawItems.push({
			type: "function_call",
			call_id: String(call.id),
			namespace: HARNESS_TOOL_NAMESPACE,
			name: appServerToolName(call.name),
			arguments: call.arguments
		});
		const index = this.nextIndex++;
		return [
			{
				type: "block-start",
				index,
				blockType: "tool-call"
			},
			{
				type: "tool-call-delta",
				index,
				id: call.id,
				name: call.name,
				argumentsDelta: call.arguments
			},
			{
				type: "block-end",
				index,
				block: {
					type: "tool-call",
					...call
				}
			}
		];
	}
	/** Return disjoint accounting for raw responses observed in this Harness step. */
	usage() {
		if (!this.rawUsageSeen) return void 0;
		const source = this.accumulatedUsage;
		return {
			inputTokens: source.inputTokens,
			outputTokens: source.outputTokens,
			...source.cacheReadTokens === 0 ? {} : { cacheReadTokens: source.cacheReadTokens },
			...source.cacheWriteTokens === 0 ? {} : { cacheWriteTokens: source.cacheWriteTokens },
			...source.reasoningTokens === 0 ? {} : { reasoningTokens: source.reasoningTokens },
			contextUsage: this.currentContextUsage === null ? null : { ...this.currentContextUsage }
		};
	}
	/** Whether the live thread still has only reconstructible Harness-owned history. */
	canReuseThread() {
		return !this.nativeCompactionSeen;
	}
	/** Snapshot raw provider items so the next Harness request can inject them. */
	replayState() {
		return {
			kind: REPLAY_KIND,
			version: REPLAY_VERSION,
			items: replayableItems(this.rawItems),
			contextItems: [...this.contextItems]
		};
	}
};
/** Classify a Codex diagnostic into Harness's stable LLM failure taxonomy. */
function codexFailureCode(message) {
	if (/\b(?:selected|requested)?\s*model\b.*\bat capacity\b/is.test(message)) return CODEX_MODEL_CAPACITY_CODE;
	if (/context(?:\s|_|-)*(?:window|length).*(?:exceed|overflow)|too (?:long|large).*context/is.test(message)) return CONTEXT_WINDOW_EXCEEDED_CODE;
	if (/unauthori[sz]ed|authentication|not logged in|login required|invalid.*token|status\D*40[13]/i.test(message)) return "AUTH";
	if (/insufficient.*(?:quota|balance|credit)|(?:quota|usage limit).*(?:exceed|exhaust|reached)|out of (?:credit|budget)/i.test(message)) return QUOTA_EXCEEDED_CODE;
	if (/rate.?limit|too many requests|usage limit|status\D*429/i.test(message)) return "RATE_LIMIT";
	if (/status\D*5\d\d|server error|service unavailable/i.test(message)) return "SERVER";
	if (/timed? out|timeout/i.test(message)) return "TIMEOUT";
	if (/connection (?:reset|refused|closed)|network error|stream (?:disconnected|closed)/i.test(message)) return "TRANSPORT";
	return "CODEX_PROCESS";
}
/** Read the terminal turn status and raise only for an actual model/transport failure. */
function assertCompletedTurn(event) {
	if (event.kind !== "notification" || event.method !== "turn/completed") throw new LlmError("Expected Codex turn completion", "MALFORMED_RESPONSE");
	const turn = object$1(event.params.turn, "turn/completed turn");
	if (turn.status === "completed") return;
	const details = turn.error === null || turn.error === void 0 ? void 0 : object$1(turn.error, "turn error");
	const error = details === void 0 ? `Codex turn ended with status ${String(turn.status)}` : typeof details.message === "string" ? details.message : JSON.stringify(turn.error);
	const code = turn.status === "interrupted" ? "ABORTED" : details?.codexErrorInfo === "contextWindowExceeded" ? CONTEXT_WINDOW_EXCEEDED_CODE : codexFailureCode(error);
	throw new LlmError(error, code, code === "MODEL_CAPACITY" ? { providerRetryAfterMs: CODEX_MODEL_CAPACITY_RETRY_AFTER_MS } : void 0);
}
//#endregion
//#region src/process-connection.ts
/** Process exit evidence shared by model and account stdio connections. */
/** Keep diagnostics useful without echoing common credentials into chat errors. */
function diagnosticText(value) {
	return value.replace(/\x1b\[[0-9;]*[A-Za-z]/gu, "").replace(/Bearer\s+[^\s"'<>]+/giu, "Bearer [redacted]").replace(/\bsk-[A-Za-z0-9_-]+/gu, "[redacted-key]").replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/gu, "[redacted-token]").replace(/((?:access_token|refresh_token|id_token|api[_-]?key|authorization|password)["']?\s*[:=]\s*["']?)[^\s,"'}&]+/giu, "$1[redacted]").replace(/(https?:\/\/[^\s?#]+)\?[^\s]*/giu, "$1?[redacted-query]").replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu, "[redacted-email]").trim().slice(-2e3);
}
/** No new process or polling: observe the handle the DSH host already owns. */
function connectCodexProcess(child, maxLineBytes) {
	if (!child.stdin || !child.stdout) throw new LlmError("Codex App Server subprocess did not expose protocol pipes", "TRANSPORT");
	const rpc = new JsonRpcConnection(child.stdin, child.stdout, maxLineBytes);
	let outcome;
	let launchFailure;
	let cleanupRequested = false;
	let exitDuringCleanup = false;
	child.done.then((result) => {
		outcome = result;
		exitDuringCleanup = cleanupRequested;
		rpc.fail(new LlmError("Codex App Server process exited", "TRANSPORT"));
	}, (error) => {
		launchFailure = diagnosticText(error instanceof Error ? error.message : String(error));
		rpc.fail(new LlmError("Codex App Server process failed to start", "TRANSPORT", { cause: error }));
	});
	return {
		rpc,
		markCleanup() {
			cleanupRequested = true;
		},
		/** Called AFTER cleanup so stdout EOF cannot hide the later exit evidence. */
		failure(value) {
			const error = value instanceof Error ? value : new Error(String(value));
			if (error instanceof LlmError && error.code !== "TRANSPORT") return error;
			const exit = outcome === void 0 ? "exit status not reported" : `exit=${String(outcome.exitCode)}, signal=${String(outcome.signal)}${exitDuringCleanup ? " (observed during cleanup)" : ""}`;
			let stderr = "";
			try {
				stderr = diagnosticText(child.collected?.stderr?.readFrom(0).text ?? "");
			} catch {}
			const details = [
				exit,
				...launchFailure ? [`launch: ${launchFailure}`] : [],
				stderr ? `stderr: ${stderr}` : "no stderr reported"
			].join("; ");
			return new LlmError(`${error.message} [local Codex process; ${details}]`, "TRANSPORT", { cause: error });
		}
	};
}
//#endregion
//#region src/thread.ts
/** Serialized turn state for one open Codex App Server thread. */
const TIMEOUT_REASON$1 = Symbol("codex-app-server-turn-timeout");
function thrown$1(value) {
	return value instanceof Error ? value : new Error(String(value));
}
/** Normalize one operation failure without losing timeout or caller cancellation. */
function operationFailure(error, timedOut, caller) {
	if (timedOut) return new LlmError("Codex App Server request timed out", "TIMEOUT", { cause: error });
	if (caller?.aborted) return new LlmError("Codex App Server request aborted by caller", "ABORTED", { cause: error });
	return error instanceof LlmError ? error : new LlmError("Codex App Server request failed", "TRANSPORT", { cause: thrown$1(error) });
}
/** Validate the configurable fields sent at a turn boundary. */
function validateTurnRequest(request) {
	if (request.reasoningEffort !== void 0 && !SAFE_REASONING_EFFORT.test(request.reasoningEffort)) throw new LlmError(`Codex reasoning effort is not a safe identifier: ${JSON.stringify(request.reasoningEffort)}`, "UNSUPPORTED_REASONING_EFFORT");
	for (const [groupIndex, group] of (request.steeringInputs ?? []).entries()) {
		if (group.length === 0) throw new LlmError(`Codex steeringInputs[${String(groupIndex)}] is empty`, "INVALID_CONTINUATION");
		group.forEach((value, index) => {
			jsonValue(value, `steeringInputs[${String(groupIndex)}][${String(index)}]`);
		});
	}
	if (request.toolResult === void 0) return;
	if (request.toolResult.callId.length === 0 || request.toolResult.contentItems.length === 0) throw new LlmError("Codex tool result is incomplete", "INVALID_CONTINUATION");
	for (const [index, value] of request.toolResult.contentItems.entries()) {
		const item = object$1(value, `toolResult.contentItems[${index}]`);
		const validText = item.type === "inputText" && typeof item.text === "string";
		const validImage = item.type === "inputImage" && typeof item.imageUrl === "string" && /^data:image\/(?:png|jpeg|webp|gif);base64,/u.test(item.imageUrl);
		if (!validText && !validImage) throw new LlmError(`Codex tool result contains invalid contentItems[${index}]`, "INVALID_CONTINUATION");
	}
}
function combinedFailure(primary, cleanup) {
	const failure = thrown$1(cleanup);
	return new LlmError(`${primary.message}; cleanup also failed: ${failure.message}`, primary.code, { cause: new AggregateError([primary, failure], "Codex App Server request and cleanup failed") });
}
function threadId$1(value, label) {
	const candidate = object$1(value, label);
	if (typeof candidate.id !== "string" || candidate.id.length === 0) throw new LlmError(`Codex App Server returned invalid ${label}.id`, "MALFORMED_RESPONSE");
	return candidate.id;
}
async function resolveServerRequest(connection, event) {
	switch (event.method) {
		case "item/commandExecution/requestApproval":
		case "item/fileChange/requestApproval":
			await connection.respond(event.id, { decision: "decline" });
			return {
				...event,
				resolution: "declined"
			};
		case "applyPatchApproval":
		case "execCommandApproval":
			await connection.respond(event.id, { decision: { denied: { rejection: "Harness did not approve this Codex action." } } });
			return {
				...event,
				resolution: "declined"
			};
		case "item/tool/requestUserInput":
			await connection.respond(event.id, { answers: {} });
			return {
				...event,
				resolution: "declined"
			};
		case "mcpServer/elicitation/request":
			await connection.respond(event.id, {
				action: "cancel",
				content: null,
				_meta: null
			});
			return {
				...event,
				resolution: "declined"
			};
		case "currentTime/read":
			await connection.respond(event.id, { currentTimeAt: Math.floor(Date.now() / 1e3) });
			return {
				...event,
				resolution: "answered"
			};
		default:
			await connection.respondError(event.id, -32001, `DeepSeek Harness cannot answer ${event.method}`);
			return {
				...event,
				resolution: "rejected"
			};
	}
}
/** Process-owned App Server thread with one serialized turn consumer. */
var ManagedCodexThread = class {
	options;
	state = { kind: "idle" };
	active = false;
	announced = false;
	constructor(options) {
		this.options = options;
	}
	get threadId() {
		return this.options.threadId;
	}
	get closed() {
		return this.state.kind === "disposed" || this.options.connection.closed;
	}
	async *stream(request) {
		validateTurnRequest(request);
		if (this.active) throw new LlmError("Codex App Server thread already has an active consumer", "INVALID_CONTINUATION");
		if (this.state.kind === "disposed") throw new LlmError("Codex App Server thread is disposed", "INVALID_CONTINUATION");
		this.active = true;
		let retained = false;
		let primary;
		let timedOut = false;
		const timeout = this.options.timeoutMs > 0 ? setTimeout(() => {
			timedOut = true;
			const failure = operationFailure(TIMEOUT_REASON$1, true, request.signal);
			this.options.connection.fail(failure);
			this.options.abort(TIMEOUT_REASON$1);
		}, this.options.timeoutMs) : void 0;
		const onAbort = () => {
			const failure = operationFailure(request.signal?.reason, false, request.signal);
			this.options.connection.fail(failure);
			this.options.abort(request.signal?.reason);
		};
		request.signal?.addEventListener("abort", onAbort, { once: true });
		try {
			if (request.signal?.aborted) throw request.signal.reason;
			if (!this.announced) {
				this.announced = true;
				yield this.options.startedEvent;
			}
			await this.beginOrResume(request);
			if (this.state.kind !== "running") throw new LlmError("Codex App Server thread did not enter a running turn", "INVALID_CONTINUATION");
			const turnId = this.state.turnId;
			while (true) {
				const next = await this.options.connection.next();
				if (next.done) throw new LlmError("Codex App Server event stream ended before the turn", "TRANSPORT");
				const event = next.value;
				if (event.kind === "server-request") {
					if (event.method === "item/tool/call" && event.params.namespace === "deepseek_harness") {
						this.assertToolRequest(event, turnId);
						this.state = {
							kind: "tool",
							turnId,
							request: event
						};
						retained = true;
						yield event;
						return;
					}
					yield await resolveServerRequest(this.options.connection, event);
					continue;
				}
				if (event.kind === "notification" && event.method === "turn/completed") {
					if (object$1(event.params.turn, "turn/completed turn").id === turnId) {
						this.state = { kind: "idle" };
						retained = true;
						yield event;
						return;
					}
				}
				yield event;
			}
		} catch (error) {
			primary = operationFailure(error, timedOut, request.signal);
		} finally {
			if (timeout !== void 0) clearTimeout(timeout);
			request.signal?.removeEventListener("abort", onAbort);
			this.active = false;
			if (!retained) try {
				await this.dispose();
			} catch (error) {
				if (primary === void 0) throw error;
				primary = combinedFailure(primary, error);
			}
		}
		if (primary !== void 0) throw this.options.failure?.(primary) ?? primary;
	}
	async beginOrResume(request) {
		if (this.state.kind === "idle") {
			if (request.toolResult !== void 0) throw new LlmError("an idle Codex thread cannot accept a tool result", "INVALID_CONTINUATION");
			const injectedItems = (request.injectedItems ?? []).map((item, index) => jsonValue(item, `injectedItems[${index}]`));
			const input = (request.input ?? []).map((item, index) => jsonValue(item, `input[${index}]`));
			if (injectedItems.length > 0) await this.options.connection.request("thread/inject_items", {
				threadId: this.threadId,
				items: injectedItems
			});
			const turnId = threadId$1(object$1(await this.options.connection.request("turn/start", {
				threadId: this.threadId,
				input,
				...request.reasoningEffort === void 0 ? {} : { effort: request.reasoningEffort }
			}), "turn/start result").turn, "turn/start turn");
			this.state = {
				kind: "running",
				turnId
			};
			await this.steer(turnId, request.steeringInputs);
			return;
		}
		if (this.state.kind !== "tool") throw new LlmError("Codex App Server thread is not ready for another step", "INVALID_CONTINUATION");
		if ((request.injectedItems?.length ?? 0) > 0 || (request.input?.length ?? 0) > 0) throw new LlmError("a pending Codex tool callback cannot also inject turn input", "INVALID_CONTINUATION");
		const result = request.toolResult;
		const callId = this.state.request.params.callId;
		if (result === void 0 || typeof callId !== "string" || callId !== result.callId) throw new LlmError("Codex tool result does not match the pending callback", "INVALID_CONTINUATION");
		await this.options.connection.respond(this.state.request.id, {
			contentItems: result.contentItems.map((item, index) => jsonValue(item, `toolResult.contentItems[${index}]`)),
			success: result.success
		});
		const turnId = this.state.turnId;
		this.state = {
			kind: "running",
			turnId
		};
		await this.steer(turnId, request.steeringInputs);
	}
	async steer(turnId, groups) {
		for (const [groupIndex, group] of (groups ?? []).entries()) await this.options.connection.request("turn/steer", {
			threadId: this.threadId,
			expectedTurnId: turnId,
			input: group.map((value, index) => jsonValue(value, `steeringInputs[${String(groupIndex)}][${String(index)}]`))
		});
	}
	assertToolRequest(event, turnId) {
		if (event.params.turnId !== turnId || typeof event.params.callId !== "string" || event.params.callId.length === 0) throw new LlmError("Codex App Server returned an invalid dynamic-tool callback", "MALFORMED_RESPONSE");
	}
	dispose() {
		this.state = { kind: "disposed" };
		return this.options.dispose();
	}
};
//#endregion
//#region src/runner.ts
/** Disposable App Server process and thread lifecycle. */
const CODEX_APP_SERVER_VERSION = "0.154.0";
const WORKDIR_PREFIX = "dsh-codex-app-server-";
const TIMEOUT_REASON = Symbol("codex-app-server-timeout");
const CONSUMER_REASON = Symbol("codex-app-server-consumer-stop");
/** Resolve the pinned official CLI's JavaScript entry without a shell lookup. */
function codexCliEntry() {
	return join(dirname(createRequire(import.meta.url).resolve("@openai/codex/package.json")), "bin", "codex.js");
}
/** Let the official Codex configuration select its own features and permissions.
* Only explicitly requested per-operation capabilities override the user policy.
*/
function codexAppServerArgv(webSearch, imageGenerationEnabled = true) {
	return [
		process.execPath,
		codexCliEntry(),
		"app-server",
		"--stdio",
		...webSearch === void 0 ? [] : ["-c", `web_search="${webSearch}"`],
		...imageGenerationEnabled ? [] : ["--disable", "image_generation"]
	];
}
async function privateWorkdir() {
	const path = await mkdtemp(join(tmpdir(), WORKDIR_PREFIX));
	try {
		await chmod(path, 448);
		return path;
	} catch (error) {
		try {
			await rm(path, {
				recursive: true,
				force: true
			});
		} catch (cleanup) {
			throw new AggregateError([error, cleanup], "Codex App Server private directory setup and cleanup failed");
		}
		throw error;
	}
}
async function removePrivateWorkdir(path) {
	const base = resolve(tmpdir());
	if (resolve(dirname(path)) !== base || !path.slice(base.length + 1).startsWith(WORKDIR_PREFIX)) throw new Error("refusing to remove an unexpected Codex App Server directory");
	await rm(path, {
		recursive: true,
		force: true
	});
}
function thrown(value) {
	return value instanceof Error ? value : new Error(String(value));
}
async function cleanupRun(child, connection, workdir, graceMs) {
	const failures = [];
	connection?.dispose();
	if (child !== void 0) {
		try {
			child.stdin?.end();
			child.terminate();
		} catch (error) {
			failures.push(thrown(error));
		}
		try {
			const waitMs = Math.min(2147483647, Math.max(1, graceMs * 2));
			if (!await child.waitForExit(AbortSignal.timeout(waitMs))) failures.push(/* @__PURE__ */ new Error("Codex App Server process tree did not reach quiescence"));
		} catch (error) {
			failures.push(thrown(error));
		}
	}
	try {
		await removePrivateWorkdir(workdir);
	} catch (error) {
		failures.push(thrown(error));
	}
	return failures;
}
function cleanupError(primary, failures) {
	if (failures.length === 0) return primary;
	const detail = failures.map((failure) => failure.message).join("; ");
	if (primary === void 0) return new LlmError(`Codex App Server cleanup failed: ${detail}`, "TRANSPORT", { cause: new AggregateError(failures, "Codex App Server cleanup failed") });
	return new LlmError(`${primary.message}; cleanup also failed: ${detail}`, primary.code, { cause: new AggregateError([primary, ...failures], "Codex App Server request and cleanup failed") });
}
function validateThreadRequest(request) {
	if (!SAFE_MODEL_ID.test(request.model)) throw new LlmError(`Codex model is not a safe identifier: ${JSON.stringify(request.model)}`, "INVALID_MODEL");
	if (!SAFE_MODEL_ID.test(request.modelProvider)) throw new LlmError(`Codex model provider is not a safe identifier: ${JSON.stringify(request.modelProvider)}`, "INVALID_PROVIDER");
}
function validateRequest(request) {
	validateThreadRequest(request);
	validateTurnRequest(request);
}
function threadId(value, label) {
	const candidate = object$1(value, label);
	if (typeof candidate.id !== "string" || candidate.id.length === 0) throw new LlmError(`Codex App Server returned invalid ${label}.id`, "MALFORMED_RESPONSE");
	return candidate.id;
}
function instructionSources(value) {
	if (value === void 0) return [];
	if (!Array.isArray(value)) throw new LlmError("Codex App Server returned invalid instructionSources", "MALFORMED_RESPONSE");
	return value.map((source, index) => jsonValue(source, `instructionSources[${index}]`));
}
/** App Server process factory; open threads remain alive until their owner disposes them. */
var CodexAppServerRunner = class {
	options;
	constructor(options) {
		this.options = options;
	}
	async open(request) {
		validateThreadRequest(request);
		let workdir;
		try {
			workdir = await privateWorkdir();
		} catch (error) {
			throw new LlmError("Codex App Server private directory setup failed", "TRANSPORT", { cause: thrown(error) });
		}
		const lifetime = new AbortController();
		let timedOut = false;
		const timeout = this.options.timeoutMs > 0 ? setTimeout(() => {
			timedOut = true;
			connection?.fail(operationFailure(TIMEOUT_REASON, true, request.signal));
			if (!lifetime.signal.aborted) lifetime.abort(TIMEOUT_REASON);
		}, this.options.timeoutMs) : void 0;
		let child;
		let connection;
		let processConnection;
		const onAbort = () => {
			connection?.fail(operationFailure(request.signal?.reason, false, request.signal));
			if (!lifetime.signal.aborted) lifetime.abort(request.signal?.reason);
		};
		request.signal?.addEventListener("abort", onAbort, { once: true });
		try {
			if (request.signal?.aborted) throw request.signal.reason;
			child = this.options.spawn({
				argv: codexAppServerArgv(request.webSearch, request.imageGenerationEnabled),
				cwd: workdir,
				stdio: {
					stdin: "pipe",
					stdout: "pipe",
					stderr: { maxBytes: this.options.maxStderrBytes }
				},
				graceMs: this.options.disposeGraceMs,
				signal: lifetime.signal,
				env: { ...this.options.env }
			});
			if (child.stdin === void 0 || child.stdout === void 0) throw new LlmError("Codex App Server subprocess did not expose protocol pipes", "TRANSPORT");
			processConnection = connectCodexProcess(child, this.options.maxJsonRpcLineBytes);
			connection = processConnection.rpc;
			const activeConnection = connection;
			const diagnostics = processConnection;
			const initialized = object$1(await activeConnection.request("initialize", {
				clientInfo: {
					name: "deepseek-harness",
					title: "DeepSeek Harness",
					version: "0.1.19"
				},
				capabilities: {
					experimentalApi: true,
					requestAttestation: false
				}
			}), "initialize result");
			await activeConnection.notify("initialized", {});
			const started = object$1(await activeConnection.request("thread/start", {
				model: request.model,
				modelProvider: request.modelProvider,
				cwd: workdir,
				baseInstructions: request.system,
				developerInstructions: "",
				personality: "none",
				multiAgentMode: null,
				ephemeral: true,
				historyMode: "legacy",
				environments: [],
				runtimeWorkspaceRoots: [],
				selectedCapabilityRoots: [],
				dynamicTools: request.dynamicTools,
				experimentalRawEvents: true,
				serviceName: "deepseek-harness"
			}), "thread/start result");
			const id = threadId(started.thread, "thread/start thread");
			let disposeTask;
			const dispose = () => {
				if (disposeTask !== void 0) return disposeTask;
				diagnostics.markCleanup();
				if (!lifetime.signal.aborted) lifetime.abort(CONSUMER_REASON);
				disposeTask = (async () => {
					const failure = cleanupError(void 0, await cleanupRun(child, activeConnection, workdir, this.options.disposeGraceMs));
					if (failure !== void 0) throw failure;
				})();
				return disposeTask;
			};
			return new ManagedCodexThread({
				timeoutMs: this.options.timeoutMs,
				connection: activeConnection,
				threadId: id,
				abort: (reason) => {
					if (!lifetime.signal.aborted) lifetime.abort(reason);
				},
				dispose,
				failure: (error) => diagnostics.failure(error),
				startedEvent: {
					kind: "thread-started",
					threadId: id,
					userAgent: typeof initialized.userAgent === "string" ? initialized.userAgent : "",
					instructionSources: instructionSources(started.instructionSources)
				}
			});
		} catch (error) {
			let failure = operationFailure(error, timedOut, request.signal);
			processConnection?.markCleanup();
			if (!lifetime.signal.aborted) lifetime.abort(CONSUMER_REASON);
			failure = cleanupError(failure, await cleanupRun(child, connection, workdir, this.options.disposeGraceMs));
			throw processConnection?.failure(failure) ?? failure;
		} finally {
			if (timeout !== void 0) clearTimeout(timeout);
			request.signal?.removeEventListener("abort", onAbort);
		}
	}
	async *stream(request) {
		validateRequest(request);
		const thread = await this.open(request);
		try {
			yield* thread.stream({
				...request.reasoningEffort === void 0 ? {} : { reasoningEffort: request.reasoningEffort },
				injectedItems: request.history,
				input: [],
				...request.signal === void 0 ? {} : { signal: request.signal }
			});
		} finally {
			await thread.dispose();
		}
	}
};
//#endregion
//#region src/session-cache.ts
/** Disposable App Server thread leases keyed by Harness session identity. */
const DISPOSE_REASON = Symbol("codex-session-cache-dispose");
function appendedItems(previous, current) {
	if (current.length <= previous.length) return void 0;
	if (!previous.every((item, index) => isDeepStrictEqual(item, current[index]))) return void 0;
	return current.slice(previous.length);
}
function durableUserInput(item) {
	if (item === void 0 || item === null || typeof item !== "object" || Array.isArray(item)) return void 0;
	if (item.type !== "message" || item.role !== "user" || "id" in item || !Array.isArray(item.content) || item.content.length === 0) return void 0;
	return item.content.every((content) => {
		if (content === null || typeof content !== "object" || Array.isArray(content)) return false;
		if (content.type === "input_text") return typeof content.text === "string";
		return content.type === "input_image" && content.image_url !== null && typeof content.image_url === "object" && !Array.isArray(content.image_url);
	}) ? [...item.content] : void 0;
}
function durableUserInputs(items) {
	const inputs = [];
	for (const item of items) {
		const input = durableUserInput(item);
		if (input === void 0) return void 0;
		inputs.push(input);
	}
	return inputs;
}
function matchingToolResult(item, callId, results) {
	if (item === void 0 || item === null || typeof item !== "object" || Array.isArray(item)) return void 0;
	if (item.type !== "function_call_output" || item.call_id !== callId) return void 0;
	return results.find((result) => result.callId === callId && isDeepStrictEqual(result.output, item.output));
}
function turnRequest(request, payload) {
	return {
		...request.reasoningEffort === void 0 ? {} : { reasoningEffort: request.reasoningEffort },
		...payload,
		...request.signal === void 0 ? {} : { signal: request.signal }
	};
}
async function coldTurn(request) {
	return turnRequest(request, {
		injectedItems: await request.loadInjectedHistory(),
		input: []
	});
}
async function hydrateUserInputs(request, inputs) {
	const hydrated = [];
	for (const input of inputs) hydrated.push([...await request.loadUserInput(input)]);
	return hydrated;
}
var SessionStep = class {
	settle;
	retire;
	settled = false;
	events;
	constructor(thread, request, settle, retire) {
		this.settle = settle;
		this.retire = retire;
		this.events = thread.stream(request);
	}
	commit(history, pendingCallId) {
		if (this.settled) throw new Error("Codex session step was already settled");
		this.settle(history, pendingCallId);
		this.settled = true;
	}
	async discard() {
		if (this.settled) return;
		this.settled = true;
		await this.retire();
	}
};
var SessionLease = class {
	sessionId;
	epoch;
	idleTimeoutMs;
	touch;
	onIdle;
	onSettled;
	retire;
	state = { kind: "active" };
	lifetime = new AbortController();
	threadTask;
	thread;
	disposeTask;
	idleTimer;
	lastUsed = 0;
	constructor(sessionId, epoch, request, runner, idleTimeoutMs, touch, onIdle, onSettled, retire) {
		this.sessionId = sessionId;
		this.epoch = epoch;
		this.idleTimeoutMs = idleTimeoutMs;
		this.touch = touch;
		this.onIdle = onIdle;
		this.onSettled = onSettled;
		this.retire = retire;
		const signal = request.signal === void 0 ? this.lifetime.signal : AbortSignal.any([this.lifetime.signal, request.signal]);
		this.threadTask = runner.open({
			...request.thread,
			signal
		}).then((thread) => {
			this.thread = thread;
			return thread;
		});
	}
	get active() {
		return this.state.kind === "active";
	}
	get evictable() {
		return this.state.kind === "idle" || this.state.kind === "tool";
	}
	async coldStep(request) {
		const thread = await this.threadTask;
		if (this.state.kind !== "active") throw new LlmError("Codex session lease was disposed while opening", "ABORTED");
		return this.step(thread, await coldTurn(request));
	}
	async tryResume(request) {
		if (this.state.kind === "active") throw new LlmError("Codex session already has an active model step", "INVALID_CONTINUATION");
		if (this.state.kind === "disposed" || this.thread?.closed === true) return void 0;
		const previous = this.state;
		const suffix = appendedItems(previous.history, request.history);
		if (suffix === void 0) return void 0;
		if (previous.kind === "idle") {
			const contents = durableUserInputs(suffix);
			if (contents === void 0) return void 0;
			this.clearIdleTimer();
			this.state = { kind: "active" };
			const [input, ...steeringInputs] = await hydrateUserInputs(request, contents);
			return this.step(await this.threadTask, turnRequest(request, {
				input,
				...steeringInputs.length === 0 ? {} : { steeringInputs }
			}));
		}
		const [resultItem, ...following] = suffix;
		const toolResult = matchingToolResult(resultItem, previous.callId, request.toolResults);
		if (toolResult === void 0) return void 0;
		const contents = durableUserInputs(following);
		if (contents === void 0) return void 0;
		this.clearIdleTimer();
		this.state = { kind: "active" };
		const hydrated = await request.loadToolResult(toolResult);
		const steeringInputs = await hydrateUserInputs(request, contents);
		return this.step(await this.threadTask, turnRequest(request, {
			toolResult: hydrated,
			...steeringInputs.length === 0 ? {} : { steeringInputs }
		}));
	}
	step(thread, request) {
		return new SessionStep(thread, request, (history, pendingCallId) => {
			this.commit(history, pendingCallId);
		}, () => this.retire(this));
	}
	commit(history, pendingCallId) {
		if (this.state.kind !== "active") throw new Error("Codex session lease is not active");
		this.state = pendingCallId === void 0 ? {
			kind: "idle",
			history: [...history]
		} : {
			kind: "tool",
			history: [...history],
			callId: pendingCallId
		};
		this.lastUsed = this.touch();
		this.idleTimer = setTimeout(() => {
			this.onIdle(this);
		}, this.idleTimeoutMs);
		this.onSettled();
	}
	clearIdleTimer() {
		if (this.idleTimer === void 0) return;
		clearTimeout(this.idleTimer);
		this.idleTimer = void 0;
	}
	dispose() {
		if (this.disposeTask !== void 0) return this.disposeTask;
		this.state = { kind: "disposed" };
		this.clearIdleTimer();
		this.lifetime.abort(DISPOSE_REASON);
		this.disposeTask = this.threadTask.then((thread) => thread.dispose(), () => void 0);
		return this.disposeTask;
	}
};
/** Bounded in-memory cache of disposable App Server session threads. */
var CodexSessionCache = class {
	options;
	leases = /* @__PURE__ */ new Map();
	clock = 0;
	disposed = false;
	constructor(options) {
		this.options = options;
	}
	/** Open or exactly continue the thread lease for one Harness request. */
	async begin(request) {
		if (this.disposed) throw new LlmError("Codex session cache is disposed", "ABORTED");
		let lease = this.leases.get(request.sessionId);
		if (lease !== void 0) {
			if (lease.active) throw new LlmError("Codex session already has an active model step", "INVALID_CONTINUATION");
			if (isDeepStrictEqual(lease.epoch, request.epoch)) try {
				const resumed = await lease.tryResume(request);
				if (resumed !== void 0) return resumed;
			} catch (error) {
				await this.retire(lease);
				throw error;
			}
			await this.retire(lease);
			lease = void 0;
		}
		await this.trimToSize(this.options.maxSessions - 1);
		const created = new SessionLease(request.sessionId, request.epoch, request, this.options.runner, this.options.idleTimeoutMs, () => ++this.clock, (current) => {
			this.expire(current);
		}, () => {
			this.settled();
		}, (current) => this.retire(current));
		this.leases.set(request.sessionId, created);
		try {
			return await created.coldStep(request);
		} catch (error) {
			await this.retire(created);
			throw error;
		}
	}
	/** Dispose the lease owned by one ended Harness session, when present. */
	async disposeSession(sessionId) {
		const lease = this.leases.get(sessionId);
		if (lease !== void 0) await this.retire(lease);
	}
	/** Dispose every lease and reject future requests. */
	async dispose() {
		if (this.disposed) return;
		this.disposed = true;
		const leases = [...this.leases.values()];
		this.leases.clear();
		const failures = (await Promise.allSettled(leases.map((lease) => lease.dispose()))).flatMap((result) => result.status === "rejected" ? [result.reason] : []);
		if (failures.length > 0) throw new AggregateError(failures, "Codex session cache cleanup failed");
	}
	async retire(lease) {
		if (this.leases.get(lease.sessionId) === lease) this.leases.delete(lease.sessionId);
		await lease.dispose();
	}
	expire(lease) {
		if (this.leases.get(lease.sessionId) !== lease || !lease.evictable) return;
		this.retire(lease).catch(this.options.onCleanupError);
	}
	settled() {
		this.trimToSize(this.options.maxSessions).catch(this.options.onCleanupError);
	}
	async trimToSize(maxSize) {
		while (this.leases.size > maxSize) {
			const oldest = [...this.leases.values()].filter((lease) => lease.evictable).sort((left, right) => left.lastUsed - right.lastUsed)[0];
			if (oldest === void 0) return;
			await this.retire(oldest);
		}
	}
};
//#endregion
//#region src/adapter.ts
/** Harness LLM adapter backed by one ephemeral Codex App Server per request. */
const RETRYABLE_CODES = Object.freeze([
	CODEX_MODEL_CAPACITY_CODE,
	"RATE_LIMIT",
	"SERVER",
	"TIMEOUT",
	"TRANSPORT"
]);
function modelInfo(provider, model) {
	return {
		provider,
		id: model.id,
		name: model.name,
		...model.description === void 0 ? {} : { description: model.description },
		inputModalities: [...model.inputModalities]
	};
}
/** Main-model adapter that maps live App Server events into the Harness loop. */
var CodexAppServerAdapter = class extends LlmAdapter {
	options;
	cache;
	constructor(options) {
		super();
		this.options = options;
		this.cache = new CodexSessionCache({
			runner: options.runner,
			maxSessions: options.maxCachedSessions,
			idleTimeoutMs: options.sessionIdleTimeoutMs,
			onCleanupError: options.onCleanupError
		});
	}
	providerInfo(provider) {
		return {
			id: provider,
			name: this.options.displayName
		};
	}
	providerRetryPolicy(_provider) {
		return {
			mode: "normal",
			maxRetries: this.options.maxRetries,
			retryableCodes: RETRYABLE_CODES,
			initialDelayMs: 1e3,
			maxDelayMs: CODEX_MODEL_CAPACITY_RETRY_AFTER_MS,
			jitterRatio: .1
		};
	}
	listModels(provider) {
		return Promise.resolve(this.options.models.map((model) => modelInfo(provider, model)));
	}
	resolveModel(provider, model, _signal) {
		const resolved = this.options.models.find((candidate) => candidate.id === model) ?? {
			id: model,
			name: model,
			inputModalities: ["text"],
			reasoningEfforts: []
		};
		return Promise.resolve({
			...modelInfo(provider, resolved),
			pressureCompaction: "provider",
			...resolved.contextWindow === void 0 ? {} : { context: { contextWindow: resolved.contextWindow } },
			...resolved.reasoningEfforts.length === 0 ? {} : { reasoning: {
				efforts: resolved.reasoningEfforts.map((effort) => ({
					id: ReasoningEffortId(effort),
					name: effort.charAt(0).toUpperCase() + effort.slice(1)
				})),
				...resolved.defaultReasoningEffort === void 0 ? {} : { defaultEffort: ReasoningEffortId(resolved.defaultReasoningEffort) }
			} }
		});
	}
	async *stream(options) {
		const compaction = options.purpose === "compaction";
		const imageGenerationEnabled = !compaction && (this.options.resolveImageGenerationEnabled?.() ?? true);
		if (options.temperature !== void 0 || options.maxTokens !== void 0 && !compaction || options.stop !== void 0) throw new LlmError("Codex App Server provider does not support temperature, maxTokens, or stop overrides", "UNSUPPORTED_OPTION");
		const hasImages = options.messages.some((message) => contentHasImage(message.content));
		const configuredModel = this.options.models.find((model) => model.id === options.model);
		if (hasImages && configuredModel?.inputModalities.includes("image") !== true) throw new LlmError(`Codex model "${options.model}" does not accept image input`, "UNSUPPORTED_CONTENT");
		const history = boundRequestImageHistory(appServerHistory(options), this.options.maxRequestImageBytes);
		const images = new NativeImageBridge(this.options.resolveAttachments);
		images.rememberHistory(history);
		const dynamicTools = compaction ? [] : appServerDynamicTools(options.tools, options.messages);
		const mapper = new AppServerEventMapper(history, options.tools?.map((tool) => tool.name));
		const reasoningEffort = options.reasoningEffort === void 0 ? void 0 : String(options.reasoningEffort);
		let cached;
		let events;
		if (options.sessionId === void 0 || options.purpose !== void 0) {
			const injectedHistory = await images.hydrateHistory(history, options.signal);
			events = this.options.runner.stream({
				model: options.model,
				modelProvider: this.options.modelProvider,
				...reasoningEffort === void 0 ? {} : { reasoningEffort },
				system: options.system ?? "",
				history: injectedHistory,
				dynamicTools,
				imageGenerationEnabled,
				...options.signal === void 0 ? {} : { signal: options.signal }
			});
		} else {
			cached = await this.cache.begin({
				sessionId: String(options.sessionId),
				epoch: this.cacheEpoch(options, dynamicTools, imageGenerationEnabled),
				thread: {
					model: options.model,
					modelProvider: this.options.modelProvider,
					system: options.system ?? "",
					dynamicTools,
					imageGenerationEnabled
				},
				history,
				loadInjectedHistory: () => images.hydrateHistory(history, options.signal),
				loadUserInput: (content) => images.hydrateUserInput(content, options.signal),
				loadToolResult: (result) => images.hydrateToolResult(result, options.signal),
				...reasoningEffort === void 0 ? {} : { reasoningEffort },
				toolResults: appServerToolResults(options, history),
				...options.signal === void 0 ? {} : { signal: options.signal }
			});
			events = cached.events;
		}
		let retained = false;
		try {
			for await (const event of events) {
				const projected = await images.externalize(event);
				for (const chunk of mapper.accept(projected.event)) yield chunk;
				for (const image of projected.images) for (const chunk of mapper.image(image)) yield chunk;
				if (projected.event.kind === "server-request" && projected.event.method === "item/tool/call" && projected.event.params.namespace === "deepseek_harness") {
					for (const chunk of mapper.closeOpen()) yield chunk;
					const call = harnessToolCall(projected.event, options.tools, options.messages);
					for (const chunk of mapper.toolCall(call)) yield chunk;
					const usage = mapper.usage();
					if (usage !== void 0) yield {
						type: "usage",
						usage
					};
					const replayState = mapper.replayState();
					retained = await this.settleCache(cached, mapper, history, replayState.items, String(call.id));
					yield {
						type: "finish",
						reason: { kind: "tool-calls" },
						replayState: { response: replayState }
					};
					return;
				}
				if (projected.event.kind === "notification" && projected.event.method === "turn/completed") {
					for (const chunk of mapper.closeOpen()) yield chunk;
					assertCompletedTurn(projected.event);
					const usage = mapper.usage();
					if (usage !== void 0) yield {
						type: "usage",
						usage
					};
					const replayState = mapper.replayState();
					retained = await this.settleCache(cached, mapper, history, replayState.items);
					yield {
						type: "finish",
						reason: { kind: "stop" },
						replayState: { response: replayState }
					};
					return;
				}
			}
			throw new LlmError("Codex App Server stream ended without a terminal event", "TRANSPORT");
		} finally {
			if (!retained) await cached?.discard();
		}
	}
	/** Dispose the cached process for one ended Harness session. */
	disposeSession(sessionId) {
		return this.cache.disposeSession(sessionId);
	}
	/** Dispose every cached process owned by this adapter. */
	dispose() {
		return this.cache.dispose();
	}
	cacheEpoch(options, dynamicTools, imageGenerationEnabled) {
		return {
			version: 1,
			appServerVersion: CODEX_APP_SERVER_VERSION,
			provider: options.provider,
			modelProvider: this.options.modelProvider,
			model: options.model,
			reasoningEffort: options.reasoningEffort === void 0 ? null : String(options.reasoningEffort),
			system: options.system ?? "",
			dynamicTools: [...dynamicTools],
			imageGenerationEnabled,
			maxRequestImageBytes: this.options.maxRequestImageBytes,
			threadPolicy: "harness-read-only-no-native-compaction-image-input-v1"
		};
	}
	async settleCache(cached, mapper, history, outputs, pendingCallId) {
		if (cached === void 0) return false;
		if (!mapper.canReuseThread()) {
			await cached.discard();
			return false;
		}
		cached.commit(extendAppServerHistory(history, outputs), pendingCallId);
		return true;
	}
};
//#endregion
//#region src/presentation.ts
function object(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
/** Render meaningful native actions with standard DSH text, never an unsupported custom block. */
function actionText(value) {
	const action = object(value);
	if (action?.type !== "codex-action") return void 0;
	const snapshot = object(action.snapshot);
	const name = String(action.actionType ?? "");
	const phase = String(action.phase ?? "");
	if (action.category === "diagnostic") {
		if (![
			"error",
			"warning",
			"configWarning",
			"guardianWarning",
			"deprecationNotice"
		].includes(name)) return void 0;
		const detail = snapshot?.message ?? object(snapshot?.error)?.message;
		return typeof detail === "string" && detail.trim() ? `Codex: ${detail}\n\n` : void 0;
	}
	if (action.category !== "action") return void 0;
	if (![
		"completed",
		"failed",
		"declined",
		"rejected"
	].includes(phase)) return void 0;
	if (action.protocolEvent === "rawResponseItem/completed") return void 0;
	const label = {
		commandExecution: "Command",
		fileChange: "File changes",
		webSearch: "Web search",
		imageGeneration: "Image generation",
		mcpToolCall: "MCP tool",
		dynamicToolCall: "Tool"
	}[name] ?? name;
	if (!label) return void 0;
	return `Codex · ${label}: ${phase}.\n\n`;
}
/** Map wire blocks to the native DSH vocabulary, with consecutive indices and unchanged finish/replay/tool payloads. */
async function* presentForDsh(source) {
	const indices = /* @__PURE__ */ new Map();
	const privateBlocks = /* @__PURE__ */ new Set();
	const shown = /* @__PURE__ */ new Set();
	let nextIndex = 0;
	for await (const chunk of source) {
		if (chunk.type === "block-start" && chunk.blockType === "codex-action") {
			privateBlocks.add(chunk.index);
			continue;
		}
		if (chunk.type === "block-end" && chunk.block.type === "codex-action") {
			privateBlocks.delete(chunk.index);
			const text = actionText(chunk.block);
			const action = chunk.block;
			const key = `${String(action.actionId)}:${String(action.actionType)}:${String(action.phase)}`;
			if (text !== void 0 && !shown.has(key)) {
				shown.add(key);
				const index = nextIndex++;
				yield {
					type: "block-start",
					index,
					blockType: "text"
				};
				yield {
					type: "text-delta",
					index,
					text
				};
				yield {
					type: "block-end",
					index,
					block: {
						type: "text",
						text
					}
				};
			}
			continue;
		}
		if ("index" in chunk && typeof chunk.index === "number") {
			if (privateBlocks.has(chunk.index)) continue;
			let index = indices.get(chunk.index);
			if (index === void 0) {
				index = nextIndex++;
				indices.set(chunk.index, index);
			}
			yield {
				...chunk,
				index
			};
		} else yield chunk;
	}
}
//#endregion
//#region src/dsh-adapter.ts
var DshCodexAdapter = class extends CodexAppServerAdapter {
	async *stream(options) {
		yield* presentForDsh(super.stream(options));
	}
};
//#endregion
//#region src/launch.ts
/** Launch only this plugin's official packaged Codex binary under DSH's existing process owner. */
/** Layout is the official @openai/codex 0.154.0 wrapper's platform-package layout. */
function windowsCodexBinary(packageJson, arch) {
	const target = arch === "x64" ? "x86_64-pc-windows-msvc" : arch === "arm64" ? "aarch64-pc-windows-msvc" : void 0;
	if (target === void 0) throw new Error(`Unsupported Codex Windows architecture: ${arch}`);
	const require = createRequire(packageJson);
	let vendor = join(dirname(packageJson), "vendor");
	try {
		vendor = join(dirname(require.resolve(`@openai/codex-win32-${arch}/package.json`)), "vendor");
	} catch {}
	const executable = join(vendor, target, "bin", "codex.exe");
	if (!existsSync(executable)) throw new Error("Official Codex Windows binary is missing; reinstall the plugin including optional dependencies.");
	return executable;
}
/** Avoid the JS wrapper's second spawn, which omits Windows hide flags. No global monkey patch and no shell. */
function codexSpawnSpec(spec, platform = process.platform) {
	if (platform !== "win32") return spec;
	const manifest = createRequire(import.meta.url).resolve("@openai/codex/package.json");
	const wrapper = join(dirname(manifest), "bin", "codex.js");
	if (spec.argv[0] !== process.execPath || spec.argv[1] === void 0 || resolve(spec.argv[1]) !== resolve(wrapper) || spec.argv[2] !== "app-server") return spec;
	return {
		...spec,
		argv: [windowsCodexBinary(manifest, process.arch), ...spec.argv.slice(2)]
	};
}
//#endregion
//#region src/usage.ts
function record(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function tokenString(value) {
	if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return String(value);
	if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value).toString();
	return null;
}
function validDay(value) {
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const n = Date.parse(value + "T00:00:00Z");
	return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === value;
}
function normalizeUsage(value) {
	const root = record(value);
	const lifetimeTokens = tokenString(record(root.summary).lifetimeTokens);
	if (!Array.isArray(root.dailyUsageBuckets)) return {
		lifetimeTokens,
		days: null,
		incomplete: false
	};
	const byDate = /* @__PURE__ */ new Map();
	let incomplete = false;
	for (const entry of root.dailyUsageBuckets) {
		const item = record(entry);
		const tokens = tokenString(item.tokens);
		if (!validDay(item.startDate) || tokens === null) {
			incomplete = true;
			continue;
		}
		byDate.set(item.startDate, {
			date: item.startDate,
			tokens
		});
	}
	return {
		lifetimeTokens,
		days: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
		incomplete
	};
}
/** Only documented, announced resets. Predictions and banked credits are not reset events. */
function normalizeResets(value, now) {
	const events = record(value).events;
	if (!Array.isArray(events)) return [];
	const byDate = /* @__PURE__ */ new Map();
	for (const value of events) {
		const event = record(value);
		if (event.group !== "reset" || event.announcement_state !== "announced") continue;
		if (typeof event.announced_at !== "string") continue;
		const at = Date.parse(event.announced_at);
		if (!Number.isFinite(at) || at > now) continue;
		const announcedAt = new Date(at).toISOString(), date = announcedAt.slice(0, 10);
		const previous = byDate.get(date);
		if (!previous || previous.announcedAt < announcedAt) byDate.set(date, {
			date,
			announcedAt
		});
	}
	return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
function normalizeWindows(value) {
	const root = record(value);
	const multi = record(root.rateLimitsByLimitId);
	const entries = Object.keys(multi).length ? Object.entries(multi) : [["codex", root.rateLimits]];
	const windows = [];
	for (const [id, raw] of entries) {
		const bucket = record(raw);
		for (const slot of ["primary", "secondary"]) {
			const window = record(bucket[slot]);
			if (!Object.keys(window).length) continue;
			windows.push({
				name: `${typeof bucket.limitName === "string" ? bucket.limitName : id} · ${slot}`,
				usedPercent: typeof window.usedPercent === "number" && Number.isFinite(window.usedPercent) ? window.usedPercent : null,
				resetsAt: typeof window.resetsAt === "number" && Number.isSafeInteger(window.resetsAt) ? window.resetsAt : null
			});
		}
	}
	return windows;
}
//#endregion
//#region src/usage-query.ts
const TIMELINE_URL = "https://codex-reset.com/api/timeline";
const READER_ID = "dsh-codex-native/0.2.1-alpha.5 (+https://github.com/Tests4gptplay/dsh-codex-native)";
/** A shared public-response cache, evaluated only on a manual query, never by a timer. */
function createTimelineReader(fetcher = globalThis.fetch, now = Date.now) {
	let cached;
	return () => {
		if (cached && now() < cached.expires) return cached.value;
		const entry = {
			expires: now() + 6e4,
			value: Promise.resolve(null)
		};
		entry.value = (async () => {
			const response = await fetcher(TIMELINE_URL, {
				method: "GET",
				credentials: "omit",
				redirect: "error",
				headers: {
					Accept: "application/json",
					"User-Agent": READER_ID
				},
				signal: AbortSignal.timeout(8e3)
			});
			if (!response.ok) {
				const retry = response.headers.get("retry-after");
				const retryAt = retry === null ? NaN : /^\d+$/.test(retry) ? now() + Number(retry) * 1e3 : Date.parse(retry);
				if (Number.isFinite(retryAt)) entry.expires = Math.max(entry.expires, retryAt);
				throw new Error(`Reset reference unavailable (${response.status})`);
			}
			const data = await response.json();
			if (!data || typeof data !== "object" || !Array.isArray(data.events)) throw new Error("Reset reference format unavailable");
			return data;
		})();
		cached = entry;
		return entry.value;
	};
}
const readTimeline = createTimelineReader();
/** This function is reached only by the Settings Query button, never by the agent loop. */
async function queryUsage(readOfficial, timeline = readTimeline, now = Date.now) {
	const usage = normalizeUsage(await readOfficial("account/usage/read"));
	const [limits, reference] = await Promise.allSettled([readOfficial("account/rateLimits/read"), timeline()]);
	const queriedAt = now();
	return {
		...usage,
		queriedAt: new Date(queriedAt).toISOString(),
		windows: normalizeWindows(limits.status === "fulfilled" ? limits.value : null),
		resets: normalizeResets(reference.status === "fulfilled" ? reference.value : null, queriedAt),
		resetSource: reference.status === "fulfilled" ? "codex-reset.com" : "unavailable"
	};
}
//#endregion
//#region src/native-account.ts
/** Native Codex account bridge. OAuth credentials remain owned by official Codex. */
var NativeCodexAccount = class {
	spawn;
	active;
	connections = /* @__PURE__ */ new Set();
	flow;
	disposed = false;
	constructor(spawn) {
		this.spawn = spawn;
	}
	async open() {
		if (this.disposed) throw new Error("Native Codex account service is disposed");
		const child = this.spawn({
			argv: [
				process.execPath,
				codexCliEntry(),
				"app-server",
				"--stdio"
			],
			cwd: homedir(),
			stdio: {
				stdin: "pipe",
				stdout: "pipe",
				stderr: { maxBytes: 64 * 1024 }
			},
			env: {},
			graceMs: 3e3
		});
		if (!child.stdin || !child.stdout) {
			child.terminate();
			throw new Error("Codex app-server did not provide stdio");
		}
		const diagnostics = connectCodexProcess(child, 8 * 1024 * 1024);
		const rpc = diagnostics.rpc;
		let closeTask;
		const close = () => {
			closeTask ??= (async () => {
				try {
					rpc.dispose();
					diagnostics.markCleanup();
					child.terminate();
					await child.waitForExit(AbortSignal.timeout(6e3)).catch(() => {});
				} finally {
					this.connections.delete(conn);
				}
			})();
			return closeTask;
		};
		const conn = {
			child,
			rpc,
			close,
			failure: diagnostics.failure
		};
		this.connections.add(conn);
		try {
			await rpc.request("initialize", { clientInfo: {
				name: "dsh_codex_native",
				title: "DSH Codex Native",
				version: "0.2.1"
			} });
			await rpc.notify("initialized", {});
			return conn;
		} catch (error) {
			await close();
			throw diagnostics.failure(error);
		}
	}
	async withConnection(fn) {
		const conn = await this.open();
		try {
			return await fn(conn.rpc);
		} catch (error) {
			await conn.close();
			throw conn.failure(error);
		} finally {
			await conn.close();
		}
	}
	async status() {
		const data = object$1(await this.withConnection((rpc) => rpc.request("account/read", { refreshToken: false })), "account/read");
		const account = data.account === null || data.account === void 0 ? null : object$1(data.account, "account");
		if (!account || account.type !== "chatgpt") return { authenticated: false };
		return {
			authenticated: true,
			...typeof account.email === "string" ? { email: account.email } : {},
			...typeof account.planType === "string" ? { planType: account.planType } : {}
		};
	}
	async quota() {
		return object$1(await this.withConnection((rpc) => rpc.request("account/rateLimits/read", {})), "account/rateLimits/read").rateLimits ?? null;
	}
	/** Manual, read-only account-wide history. No token accumulation hook or background loop. */
	async usage() {
		return this.withConnection((rpc) => queryUsage((method) => rpc.request(method, {})));
	}
	async start(mode) {
		if (this.active) await this.active.close();
		this.active = void 0;
		if (mode !== "browser" && mode !== "device") throw new Error("Unsupported login mode");
		const conn = await this.open();
		this.active = conn;
		try {
			const reply = object$1(await conn.rpc.request("account/login/start", mode === "browser" ? {
				type: "chatgpt",
				useHostedLoginSuccessPage: true,
				appBrand: "chatgpt"
			} : { type: "chatgptDeviceCode" }), "account/login/start");
			if (typeof reply.loginId !== "string" || !reply.loginId) throw new Error("Codex login id missing");
			const info = {
				id: reply.loginId,
				phase: "pending",
				mode
			};
			if (mode === "browser") {
				if (typeof reply.authUrl !== "string") throw new Error("Codex browser authorization URL missing");
				info.authUrl = reply.authUrl;
			} else {
				if (typeof reply.verificationUrl !== "string" || typeof reply.userCode !== "string") throw new Error("Codex device-code response incomplete");
				info.verificationUrl = reply.verificationUrl;
				info.userCode = reply.userCode;
			}
			this.flow = info;
			this.observeLogin(conn, info.id);
			return { ...info };
		} catch (error) {
			if (this.active === conn) this.active = void 0;
			await conn.close();
			throw conn.failure(error);
		}
	}
	async observeLogin(conn, loginId) {
		try {
			while (!this.disposed && this.active === conn) {
				const event = await conn.rpc.next();
				if (event.done) break;
				if (event.value.kind !== "notification" || event.value.method !== "account/login/completed") continue;
				const params = event.value.params;
				if (params.loginId !== loginId) continue;
				this.flow = params.success === true ? {
					id: loginId,
					phase: "authenticated",
					mode: this.flow?.mode ?? "browser"
				} : {
					id: loginId,
					phase: "failed",
					mode: this.flow?.mode ?? "browser",
					error: typeof params.error === "string" ? params.error.slice(0, 180) : "Codex login failed"
				};
				break;
			}
		} catch (error) {
			await conn.close();
			if (this.active === conn) this.flow = {
				id: loginId,
				phase: "failed",
				mode: this.flow?.mode ?? "browser",
				error: conn.failure(error).message
			};
		} finally {
			if (this.active === conn) this.active = void 0;
			await conn.close();
		}
	}
	loginStatus(id) {
		if (!this.flow || this.flow.id !== id) throw new Error("Unknown Codex login attempt");
		return { ...this.flow };
	}
	async cancel(id) {
		if (!this.flow || this.flow.id !== id) throw new Error("Unknown Codex login attempt");
		const conn = this.active;
		const cancelled = {
			id,
			phase: "cancelled",
			mode: this.flow.mode
		};
		this.active = void 0;
		this.flow = cancelled;
		if (conn) {
			conn.rpc.request("account/login/cancel", { loginId: id }).catch(() => {});
			await conn.close();
		}
		return { ...cancelled };
	}
	async logout() {
		if (this.flow?.phase === "pending") await this.cancel(this.flow.id);
		await this.withConnection((rpc) => rpc.request("account/logout", {}).then(() => void 0));
		return { authenticated: false };
	}
	async dispose() {
		this.disposed = true;
		this.active = void 0;
		await Promise.all([...this.connections].map((conn) => conn.close()));
	}
};
//#endregion
//#region src/native-transport.ts
/** Use the existing authenticated DSH connection; never create a public HTTP listener. */
const CODEX_NATIVE_ENDPOINTS = [
	"status",
	"quota",
	"usage",
	"login/start",
	"login/status",
	"login/cancel",
	"logout"
];
function registerNativeCodexTransport(connection, account) {
	const disposers = [];
	try {
		for (const endpoint of CODEX_NATIVE_ENDPOINTS) {
			const method = `codex-native/${endpoint}`;
			disposers.push(connection.fetch.register({
				path: `/api/${method}`,
				methods: ["POST"],
				requestBody: "buffered",
				async fetch(request) {
					if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") return new Response("Expected JSON", { status: 415 });
					let body;
					try {
						body = await request.json();
					} catch {
						return new Response("Invalid JSON", { status: 400 });
					}
					const received = clientRequestSchema.safeParse(body);
					if (!received.success || received.data.method !== method) return new Response("Invalid authenticated DSH RPC", { status: 400 });
					const payload = received.data.payload;
					try {
						request.signal.throwIfAborted();
						let value;
						switch (endpoint) {
							case "status":
								value = await account.status();
								break;
							case "quota":
								value = await account.quota();
								break;
							case "usage":
								value = await account.usage();
								break;
							case "login/start": {
								const mode = payload?.mode;
								if (mode !== "browser" && mode !== "device") throw new Error("Unknown Codex login mode");
								value = await account.start(mode);
								break;
							}
							case "login/status":
								if (typeof payload?.id !== "string") throw new Error("Login id required");
								value = account.loginStatus(payload.id);
								break;
							case "login/cancel":
								if (typeof payload?.id !== "string") throw new Error("Login id required");
								value = await account.cancel(payload.id);
								break;
							case "logout":
								value = await account.logout();
								break;
						}
						return Response.json({
							type: "server-response",
							rpcId: received.data.rpcId,
							result: {
								ok: true,
								value
							}
						});
					} catch (error) {
						const message = error instanceof Error ? error.message.slice(0, 3e3) : "Codex account operation failed";
						return Response.json({
							type: "server-response",
							rpcId: received.data.rpcId,
							result: {
								ok: false,
								error: {
									code: "native_codex",
									message,
									details: { issues: [] }
								}
							}
						});
					}
				}
			}));
		}
	} catch (error) {
		for (const dispose of disposers.reverse()) dispose();
		throw error;
	}
	return async () => {
		await Promise.all(disposers.reverse().map((dispose) => dispose()));
	};
}
//#endregion
//#region src/index.ts
const name = "dsh-codex-native";
const inject = [
	"llm",
	"subprocess",
	"tools"
];
const MODEL_MODALITIES = ["text", "image"];
const DEFAULT_MODELS = [
	{
		id: "gpt-6-astra",
		name: "GPT-6-Astra",
		description: "Our most capable model for complex, demanding work.",
		contextWindow: 272e3,
		inputModalities: ["text", "image"],
		reasoningEfforts: [
			"low",
			"medium",
			"high",
			"xhigh",
			"max",
			"ultra"
		],
		defaultReasoningEffort: "medium"
	},
	{
		id: "gpt-5.6-sol",
		name: "GPT-5.6-Sol",
		description: "Reliable agentic workhorse for everyday tasks.",
		contextWindow: 272e3,
		inputModalities: ["text", "image"],
		reasoningEfforts: [
			"low",
			"medium",
			"high",
			"xhigh",
			"max",
			"ultra"
		],
		defaultReasoningEffort: "low"
	},
	{
		id: "gpt-5.6-terra",
		name: "GPT-5.6-Terra",
		description: "Balanced agentic coding model for everyday work.",
		contextWindow: 272e3,
		inputModalities: ["text", "image"],
		reasoningEfforts: [
			"low",
			"medium",
			"high",
			"xhigh",
			"max",
			"ultra"
		],
		defaultReasoningEffort: "medium"
	},
	{
		id: "gpt-5.6-luna",
		name: "GPT-5.6-Luna",
		description: "Fast and affordable agentic coding model.",
		contextWindow: 272e3,
		inputModalities: ["text", "image"],
		reasoningEfforts: [
			"low",
			"medium",
			"high",
			"xhigh",
			"max"
		],
		defaultReasoningEffort: "medium"
	},
	{
		id: "gpt-5.5",
		name: "GPT-5.5",
		description: "Proven previous-generation model for coding and general work.",
		contextWindow: 272e3,
		inputModalities: ["text", "image"],
		reasoningEfforts: [
			"low",
			"medium",
			"high",
			"xhigh"
		],
		defaultReasoningEffort: "medium"
	},
	{
		id: "gpt-5.3-codex-spark",
		name: "GPT-5.3-Codex-Spark",
		description: "Ultra-fast coding model.",
		contextWindow: 128e3,
		inputModalities: ["text"],
		reasoningEfforts: [
			"low",
			"medium",
			"high",
			"xhigh"
		],
		defaultReasoningEffort: "high"
	}
];
const DEFAULT_MAX_JSON_RPC_LINE_BYTES = 8 * 1024 * 1024;
const DEFAULT_MAX_REQUEST_IMAGE_BYTES = 20 * 1024 * 1024;
const modelSchema = z.object({
	id: z.string().required(),
	name: z.string(),
	description: z.string(),
	contextWindow: z.number().step(1).min(1),
	inputModalities: z.array(z.union(MODEL_MODALITIES)).min(1).default(["text"]),
	reasoningEfforts: z.array(z.string()),
	defaultReasoningEffort: z.string()
});
const Config = z.object({
	provider: z.string().default("codex-local"),
	displayName: z.string().default("Codex (local login)"),
	modelProvider: z.string().default("openai"),
	models: z.array(modelSchema).default(DEFAULT_MODELS),
	timeoutMs: z.number().min(0).max(2147483647).default(0),
	disposeGraceMs: z.number().max(2147483647).default(3e3),
	maxJsonRpcLineBytes: z.number().step(1).min(1).default(DEFAULT_MAX_JSON_RPC_LINE_BYTES),
	maxRequestImageBytes: z.number().step(1).min(1).default(DEFAULT_MAX_REQUEST_IMAGE_BYTES),
	maxStderrBytes: z.number().step(1).min(1).default(64 * 1024),
	maxRetries: z.number().step(1).min(0).max(Number.MAX_SAFE_INTEGER).default(1),
	maxCachedSessions: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER).default(8),
	sessionIdleTimeoutMs: z.number().step(1).min(1).max(2147483647).default(6e5),
	imageGenerationEnabled: z.boolean().default(true),
	env: z.dict(z.string()).default({})
});
const SAFE_ROUTE = /^[a-z0-9][a-z0-9._-]{0,79}$/u;
function resolveConfig(config) {
	const provider = config.provider ?? "codex-local";
	const displayName = config.displayName ?? "Codex (local login)";
	const modelProvider = config.modelProvider ?? "openai";
	const timeoutMs = config.timeoutMs ?? 0;
	const disposeGraceMs = config.disposeGraceMs ?? 3e3;
	const maxJsonRpcLineBytes = config.maxJsonRpcLineBytes ?? DEFAULT_MAX_JSON_RPC_LINE_BYTES;
	const maxRequestImageBytes = config.maxRequestImageBytes ?? DEFAULT_MAX_REQUEST_IMAGE_BYTES;
	const maxStderrBytes = config.maxStderrBytes ?? 64 * 1024;
	const maxRetries = config.maxRetries ?? 1;
	const maxCachedSessions = config.maxCachedSessions ?? 8;
	const sessionIdleTimeoutMs = config.sessionIdleTimeoutMs ?? 6e5;
	const imageGenerationEnabled = config.imageGenerationEnabled ?? true;
	const env = config.env ?? {};
	if (!SAFE_ROUTE.test(provider)) throw new Error("llm-codex-app-server: provider is not a safe route id");
	if (displayName.trim().length === 0) throw new Error("llm-codex-app-server: displayName must not be empty");
	if (!SAFE_ROUTE.test(modelProvider)) throw new Error("llm-codex-app-server: modelProvider is not a safe Codex provider id");
	if (!Number.isFinite(timeoutMs) || timeoutMs < 0 || timeoutMs > 2147483647) throw new Error("dsh-codex-native: timeoutMs must be a non-negative finite number (0 disables the additional hard timer)");
	if (!Number.isFinite(disposeGraceMs) || disposeGraceMs <= 0 || disposeGraceMs > 2147483647) throw new Error("llm-codex-app-server: disposeGraceMs must be a positive finite number");
	if (!Number.isSafeInteger(maxJsonRpcLineBytes) || maxJsonRpcLineBytes <= 0) throw new Error("llm-codex-app-server: maxJsonRpcLineBytes must be a positive safe integer");
	if (!Number.isSafeInteger(maxRequestImageBytes) || maxRequestImageBytes <= 0) throw new Error("llm-codex-app-server: maxRequestImageBytes must be a positive safe integer");
	if (!Number.isSafeInteger(maxStderrBytes) || maxStderrBytes <= 0) throw new Error("llm-codex-app-server: maxStderrBytes must be a positive safe integer");
	if (!Number.isSafeInteger(maxRetries) || maxRetries < 0) throw new Error("llm-codex-app-server: maxRetries must be a non-negative safe integer");
	if (!Number.isSafeInteger(maxCachedSessions) || maxCachedSessions <= 0) throw new Error("llm-codex-app-server: maxCachedSessions must be a positive safe integer");
	if (!Number.isSafeInteger(sessionIdleTimeoutMs) || sessionIdleTimeoutMs <= 0 || sessionIdleTimeoutMs > 2147483647) throw new Error("llm-codex-app-server: sessionIdleTimeoutMs must be a positive timer duration");
	const configuredModels = config.models ?? DEFAULT_MODELS;
	if (configuredModels.length === 0) throw new Error("llm-codex-app-server: models must not be empty");
	const seen = /* @__PURE__ */ new Set();
	return {
		provider,
		displayName,
		modelProvider,
		models: configuredModels.map((candidate) => {
			if (!SAFE_MODEL_ID.test(candidate.id) || seen.has(candidate.id)) throw new Error(`llm-codex-app-server: invalid or duplicate model id ${JSON.stringify(candidate.id)}`);
			seen.add(candidate.id);
			const inputModalities = [...candidate.inputModalities ?? ["text"]];
			if (inputModalities.length === 0 || inputModalities.some((modality) => !MODEL_MODALITIES.includes(modality)) || new Set(inputModalities).size !== inputModalities.length) throw new Error(`llm-codex-app-server: model ${JSON.stringify(candidate.id)} has invalid inputModalities`);
			const efforts = [...candidate.reasoningEfforts ?? []];
			if (efforts.some((effort) => !SAFE_REASONING_EFFORT.test(effort)) || new Set(efforts).size !== efforts.length) throw new Error(`llm-codex-app-server: model ${JSON.stringify(candidate.id)} has invalid reasoningEfforts`);
			if (candidate.defaultReasoningEffort !== void 0 && !efforts.includes(candidate.defaultReasoningEffort)) throw new Error(`llm-codex-app-server: model ${JSON.stringify(candidate.id)} default reasoning effort is not advertised`);
			return {
				id: candidate.id,
				name: candidate.name ?? candidate.id,
				...candidate.description === void 0 ? {} : { description: candidate.description },
				...candidate.contextWindow === void 0 ? {} : { contextWindow: candidate.contextWindow },
				inputModalities,
				reasoningEfforts: efforts,
				...candidate.defaultReasoningEffort === void 0 ? {} : { defaultReasoningEffort: candidate.defaultReasoningEffort }
			};
		}),
		timeoutMs,
		disposeGraceMs,
		maxJsonRpcLineBytes,
		maxRequestImageBytes,
		maxStderrBytes,
		maxRetries,
		maxCachedSessions,
		sessionIdleTimeoutMs,
		imageGenerationEnabled,
		env
	};
}
/** Register the configured Codex App Server route on `ctx.llm`. */
function apply(ctx, config) {
	const resolved = resolveConfig(config);
	const runner = new CodexAppServerRunner({
		timeoutMs: resolved.timeoutMs,
		disposeGraceMs: resolved.disposeGraceMs,
		maxJsonRpcLineBytes: resolved.maxJsonRpcLineBytes,
		maxStderrBytes: resolved.maxStderrBytes,
		env: resolved.env,
		spawn: (spec) => ctx.subprocess.spawn(codexSpawnSpec(spec))
	});
	const reportCleanupError = (error) => {
		ctx.logger.warn(`llm-codex-app-server: cached session cleanup failed: ${String(error)}`);
	};
	const adapter = new DshCodexAdapter({
		provider: resolved.provider,
		displayName: resolved.displayName,
		modelProvider: resolved.modelProvider,
		models: resolved.models,
		maxRetries: resolved.maxRetries,
		maxRequestImageBytes: resolved.maxRequestImageBytes,
		maxCachedSessions: resolved.maxCachedSessions,
		sessionIdleTimeoutMs: resolved.sessionIdleTimeoutMs,
		onCleanupError: reportCleanupError,
		resolveAttachments: () => ctx.get("attachments"),
		resolveImageGenerationEnabled: () => resolved.imageGenerationEnabled,
		runner
	});
	ctx.llm.registerAdapter([resolved.provider], adapter);
	ctx.on("session/disposed", (session) => {
		adapter.disposeSession(String(session.id)).catch(reportCleanupError);
	});
	const account = new NativeCodexAccount((spec) => ctx.subprocess.spawn(codexSpawnSpec(spec)));
	ctx.inject(["connection"], (scoped) => {
		scoped.effect(() => registerNativeCodexTransport(scoped.connection, account), "dsh-codex-native: authenticated account RPC");
	});
	ctx.effect(() => () => {
		account.dispose();
	}, "dsh-codex-native: close account login process");
	ctx.effect(() => () => adapter.dispose(), "llm-codex-app-server: dispose cached sessions");
}
//#endregion
export { AppServerEventMapper, CODEX_APP_SERVER_VERSION, CodexAppServerAdapter, CodexAppServerRunner, Config, NativeImageBridge, appServerDynamicTools, appServerHistory, apply, assertCompletedTurn, boundRequestImageHistory, codexAppServerArgv, codexCliEntry, codexFailureCode, harnessToolCall, imageAttachmentMarker, inject, name };
