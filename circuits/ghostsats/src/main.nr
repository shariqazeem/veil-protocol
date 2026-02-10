use dep::poseidon::poseidon::bn254;

/// GhostSats ZK Withdrawal Proof Circuit
///
/// Proves knowledge of (secret, blinder) that hash to a public commitment
/// and that the nullifier is correctly derived from the secret.
///
/// Private inputs: secret, blinder (never appear in calldata)
/// Public inputs: zk_commitment, nullifier_hash, denomination
///
/// This eliminates the need to send secret/blinder as calldata during withdrawal,
/// preventing observers from correlating deposits with withdrawals.

fn main(
    // Private witness inputs (hidden from calldata)
    secret: Field,
    blinder: Field,

    // Public inputs (verified on-chain via Garaga)
    zk_commitment: pub Field,
    nullifier_hash: pub Field,
    denomination: pub Field,
) {
    // 1. Verify commitment preimage
    // commitment = Poseidon_BN254(secret, blinder, denomination)
    let computed_commitment = bn254::hash_3([secret, blinder, denomination]);
    assert(computed_commitment == zk_commitment, "Invalid commitment preimage");

    // 2. Verify nullifier derivation
    // nullifier = Poseidon_BN254(secret, 1)
    let computed_nullifier = bn254::hash_2([secret, 1]);
    assert(computed_nullifier == nullifier_hash, "Invalid nullifier derivation");
}

#[test]
fn test_valid_proof() {
    let secret = 12345;
    let blinder = 67890;
    let denomination = 1;

    let expected_commitment = bn254::hash_3([secret, blinder, denomination]);
    let expected_nullifier = bn254::hash_2([secret, 1]);

    main(secret, blinder, expected_commitment, expected_nullifier, denomination);
}

#[test(should_fail_with = "Invalid commitment preimage")]
fn test_invalid_commitment() {
    let secret = 12345;
    let blinder = 67890;
    let denomination = 1;

    let expected_nullifier = bn254::hash_2([secret, 1]);

    main(secret, blinder, 999999, expected_nullifier, denomination);
}

#[test(should_fail_with = "Invalid nullifier derivation")]
fn test_invalid_nullifier() {
    let secret = 12345;
    let blinder = 67890;
    let denomination = 1;

    let expected_commitment = bn254::hash_3([secret, blinder, denomination]);

    main(secret, blinder, expected_commitment, 888888, denomination);
}
