use anyhow::{Result, Context, bail};
use base64::{Engine, engine::general_purpose::STANDARD as BASE64};
use chacha20poly1305::{
    ChaCha20Poly1305, Key, Nonce,
    aead::{Aead, KeyInit},
};
use rand::rngs::OsRng;
use sha2::{Sha256, Digest};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use x25519_dalek::{PublicKey, StaticSecret};

const NONCE_SIZE: usize = 12;
const KEY_SIZE: usize = 32;
const PUBKEY_SIZE: usize = 32;

pub struct HandshakeResult {
    pub cipher: ChaCha20Poly1305,
    pub shared_secret_hash: String,
}

pub struct KeyMaterial {
    pub key_hint: String,
    pub secret_bytes: [u8; 32],
}

pub fn generate_key_material() -> KeyMaterial {
    let secret = StaticSecret::random_from_rng(OsRng);
    let public = PublicKey::from(&secret);
    let secret_bytes = secret.to_bytes();
    let mut hasher = Sha256::new();
    hasher.update(public.as_bytes());
    let hash = hasher.finalize();
    let key_hint = BASE64.encode(&hash[..8]);
    KeyMaterial {
        key_hint,
        secret_bytes,
    }
}

pub async fn handshake_sender(
    stream: &mut TcpStream,
    key_material: &KeyMaterial,
) -> Result<HandshakeResult> {
    let ephemeral_secret = StaticSecret::random_from_rng(OsRng);
    let ephemeral_public = PublicKey::from(&ephemeral_secret);

    let auth_tag = compute_auth_tag(&key_material.secret_bytes, ephemeral_public.as_bytes());
    stream.write_all(ephemeral_public.as_bytes()).await.context("send pubkey")?;
    stream.write_all(&auth_tag).await.context("send auth tag")?;
    stream.flush().await?;

    let mut peer_pub_bytes = [0u8; PUBKEY_SIZE];
    stream.read_exact(&mut peer_pub_bytes).await.context("recv pubkey")?;
    let peer_public = PublicKey::from(peer_pub_bytes);

    let shared = ephemeral_secret.diffie_hellman(&peer_public);
    let session_key = derive_session_key(shared.as_bytes(), &key_material.secret_bytes);

    let mut hasher = Sha256::new();
    hasher.update(shared.as_bytes());
    let shared_secret_hash = hex_encode(&hasher.finalize());

    let cipher = ChaCha20Poly1305::new(Key::from_slice(&session_key));

    Ok(HandshakeResult {
        cipher,
        shared_secret_hash,
    })
}

pub async fn handshake_receiver(
    stream: &mut TcpStream,
    key_material: &KeyMaterial,
) -> Result<HandshakeResult> {
    let ephemeral_secret = StaticSecret::random_from_rng(OsRng);
    let ephemeral_public = PublicKey::from(&ephemeral_secret);

    let mut peer_pub_bytes = [0u8; PUBKEY_SIZE];
    stream.read_exact(&mut peer_pub_bytes).await.context("recv pubkey")?;

    let mut auth_tag = [0u8; 32];
    stream.read_exact(&mut auth_tag).await.context("recv auth tag")?;

    let expected_tag = compute_auth_tag(&key_material.secret_bytes, &peer_pub_bytes);
    if auth_tag != expected_tag {
        bail!("authentication failed: auth tag mismatch");
    }

    stream.write_all(ephemeral_public.as_bytes()).await.context("send pubkey")?;
    stream.flush().await?;

    let peer_public = PublicKey::from(peer_pub_bytes);
    let shared = ephemeral_secret.diffie_hellman(&peer_public);
    let session_key = derive_session_key(shared.as_bytes(), &key_material.secret_bytes);

    let mut hasher = Sha256::new();
    hasher.update(shared.as_bytes());
    let shared_secret_hash = hex_encode(&hasher.finalize());

    let cipher = ChaCha20Poly1305::new(Key::from_slice(&session_key));

    Ok(HandshakeResult {
        cipher,
        shared_secret_hash,
    })
}

pub fn encrypt(cipher: &ChaCha20Poly1305, plaintext: &[u8], nonce_counter: u64) -> Result<Vec<u8>> {
    let nonce = nonce_from_counter(nonce_counter);
    let ciphertext = cipher.encrypt(&nonce, plaintext).map_err(|_| anyhow::anyhow!("encryption failed"))?;
    Ok(ciphertext)
}

pub fn decrypt(cipher: &ChaCha20Poly1305, ciphertext: &[u8], nonce_counter: u64) -> Result<Vec<u8>> {
    let nonce = nonce_from_counter(nonce_counter);
    let plaintext = cipher.decrypt(&nonce, ciphertext).map_err(|_| anyhow::anyhow!("decryption failed"))?;
    Ok(plaintext)
}

fn derive_session_key(shared_secret: &[u8], pre_shared: &[u8; 32]) -> [u8; KEY_SIZE] {
    let mut hasher = Sha256::new();
    hasher.update(b"p2p-file-transfer-session-key");
    hasher.update(shared_secret);
    hasher.update(pre_shared);
    let result = hasher.finalize();
    let mut key = [0u8; KEY_SIZE];
    key.copy_from_slice(&result);
    key
}

fn compute_auth_tag(pre_shared: &[u8; 32], pubkey: &[u8]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(b"p2p-file-transfer-auth");
    hasher.update(pre_shared);
    hasher.update(pubkey);
    let result = hasher.finalize();
    let mut tag = [0u8; 32];
    tag.copy_from_slice(&result);
    tag
}

fn nonce_from_counter(counter: u64) -> Nonce {
    let mut nonce_bytes = [0u8; NONCE_SIZE];
    nonce_bytes[4..12].copy_from_slice(&counter.to_be_bytes());
    Nonce::from(nonce_bytes)
}

fn hex_encode(data: &[u8]) -> String {
    data.iter().map(|b| format!("{:02x}", b)).collect()
}
