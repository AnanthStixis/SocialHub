from app.core.security import hash_password, verify_password, create_access_token, decode_token


def test_password_hash_roundtrip():
    hashed = hash_password("Secret@123")
    assert verify_password("Secret@123", hashed)
    assert not verify_password("wrong", hashed)


def test_access_token_roundtrip():
    token = create_access_token("user-123", ["ADMIN"])
    payload = decode_token(token)
    assert payload["sub"] == "user-123"
    assert payload["roles"] == ["ADMIN"]
    assert payload["type"] == "access"
