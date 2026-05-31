"""FASTA parser and sequence utilities."""
from typing import List, Tuple


def parse_fasta(text: str) -> List[Tuple[str, str]]:
    """Parse a multi-sequence FASTA string. Returns list of (header, sequence)."""
    records: List[Tuple[str, str]] = []
    header: str | None = None
    buf: List[str] = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith(">"):
            if header is not None:
                records.append((header, "".join(buf).upper()))
            header = line[1:].strip()
            buf = []
        else:
            buf.append(line)
    if header is not None:
        records.append((header, "".join(buf).upper()))
    return records


def validate_dna(seq: str, max_len: int = 100000) -> bool:
    if len(seq) == 0 or len(seq) > max_len:
        return False
    return all(c in "ATGCN" for c in seq)


def validate_any(seq: str, max_len: int = 100000) -> bool:
    return 0 < len(seq) <= max_len
