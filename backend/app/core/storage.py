import os
from pathlib import Path
from urllib.parse import quote

import boto3
from botocore.client import Config

_client = None
_presign_client = None
LOCAL_STORAGE_ROOT = Path(os.environ.get("LOCAL_STORAGE_ROOT", "/tmp/posh-storage"))


def use_local_storage() -> bool:
    return os.environ.get("STORAGE_BACKEND", "").lower() == "local" or not os.environ.get(
        "MINIO_ENDPOINT"
    )


def _endpoint_url(value: str) -> str:
    return value if value.startswith(("http://", "https://")) else f"http://{value}"


def get_storage_client():
    """Get or create the internal MinIO/S3 client used by backend services."""
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            endpoint_url=_endpoint_url(os.environ.get("MINIO_ENDPOINT", "minio:9000")),
            aws_access_key_id=os.environ.get("MINIO_ROOT_USER", "minioadmin"),
            aws_secret_access_key=os.environ.get("MINIO_ROOT_PASSWORD", "minioadmin123"),
            config=Config(signature_version="s3v4"),
            region_name=os.environ.get("S3_REGION", "us-east-1"),
        )
    return _client


def get_presign_client():
    """Create signed URLs with the browser-accessible MinIO endpoint."""
    global _presign_client
    if _presign_client is None:
        endpoint = os.environ.get("MINIO_PUBLIC_ENDPOINT") or os.environ.get(
            "MINIO_ENDPOINT",
            "minio:9000",
        )
        _presign_client = boto3.client(
            "s3",
            endpoint_url=_endpoint_url(endpoint),
            aws_access_key_id=os.environ.get("MINIO_ROOT_USER", "minioadmin"),
            aws_secret_access_key=os.environ.get("MINIO_ROOT_PASSWORD", "minioadmin123"),
            config=Config(signature_version="s3v4"),
            region_name=os.environ.get("S3_REGION", "us-east-1"),
        )
    return _presign_client


def ensure_bucket_exists(bucket_name: str) -> None:
    """Create bucket if it does not exist."""
    if use_local_storage():
        (LOCAL_STORAGE_ROOT / bucket_name).mkdir(parents=True, exist_ok=True)
        return
    client = get_storage_client()
    try:
        client.head_bucket(Bucket=bucket_name)
    except Exception:
        client.create_bucket(Bucket=bucket_name)


def upload_file(
    file_bytes: bytes,
    bucket: str,
    object_key: str,
    content_type: str = "application/octet-stream",
) -> str:
    """Upload a file to MinIO/S3 and return its object key."""
    ensure_bucket_exists(bucket)
    if use_local_storage():
        target_path = LOCAL_STORAGE_ROOT / bucket / object_key
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_bytes(file_bytes)
        return object_key
    client = get_storage_client()
    client.put_object(
        Bucket=bucket,
        Key=object_key,
        Body=file_bytes,
        ContentType=content_type,
    )
    return object_key


def generate_presigned_url(bucket: str, object_key: str, expiry_seconds: int = 300) -> str:
    """Generate a short-lived signed URL for secure browser access."""
    if use_local_storage():
        public_base_url = os.environ.get("PUBLIC_API_URL", "").rstrip("/")
        local_path = f"/storage/{quote(bucket)}/{quote(object_key)}"
        return f"{public_base_url}{local_path}" if public_base_url else local_path
    client = get_presign_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": object_key},
        ExpiresIn=expiry_seconds,
    )


def read_file(bucket: str, object_key: str) -> bytes:
    """Read an object from MinIO/S3 through the internal service endpoint."""
    if use_local_storage():
        return (LOCAL_STORAGE_ROOT / bucket / object_key).read_bytes()
    client = get_storage_client()
    response = client.get_object(Bucket=bucket, Key=object_key)
    return response["Body"].read()


def delete_file(bucket: str, object_key: str) -> None:
    """Delete a file from storage."""
    if use_local_storage():
        try:
            (LOCAL_STORAGE_ROOT / bucket / object_key).unlink()
        except FileNotFoundError:
            pass
        return
    client = get_storage_client()
    client.delete_object(Bucket=bucket, Key=object_key)
