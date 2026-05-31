import hashlib


def hash_sha256(value: str | None) -> str | None:
    if value is None or value.strip() == "":
        return None
    sha256_hash = hashlib.sha256(value.encode("utf-8")).hexdigest()
    return f"sha256:{sha256_hash}"


def hash_field(field_name: str, value: str | None) -> tuple[str, str | None]:
    hash_value = hash_sha256(value)
    return f"{field_name}_hash", hash_value
