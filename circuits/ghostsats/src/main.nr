use dep::poseidon::poseidon::bn254;

/// Veil Protocol ZK Withdrawal Proof Circuit
///
/// Proves knowledge of (secret, blinder) that hash to a public commitment
/// and that the nullifier is correctly derived from the secret.
/// Also binds the proof to a specific recipient to prevent front-running.
///
/// Private inputs: secret, blinder (never appear in calldata)
/// Public inputs: zk_commitment, nullifier_hash, denomination, recipient
///
/// The recipient binding prevents mempool front-running attacks where
/// an attacker could intercept a proof and submit it with their own address.

fn main(
    // Private witness inputs (hidden from calldata)
    secret: Field,
    blinder: Field,

    // Public inputs (verified on-chain via Garaga)
    zk_commitment: pub Field,
    nullifier_hash: pub Field,
    denomination: pub Field,
    recipient: pub Field,
) {
    // 1. Verify commitment preimage
    // commitment = Poseidon_BN254(secret, blinder, denomination)
    let computed_commitment = bn254::hash_3([secret, blinder, denomination]);
    assert(computed_commitment == zk_commitment, "Invalid commitment preimage");

    // 2. Verify nullifier derivation
    // nullifier = Poseidon_BN254(secret, 1)
    let computed_nullifier = bn254::hash_2([secret, 1]);
    assert(computed_nullifier == nullifier_hash, "Invalid nullifier derivation");

    // 3. Verify recipient is bound (non-zero)
    // The contract verifies the actual value matches the caller/recipient address.
    // This just ensures the proof was generated with a specific recipient in mind.
    assert(recipient != 0, "Recipient cannot be zero");
}

#[test]
fn test_valid_proof() {
    let secret = 12345;
    let blinder = 67890;
    let denomination = 1;
    let recipient = 0x1234abcd;

    let expected_commitment = bn254::hash_3([secret, blinder, denomination]);
    let expected_nullifier = bn254::hash_2([secret, 1]);

    main(secret, blinder, expected_commitment, expected_nullifier, denomination, recipient);
}

#[test(should_fail_with = "Invalid commitment preimage")]
fn test_invalid_commitment() {
    let secret = 12345;
    let blinder = 67890;
    let denomination = 1;
    let recipient = 0x1234abcd;

    let expected_nullifier = bn254::hash_2([secret, 1]);

    main(secret, blinder, 999999, expected_nullifier, denomination, recipient);
}

#[test(should_fail_with = "Invalid nullifier derivation")]
fn test_invalid_nullifier() {
    let secret = 12345;
    let blinder = 67890;
    let denomination = 1;
    let recipient = 0x1234abcd;

    let expected_commitment = bn254::hash_3([secret, blinder, denomination]);

    main(secret, blinder, expected_commitment, 888888, denomination, recipient);
}

#[test(should_fail_with = "Recipient cannot be zero")]
fn test_zero_recipient() {
    let secret = 12345;
    let blinder = 67890;
    let denomination = 1;

    let expected_commitment = bn254::hash_3([secret, blinder, denomination]);
    let expected_nullifier = bn254::hash_2([secret, 1]);

    main(secret, blinder, expected_commitment, expected_nullifier, denomination, 0);
}
