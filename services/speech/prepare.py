"""Download and verify pinned model assets. Run only during setup, never at startup."""
import argparse
import hashlib
import os
from pathlib import Path
import urllib.request

from .assets import ASSETS, DEFAULT_MODEL_DIR


def verified(path: Path, metadata: dict) -> bool:
    if not path.is_file() or path.stat().st_size != metadata["bytes"]:
        return False
    with path.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest() == metadata["sha256"]


def prepare(directory: Path) -> None:
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    for name, metadata in ASSETS.items():
        destination = directory / name
        if verified(destination, metadata):
            print(f"Verified {name}", flush=True)
            continue
        partial = directory / f"{name}.download"
        request = urllib.request.Request(metadata["url"], headers={"User-Agent": "Melissa-speech-setup/1.0"})
        print(f"Downloading pinned {name}", flush=True)
        try:
            size = 0
            with urllib.request.urlopen(request, timeout=30) as response, partial.open("wb") as target:
                while block := response.read(1024 * 1024):
                    size += len(block)
                    if size > metadata["bytes"]:
                        raise ValueError("Model download exceeded its pinned size.")
                    target.write(block)
            if not verified(partial, metadata):
                raise ValueError("Model download did not match its pinned SHA-256 digest.")
            os.chmod(partial, 0o600)
            partial.replace(destination)
            print(f"Verified {name}", flush=True)
        finally:
            partial.unlink(missing_ok=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model-dir", type=Path, default=DEFAULT_MODEL_DIR)
    prepare(parser.parse_args().model_dir)
