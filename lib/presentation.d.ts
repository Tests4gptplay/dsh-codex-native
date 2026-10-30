/** UI boundary only. Keep Codex replay state and DSH tools intact; do not ship protocol diagnostics as chat blocks. */
import type { StreamChunk } from '@deepseek-ai/dsh-llm';
/** Render meaningful native actions with standard DSH text, never an unsupported custom block. */
export declare function actionText(value: unknown): string | undefined;
/** Map wire blocks to the native DSH vocabulary, with consecutive indices and unchanged finish/replay/tool payloads. */
export declare function presentForDsh(source: AsyncIterable<StreamChunk>, reportDiagnostic: (message: string) => void, shownWarnings?: Set<string>): AsyncIterable<StreamChunk>;
