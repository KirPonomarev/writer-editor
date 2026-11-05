"""Fixed offline base signals. No authoring, model selection or write protocol."""
import hashlib
import json
from pathlib import Path
import resource
import sys
import time


def main():
    started = time.monotonic()
    root = Path(__file__).resolve().parent
    if sys.version_info[:3] != (3, 14, 10) or not sys.flags.isolated or not sys.flags.no_site or not sys.dont_write_bytecode:
        raise ValueError("runtime")
    raw = sys.stdin.buffer.read(262145)
    if len(raw) > 262144:
        raise ValueError("input budget")
    packet = json.loads(raw.decode("utf-8"), object_pairs_hook=unique_object)
    identity_keys = ["projectId", "sceneId", "sourceRevision", "sourceTextHash", "generation", "languageCode"]
    if not isinstance(packet, dict) or set(packet) != set(identity_keys + ["text", "nonce", "resourceCatalogSha256"]):
        raise ValueError("shape")
    if any(not isinstance(packet[key], str) for key in packet):
        raise ValueError("type")
    text = packet["text"]
    if not text or len(text.encode("utf-16-le")) // 2 > 20000 or hashlib.sha256(text.encode("utf-8")).hexdigest() != packet["sourceTextHash"]:
        raise ValueError("source")
    models = {"en": "en_core_web_sm", "ru": "ru_core_news_sm"}
    model = models.get(packet["languageCode"])
    if model is None:
        raise ValueError("language")
    # -I -S excludes user site, environment paths and .pth execution. Only this
    # byte-verified, fixed resource tree is added; no payload supplies a path.
    sys.path.insert(0, str(root / "site"))
    import spacy
    if spacy.__version__ != "3.8.18":
        raise ValueError("engine version")
    spacy.require_cpu()
    spacy.util.fix_random_seed(0)
    pipeline = spacy.load(root / "site" / model / (model + "-3.8.0"))
    if pipeline.meta.get("version") != "3.8.0" or pipeline.lang != packet["languageCode"]:
        raise ValueError("model version")
    pipeline.max_length = 20000
    doc = pipeline(text)
    if len(doc) > 16384 or len(doc.ents) > 4096:
        raise ValueError("result budget")
    offsets = [0]
    for char in text:
        offsets.append(offsets[-1] + (2 if ord(char) > 0xffff else 1))
    tokens = [{"text": token.text, "lemma": token.lemma_, "pos": token.pos_, "morph": str(token.morph),
               "dependency": token.dep_, "headIndex": token.head.i,
               "utf16Start": offsets[token.idx], "utf16End": offsets[token.idx + len(token.text)]} for token in doc]
    entities = [{"text": entity.text, "label": entity.label_, "utf16Start": offsets[entity.start_char],
                 "utf16End": offsets[entity.end_char]} for entity in doc.ents]
    value = {"protocolVersion": 1, "nonce": packet["nonce"], "resourceCatalogSha256": packet["resourceCatalogSha256"],
             "identity": {key: packet[key] for key in identity_keys}, "tokens": tokens, "entities": entities,
             "elapsedMs": int((time.monotonic() - started) * 1000),
             "maxRssBytes": int(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)}
    output = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if len(output) > 4 * 1024 * 1024:
        raise ValueError("output budget")
    sys.stdout.buffer.write(output + b"\n")


def unique_object(pairs):
    value = {}
    for key, item in pairs:
        if key in value:
            raise ValueError("duplicate key")
        value[key] = item
    return value


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Never expose manuscript text, paths or dependency traceback to logs.
        sys.stderr.write("E_ATLAS_LANGUAGE_WORKER_FAILED\n")
        sys.exit(1)
