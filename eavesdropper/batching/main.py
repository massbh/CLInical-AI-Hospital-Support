from fastapi import FastAPI
import json
import os
import re
from config import BATCH_SIZE, BATCH_TYPE, TRANSCRIPT_FILE, STATE_FILE

app = FastAPI()


# ---------- STATE ----------
def load_state():
    if not os.path.exists(STATE_FILE):
        return {"last_index": 0}
    with open(STATE_FILE, "r") as f:
        return json.load(f)


def save_state(state):
    with open(STATE_FILE, "w") as f:
        json.dump(state, f)


# ---------- READ ----------
def read_transcript():
    if not os.path.exists(TRANSCRIPT_FILE):
        return ""
    with open(TRANSCRIPT_FILE, "r") as f:
        return f.read()


# ---------- SPLITTERS ----------
def split_lines(text):
    return [line.strip() for line in text.splitlines() if line.strip()]


def split_words(text):
    return re.findall(r"\b\w+\b", text)


def split_characters(text):
    return list(text)


def split_sentences(text):
    # simple sentence splitter
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    return [s for s in sentences if s]


SPLITTERS = {
    "lines": split_lines,
    "words": split_words,
    "characters": split_characters,
    "sentences": split_sentences,
}


def get_units(text):
    try:
        return SPLITTERS[BATCH_TYPE](text)
    except KeyError:
        raise ValueError(f"Unsupported BATCH_TYPE: {BATCH_TYPE}")


# ---------- API ----------
def compute_batch(units, state):
    start = state["last_index"]
    end = start + BATCH_SIZE
    return units[start:end], start, end


def update_state_if_needed(batch, state, end):
    if batch:
        state["last_index"] = end
        save_state(state)


def format_batch(batch_units):
    if BATCH_TYPE == "characters":
        return "".join(batch_units)
    return " ".join(batch_units)


# ---------- ENDPOINT ----------
@app.get("/next-batch")
def get_next_batch():
    state = load_state()
    text = read_transcript()
    units = get_units(text)

    batch_units, start, end = compute_batch(units, state)
    update_state_if_needed(batch_units, state, end)

    return format_batch(batch_units)


@app.post("/reset")
def reset_state():
    """Reset the batching cursor so the next /next-batch starts at index 0.
    Called by tradLlm when a new appointment session starts."""
    save_state({"last_index": 0})
    return {"ok": True, "last_index": 0}
