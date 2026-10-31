"""Generate audio/<key>.mp3 for every phrase in src/game/phrases.js (edge-tts, voice Dmitry).

Usage: python tools/gen_audio.py [--force] [key ...]
Only missing clips are generated unless --force or explicit keys are given.
"""
import asyncio, json, pathlib, re, sys

import edge_tts

ROOT = pathlib.Path(__file__).resolve().parent.parent
VOICE, RATE = "ru-RU-DmitryNeural", "-5%"


def phrases():
    src = (ROOT / "src" / "game" / "phrases.js").read_text(encoding="utf-8")
    return json.loads(re.search(r"PHRASES = (\{.*\});", src, re.S).group(1))


async def one(sem, key, text):
    out = ROOT / "audio" / f"{key}.mp3"
    async with sem:
        for attempt in range(4):
            try:
                await edge_tts.Communicate(text, VOICE, rate=RATE).save(str(out))
                return
            except Exception as e:  # network hiccups: retry
                if attempt == 3:
                    print("FAIL", key, e)
                await asyncio.sleep(1 + attempt)


async def main():
    args = sys.argv[1:]
    force = "--force" in args
    keys = [a for a in args if not a.startswith("--")]
    ph = phrases()
    (ROOT / "audio").mkdir(exist_ok=True)

    def missing(k):
        p = ROOT / "audio" / f"{k}.mp3"
        return not p.exists() or p.stat().st_size < 1000  # failed runs leave empty files

    todo = {k: v for k, v in ph.items() if (k in keys) or (not keys and (force or missing(k)))}
    print(f"{len(todo)} clips to generate")
    sem = asyncio.Semaphore(6)
    await asyncio.gather(*(one(sem, k, v) for k, v in todo.items()))
    print("done")


asyncio.run(main())
