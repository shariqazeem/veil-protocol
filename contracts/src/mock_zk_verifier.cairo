#[starknet::contract]
pub mod MockZkVerifier {
    #[storage]
    struct Storage {}

    #[abi(embed_v0)]
    impl MockVerifierImpl of ghost_sats::shielded_pool::IZKVerifier<ContractState> {
        fn verify_ultra_keccak_zk_honk_proof(
            self: @ContractState, full_proof_with_hints: Span<felt252>,
        ) -> Result<Span<u256>, felt252> {
            // Mock: first 4 elements of proof are [commitment, nullifier, denomination, recipient]
            // Return them as u256 public inputs so the contract's assertions pass.
            assert(full_proof_with_hints.len() >= 4, 'Mock needs 4 felt252 values');
            let commitment: u256 = (*full_proof_with_hints.at(0)).into();
            let nullifier: u256 = (*full_proof_with_hints.at(1)).into();
            let denomination: u256 = (*full_proof_with_hints.at(2)).into();
            let recipient: u256 = (*full_proof_with_hints.at(3)).into();
            Result::Ok(array![commitment, nullifier, denomination, recipient].span())
        }
    }
}
