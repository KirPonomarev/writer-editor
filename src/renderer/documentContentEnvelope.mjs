// Compatibility facade: document semantics are owned by Core.
import envelope from '../core/document-content-envelope-v1.cjs';

export const { createDefaultDocumentMeta, normalizeDocumentLineEndings, buildParagraphDocumentFromText, composeMetaBlock, composeCardsBlock, canonicalizeDocumentJson, serializeDocumentJson, deriveVisibleTextFromDocument, analyzeDocumentPlainTextRoundTrip, parseObservablePayload, composeObservablePayload, composeDocumentContentFromBase } = envelope;
